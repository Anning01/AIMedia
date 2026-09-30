import express, {
  type Request,
  type Response,
  type ErrorRequestHandler,
} from "express";
import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { mkdir, unlink } from "node:fs/promises";
import { resolve, join, extname } from "node:path";
import multer from "multer";
import { z } from "zod";
import { Store, id } from "./store.js";
import { Generator, type Fetch } from "./generation.js";
import { planAgentAction } from "./agent-plan.js";
import { CONVERSATION_RULE, conversationContext, recentConversation, recordConversation } from './agent-conversation.js';
import { Publisher, createSchedule, checkVersion } from "./publishing.js";
import { requiresOutcomeReview, resolveBrowserOutcome } from "./browser-publishing.js";
import {
  httpUrl,
  normalizeArticle,
  importSourceMedia,
  ownedMediaPath,
  type ImageProvider,
} from "./media.js";
import {
  now,
  errorMessage,
  HttpError,
  type Account,
  type Asset,
  type Row,
  type Run,
  type Schedule,
  type Template,
} from "./types.js";
import { agentEditPrompts, rewritePrompts } from "./templates.js";
import { assertSkillSnapshot, loadSkills, selectSkills } from "./skill-runtime.js";
import { imageSkillContext, resolveImageSkills } from './media-prompts.js';
import { beginApproval, createApproval, finishApproval } from "./approvals.js";
import { isWechatEntryUrl, isWechatPlatform } from "../../shared/publishing.js";
import { articleTitle, portableMediaHtml, sanitizeHtml } from "./content.js";
import { decideProposal, revisionSource } from "./article-proposals.js";
import { SkillInstaller, skillImportInput, skillKey, persistSkillPackage } from "./skills.js";
import { signMediaPath, verifyMediaSignature } from "./media-access.js";
import {
  accountInput,
  agentEditInput,
  articleInput,
  configInput,
  defaults,
  imageInput,
  imagePromptInput,
  imageSkillSelectionInput,
  policy,
  taskInput,
  templateInput,
} from "./validation.js";

export interface ServerOptions {
  dataDir: string;
  webDir?: string;
  token: string;
  integrationToken?: string;
  port?: number;
  devOrigin?: string;
  workers?: boolean;
  request?: Fetch;
  imageProvider?: ImageProvider;
  importMedia?: typeof importSourceMedia;
  version?: string;
}
export function equalSecret(a: string, b: string) {
  return Boolean(
    a &&
      b &&
      Buffer.byteLength(a) === Buffer.byteLength(b) &&
      timingSafeEqual(Buffer.from(a), Buffer.from(b)),
  );
}
const required = <T>(value: T, message: string): NonNullable<T> => {
  if (value == null) throw new HttpError(404, message);
  return value;
};
const param = (req: Request, name: string) => String(req.params[name]);
const positiveInt = (v: unknown, fallback: number, max: number) =>
  v == null ? fallback : z.coerce.number().int().min(0).max(max).parse(v);
const articleSummary = (task: Row) => ({
  ...task,
  status:
    (
      {
        queued: "pending_rewrite",
        running: "rewriting",
        completed: "rewritten",
      } as Row
    )[task.generation_status] ?? task.generation_status,
  rewritten_content: task.html,
  rewritten_title: task.original_title,
});

export async function startServer(options: ServerOptions) {
  if (!options.token) throw new Error("本地服务必须设置访问令牌");
  const dataDir = resolve(options.dataDir),
    mediaDir = join(dataDir, "media"),
    uploadDir = join(mediaDir, "uploads");
  await mkdir(uploadDir, { recursive: true, mode: 0o700 });
  const store = new Store(join(dataDir, "ai_media.db")),
    generator = new Generator(
      store,
      mediaDir,
      options.request,
      options.imageProvider,
    );
  const mediaKey = options.integrationToken || options.token;
  const skillInstaller = new SkillInstaller(store, options.token);
  const publisher = new Publisher(store, options.request, (path) =>
    signMediaPath(path, mediaKey),
  );
  const lifetime = new AbortController(),
    imports = new Set<Promise<unknown>>();
  const app = express();
  app.disable("x-powered-by");
  let origin = "",
    version = options.version ?? "0.4.0";
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' http: https: data: blob:; media-src 'self' http: https: blob:; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    );
    const host = req.headers.host;
    if (origin && host !== new URL(origin).host) {
      res.status(403).json({ detail: "不允许的服务地址" });
      return;
    }
    const requestOrigin = req.headers.origin;
    const articlePath = /^\/api\/articles(?:\/[^/]+(?:\/retry)?)?$/.test(req.path);
    const integrationRequest = articlePath && Boolean(options.integrationToken) && equalSecret(req.headers.authorization?.replace(/^Bearer /, "") || "", options.integrationToken || "");
    // Browser extensions preflight without the bearer header. Only the article
    // route accepts that preflight; the actual request still requires its token.
    const integrationPreflight = articlePath && req.method === "OPTIONS" && Boolean(requestOrigin);
    if (requestOrigin && ![origin, options.devOrigin].includes(requestOrigin) && !integrationRequest && !integrationPreflight) {
      res.status(403).json({ detail: "不允许的请求来源" });
      return;
    }
    if (requestOrigin && (requestOrigin === options.devOrigin || integrationRequest || integrationPreflight)) {
      res.setHeader("Access-Control-Allow-Origin", requestOrigin!);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, Last-Event-ID",
      );
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      );
      if (req.method === "OPTIONS") {
        res.sendStatus(204);
        return;
      }
    }
    next();
  });
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (req.path === "/health" && req.method === "GET") {
      res.json({
        status: "ok",
        runtime: "node",
        version,
        tasks_count: store.rows("SELECT COUNT(*) AS count FROM tasks")[0].count,
      });
      return;
    }
    if (
      req.method === "GET" &&
      /^\/media\/[^/]+\/content$/.test(req.path) &&
      verifyMediaSignature(
        `/api${req.path}`,
        req.query.expires,
        req.query.signature,
        mediaKey,
      )
    ) {
      next();
      return;
    }
    const cookie =
      (req.headers.cookie || "")
        .split(";")
        .map((v) => v.trim())
        .find((v) => v.startsWith("ai_media_session="))
        ?.slice("ai_media_session=".length) || "";
    const bearer = req.headers.authorization?.replace(/^Bearer /, "") || "";
    if (
      equalSecret(bearer, options.token) ||
      equalSecret(cookie, options.token)
    ) {
      next();
      return;
    }
    if (
      options.integrationToken &&
      equalSecret(bearer, options.integrationToken) &&
      /^\/articles(?:\/[^/]+(?:\/retry)?)?$/.test(req.path)
    ) {
      next();
      return;
    }
    res.status(401).json({ detail: "请通过桌面应用访问，或使用本地接入令牌" });
  });
  app.use(express.json({ limit: "5mb" }));
  const safeConfig = () => {
    const config = store.config(),
      result: Row = {
        ...defaults,
        ...Object.fromEntries(
          Object.keys(defaults)
            .filter((k) => k in config)
            .map((k) => [k, config[k]]),
        ),
      };
    for (const [secret, fallback] of Object.entries({
      openai_api_key: process.env.OPENAI_API_KEY,
      firecrawl_api_key: process.env.FIRECRAWL_API_KEY,
      image_api_key: "",
      github_token: "",
    }))
      result[`${secret}_configured`] = Boolean(config[secret] || fallback);
    if (result.image_provider === "method")
      result.image_provider = "gpt-image-2";
    return result;
  };
  app.get("/api/admin/config", (_req, res) => res.json(safeConfig()));
  app.route("/api/admin/config").patch(updateConfig).put(updateConfig);
  function updateConfig(req: Request, res: Response) {
    const values = configInput.parse(req.body?.values ?? req.body);
    store.transaction(() => {
      for (const [key, value] of Object.entries(values)) {
        if (/(?:api_key|token)$/.test(key) && !value) continue;
        store.setConfig(key, value);
      }
      if ("github_repository" in values) {
        store.setConfig("github_etag", null);
        store.setConfig("version_cache", null);
      }
    });
    res.json(safeConfig());
  }
  app.get("/api/admin/config/secrets/:secret", (req, res) => {
    const key = z
      .enum([
        "openai_api_key",
        "firecrawl_api_key",
        "image_api_key",
        "github_token",
      ])
      .parse(param(req, "secret"));
    const secret =
      store.config()[key] ||
      (
        {
          openai_api_key: process.env.OPENAI_API_KEY,
          firecrawl_api_key: process.env.FIRECRAWL_API_KEY,
        } as Row
      )[key];
    if (!secret) throw new HttpError(404, "尚未配置该密钥");
    res.json({ value: secret });
  });
  app.get("/api/admin/accounts", (_req, res) =>
    res.json(
      store
        .rows<Account>("SELECT * FROM accounts_v2 ORDER BY created_at DESC")
        .map((a) => store.publicAccount(a)),
    ),
  );
  const validateAccount = (data: Row) => {
    if (data.delay_max < data.delay_min)
      throw new HttpError(422, "随机延迟范围无效");
    if (data.publish_policy === "daily_slots" && !data.daily_slots.length)
      throw new HttpError(422, "请配置每日时间槽");
    if (data.adapter === "browser" && !data.entry_url)
      throw new HttpError(422, "请配置平台登录或发布页地址");
    if (
      data.adapter === "browser" &&
      isWechatPlatform(String(data.platform)) &&
      !isWechatEntryUrl(String(data.entry_url ?? ""))
    )
      throw new HttpError(422, "微信公众号浏览器入口必须使用 https://mp.weixin.qq.com/ 官方地址");
  };
  app.post("/api/admin/accounts", (req, res) => {
    const data = accountInput.parse(req.body);
    validateAccount(data);
    res.status(201).json(store.createAccount(data));
  });
  app
    .route("/api/admin/accounts/:accountId")
    .patch(updateAccount)
    .put(updateAccount)
    .delete((req, res) => {
      const key = param(req, "accountId");
      if (!store.account(key)) throw new HttpError(404, "账号不存在");
      if (
        store.rows(
          "SELECT id FROM publish_schedules WHERE account_id=? AND status IN ('scheduled','publishing','paused_import','awaiting_browser','awaiting_approval','needs_handoff')",
          key,
        ).length
      )
        throw new HttpError(409, "请先取消该账号的发布计划");
      store.delete("accounts_v2", key);
      res.sendStatus(204);
    });
  function updateAccount(req: Request, res: Response) {
    const key = param(req, "accountId"),
      existing = required(store.account(key), "账号不存在"),
      patch = accountInput.partial().parse(req.body);
    validateAccount({ ...existing, ...patch });
    res.json(store.updateAccount(key, patch));
  }
  function sse(req: Request, res: Response, runId?: string) {
    let cursor = positiveInt(
        req.headers["last-event-id"],
        0,
        Number.MAX_SAFE_INTEGER,
      ),
      idle = 0,
      draining = false;
    res
      .status(200)
      .set({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      })
      .flushHeaders();
    const pump = () => {
      if (draining || res.destroyed) return;
      const events = store.events(cursor, runId);
      for (const e of events) {
        cursor = e.id;
        if (
          !res.write(
            `id: ${e.id}\nevent: ${e.event_type}\ndata: ${JSON.stringify(e.payload)}\n\n`,
          )
        ) {
          draining = true;
          res.once("drain", () => {
            draining = false;
          });
          break;
        }
      }
      if (events.length) idle = 0;
      else if (++idle >= 15) {
        res.write("event: heartbeat\ndata: {}\n\n");
        idle = 0;
      }
    };
    const timer = setInterval(pump, 1000);
    res.on("close", () => clearInterval(timer));
    pump();
  }
  app.get("/api/tasks/events", (req, res) => sse(req, res));
  app.get("/api/tasks", (req, res) =>
    res.json(
      store.tasks(
        positiveInt(req.query.limit, 100, 10000),
        positiveInt(req.query.offset, 0, 1_000_000),
      ),
    ),
  );
  const targetAccount = (accountId?: string | null) =>
    accountId
      ? required(store.account(accountId), "目标账号不存在")
      : undefined;
  app.post("/api/tasks", (req, res) => {
    const data = taskInput.parse(req.body),
      account = targetAccount(data.target_account_id);
    const task = store.createTask(data);
    try {
      if (
        account &&
        (data.publish_policy || account.publish_policy) !== "manual"
      )
        createSchedule(
          store,
          task.id,
          account,
          data.publish_policy || account.publish_policy,
        );
    } catch (error) {
      store.deleteTask(task.id);
      throw error;
    }
    res.status(201).json(store.task(task.id));
  });
  app.get("/api/tasks/:taskId", (req, res) => {
    const task = required(store.task(param(req, "taskId")), "任务不存在");
    const media = store
      .media(task.id)
      .map((a) => ({
        id: a.id,
        media_type: a.media_type,
        status: a.status,
        url: a.url,
        preview_url:
          a.status === "ready"
            ? a.url
            : a.metadata_json.origin === "aimaster"
              ? httpUrl(a.metadata_json.original_url)
              : null,
        poster_url: httpUrl(a.metadata_json.poster),
        alt_text: a.alt_text,
        origin: a.metadata_json.origin || "",
        error: a.metadata_json.error || null,
        paragraph_index: a.metadata_json.paragraph_index ?? null,
        source_order: a.metadata_json.source_order ?? null,
      }));
    res.json({ ...task, media });
  });
  app.delete("/api/tasks/:taskId", (req, res) => {
    const key = param(req, "taskId");
    if (
      store.rows(
        "SELECT id FROM publish_schedules WHERE task_id=? AND status IN ('publishing','awaiting_browser','awaiting_approval','needs_handoff','paused_import')",
        key,
      ).length
    )
      throw new HttpError(409, "文章有未结束或结果待核对的发布记录，请先处理发布记录");
    if (!store.deleteTask(key)) throw new HttpError(404, "任务不存在");
    generator.cancelTask(key);
    res.sendStatus(204);
  });
  app.patch("/api/tasks/:taskId/draft", (req, res) => {
    const key = param(req, "taskId"),
      data = z.object({ html: z.string().max(2_000_000), base_version_id: z.string().min(1).nullable().optional() }).parse(req.body);
    required(store.task(key), "任务不存在");
    store.saveDraft(key, portableMediaHtml(data.html, origin), "manual", null, data.base_version_id);
    store.update("tasks", key, { generation_status: "completed", error: null });
    res.json(store.task(key));
  });
  app.get("/api/tasks/:taskId/versions", (req, res) =>
    res.json(
      store.rows(
        "SELECT * FROM draft_versions WHERE task_id=? ORDER BY created_at DESC",
        param(req, "taskId"),
      ),
    ),
  );
  app.post("/api/tasks/:taskId/versions/:versionId/activate", (req, res) => {
    const key = param(req, "taskId"),
      versionId = param(req, "versionId");
    const data = z.object({ base_version_id: z.string().min(1).nullable().optional() }).parse(req.body ?? {});
    store.transaction(() => {
      store.checkDraftBase(key, data.base_version_id);
      if (store.get("draft_versions", versionId)?.task_id !== key)
        throw new HttpError(404, "版本不存在");
      const version = store.get<Row>("draft_versions", versionId)!;
      const task = store.task(key)!;
      store.update("tasks", key, { active_version_id: versionId, original_title: articleTitle(String(version.html), task.original_title) });
    });
    res.json(store.task(key));
  });
  const launch = (run: Run) => {
    store.event(run.task_id, run.id, "snapshot", { run });
    if (options.workers !== false) generator.enqueue(run.id);
    return run;
  };
  const ensureNoActiveRun = (taskId: string) => {
    if (
      store.rows(
        "SELECT id FROM generation_runs WHERE task_id=? AND status IN ('queued','running')",
        taskId,
      ).length
    )
      throw new HttpError(409, "该文章正在处理，请稍后再试");
  };
  const rewrite = (taskId: string, templateId?: string | null) => {
    const task = required(store.task(taskId), "任务不存在");
    ensureNoActiveRun(taskId);
    const template = store.template(templateId, task.style);
    if (templateId && !template) throw new HttpError(404, "模板不存在");
    return launch(
      store.createRun({
        task_id: taskId,
        template_id: template?.id ?? null,
        tool_permissions: template?.permissions ?? ["web_search"],
        kind: "rewrite",
        ...rewritePrompts(template, task),
      }),
    );
  };
  app.post("/api/tasks/:taskId/rewrite", (req, res) => {
    const data = z
      .object({ template_id: z.string().nullable().optional() })
      .parse(req.body ?? {});
    res.status(202).json(rewrite(param(req, "taskId"), data.template_id));
  });
  app.post("/api/tasks/:taskId/agent-plan", async (req, res) => {
    const taskId = param(req, 'taskId');
    required(store.task(taskId), "文章不存在");
    const { instruction } = z.object({ instruction: z.string().trim().min(1).max(4000) }).parse(req.body ?? {});
    try {
      const plan = await planAgentAction(generator.chat.bind(generator), instruction, lifetime.signal, recentConversation(store, taskId));
      if ((plan.action === 'image_prompt' || plan.action === 'publish_preview') && store.rows("SELECT id FROM generation_runs WHERE task_id=? AND kind='agent_edit' AND status='completed'", taskId).length) {
        plan.action = 'clarify';
        plan.message = '当前还有待审阅的候选稿。请先接受或放弃，再配图或准备发布；你也可以继续提出改稿要求。';
      }
      if (plan.action === 'publish_preview') plan.message = '请先选择账号并核对当前文章。此时还没有打开发布浏览器，也没有提交发布。';
      // Edit and image requests are recorded by their execution endpoints, once.
      if (plan.action === 'clarify' || plan.action === 'publish_preview') recordConversation(store, taskId, instruction, plan.message);
      res.json(plan);
    } catch (error) {
      throw new HttpError(503, errorMessage(error));
    }
  });
  app.post("/api/tasks/:taskId/agent-runs", (req, res) => {
    const taskId = param(req, "taskId"),
      task = required(store.task(taskId), "文章不存在"),
      data = agentEditInput.parse(req.body ?? {});
    const run = store.transaction(() => {
      ensureNoActiveRun(taskId);
      const current = store.checkDraftBase(taskId, data.base_version_id);
      const parent = data.revise_run_id ? revisionSource(store, taskId, data.revise_run_id) : null;
      const baseHtml = parent ? parent.base_html! : sanitizeHtml(portableMediaHtml(data.current_html ?? (current.html || current.original_content), origin));
      const skills = loadSkills(store, selectSkills(store.rows<Template>("SELECT * FROM rewrite_templates"), data.instruction, data.skill_ids ?? (data.template_id ? [data.template_id] : []), task.style));
      return store.createRun({
        task_id: taskId,
        template_id: skills[0]?.invocation.id ?? null,
        tool_permissions: [...new Set(skills.flatMap(skill => skill.invocation.permissions))],
        skill_snapshot: skills.map(skill => skill.invocation),
        kind: "agent_edit",
        base_version_id: current.active_version_id,
        base_html: baseHtml,
        parent_run_id: parent?.id ?? null,
        ...agentEditPrompts(skills, { ...current, html: parent?.partial_html ?? baseHtml }, data.instruction, conversationContext(store, taskId), !!parent),
      });
    });
    store.event(taskId, run.id, "agent_message", {
      role: "user",
      content: data.instruction,
      skill_ids: run.skill_snapshot.map(skill => skill.id),
    });
    res.status(202).json(launch(run));
  });
  app.get("/api/tasks/:taskId/agent-history", (req, res) => {
    const taskId = param(req, "taskId");
    required(store.task(taskId), "文章不存在");
    res.json(
      store.rows(
        "SELECT * FROM generation_events WHERE task_id=? AND event_type IN ('agent_message','agent_proposal','status') ORDER BY id",
        taskId,
      ),
    );
  });
  app.post("/api/tasks/:taskId/agent-runs/:runId/accept", (req, res) => {
    res.json(decideProposal(store, param(req, "taskId"), param(req, "runId"), true));
  });
  app.post("/api/tasks/:taskId/agent-runs/:runId/reject", (req, res) => {
    decideProposal(store, param(req, "taskId"), param(req, "runId"), false);
    res.sendStatus(204);
  });
  app.get("/api/generation-runs/:runId/events", (req, res) => {
    const key = param(req, "runId");
    required(store.get("generation_runs", key), "生成记录不存在");
    sse(req, res, key);
  });
  app.get("/api/rewrite-templates", (_req, res) =>
    res.json(store.rows("SELECT * FROM rewrite_templates ORDER BY created_at")),
  );
  app.post("/api/rewrite-templates", (req, res) => {
    const data = templateInput.parse(req.body),
      key = skillKey(data.name);
    if (store.rows("SELECT id FROM rewrite_templates WHERE skill_key=?", key).length)
      throw new HttpError(409, "已存在同名 Skill");
    res.status(201).json(
      store.transaction(() => {
        const installed = store.insert<Template>("rewrite_templates", {
        ...data,
        id: id(),
        skill_key: key,
        style_key: null,
        is_builtin: false,
        source: "user",
        created_at: now(),
        updated_at: now(),
        });
        persistSkillPackage(store, installed);
        return installed;
      }),
    );
  });
  app.post("/api/skills/import/preview", (req, res) => {
    res.json(skillInstaller.preview(skillImportInput.parse(req.body)));
  });
  app.post("/api/skills/import", (req, res) => {
    const input = skillImportInput.parse(req.body);
    const { approval_token } = z.object({ approval_token: z.string().min(1).max(100) }).parse(req.body);
    const result = skillInstaller.install(input, approval_token);
    res.status(result.action === "installed" ? 201 : 200).json(result);
  });
  app.get("/api/rewrite-templates/:templateId", (req, res) =>
    res.json(
      required(
        store.get("rewrite_templates", param(req, "templateId")),
        "模板不存在",
      ),
    ),
  );
  app.patch("/api/rewrite-templates/:templateId", (req, res) => {
    const template = required(store.get<Template>("rewrite_templates", param(req, "templateId")), "Skill 不存在");
    // Zod defaults also apply within partial objects; PATCH must retain omitted fields.
    const data = Object.fromEntries(Object.entries(templateInput.partial().parse(req.body)).filter(([key]) => Object.hasOwn(req.body, key)));
    if (template.source === "file" && Object.keys(data).some(key => key !== "enabled"))
      throw new HttpError(409, "文件安装的 Skill 请通过重新导入并确认来更新，确保指令、参考资料和权限一致");
    res.json(store.transaction(() => {
      const updated = store.update<Template>("rewrite_templates", template.id, data)!;
      persistSkillPackage(store, updated);
      return updated;
    }));
  });
  app.delete("/api/rewrite-templates/:templateId", (req, res) => {
    const template = required(
      store.get<Template>("rewrite_templates", param(req, "templateId")),
      "Skill 不存在",
    );
    if (template.is_builtin) throw new HttpError(409, "内置 Skill 不能卸载");
    if (!store.delete("rewrite_templates", template.id))
      throw new HttpError(404, "模板不存在");
    res.sendStatus(204);
  });
  const upload = multer({
    storage: multer.diskStorage({
      destination: uploadDir,
      filename: (_req, file, cb) =>
        cb(
          null,
          `${id()}${/^\.[a-z0-9]{1,6}$/i.test(extname(file.originalname)) ? extname(file.originalname) : ".bin"}`,
        ),
    }),
    limits: { fileSize: 200 * 1024 * 1024, files: 1, fields: 4 },
    fileFilter: (_req, file, cb) => {
      if (
        ![
          "image/png",
          "image/jpeg",
          "image/webp",
          "image/gif",
          "video/mp4",
          "video/webm",
          "video/quicktime",
          "video/ogg",
        ].includes(file.mimetype)
      )
        cb(new HttpError(415, "仅支持常见图片和视频文件"));
      else cb(null, true);
    },
  });
  app.post("/api/media/upload", upload.single("file"), async (req, res) => {
    if (!req.file) throw new HttpError(422, "请选择媒体文件");
    try {
      const taskId = req.body?.task_id || null;
      if (taskId) required(store.task(taskId), "任务不存在");
      res
        .status(201)
        .json(
          store.createMedia({
            task_id: taskId,
            media_type: req.file.mimetype.startsWith("image/")
              ? "image"
              : "video",
            local_path: req.file.path,
            mime_type: req.file.mimetype,
            alt_text: String(req.body?.alt_text || ""),
          }),
        );
    } catch (error) {
      await unlink(req.file.path).catch(() => {});
      throw error;
    }
  });
  app.get("/api/media/:assetId/content", async (req, res) => {
    const asset = required(
      store.get<Asset>("media_assets", param(req, "assetId")),
      "媒体不存在",
    );
    if (!asset.local_path) throw new HttpError(404, "媒体没有本地文件");
    let path: string;
    try {
      path = await ownedMediaPath(mediaDir, asset.local_path);
    } catch {
      throw new HttpError(404, "媒体文件不存在");
    }
    res.type(asset.mime_type || "application/octet-stream").sendFile(path);
  });
  const saveImages = (results: Row[], data: Row, source?: Asset) =>
    results.map((result) =>
      store.createMedia({
        task_id: source?.task_id ?? data.task_id ?? null,
        media_type: "image",
        ...result,
        alt_text: data.alt_text,
        metadata_json: {
          prompt: data.prompt,
          placement: data.placement,
          selection_required: true,
          selected_at: null,
          revised_prompt: result.revised_prompt,
          ...(source ? { source_asset_id: source.id } : {}),
        },
      }),
    );
  const imageApprovalInput = imageInput.extend({ source_asset_id: z.string().min(1).nullable().default(null) });
  app.post("/api/tasks/:taskId/image-approval", (req, res) => {
    const taskId = param(req, "taskId"), data = imageApprovalInput.parse({ ...req.body, task_id: taskId });
    required(store.task(taskId), "文章不存在");
    if (data.source_asset_id) {
      const source = required(store.get<Asset>("media_assets", data.source_asset_id), "参考图不存在");
      if (source.task_id !== taskId || source.media_type !== "image" || source.status !== "ready") throw new HttpError(409, "参考图不能用于这篇文章");
    }
    res.json(createApproval(store, "image_generation", taskId, data));
  });
  app.post("/api/media/generate", async (req, res) => {
    const data = imageInput.parse(req.body),
      approvalId = z.string().min(1).parse(req.body?.approval_id);
    if (data.task_id) required(store.task(data.task_id), "任务不存在");
    beginApproval(store, approvalId, "image_generation", data.task_id ?? null, { ...data, source_asset_id: null });
    try {
      const images = saveImages(
            await generator.imageProvider.generate(data, lifetime.signal),
            data,
          );
      finishApproval(store, approvalId);
      res.status(201).json(images);
    } catch (error) {
      finishApproval(store, approvalId, error);
      throw new HttpError(503, errorMessage(error));
    }
  });
  app.post("/api/tasks/:taskId/image-prompt", async (req, res) => {
    const taskId = param(req, "taskId"),
      data = imagePromptInput.parse(req.body ?? {}),
      task = store.checkDraftBase(taskId, data.base_version_id),
      snapshot = sanitizeHtml(portableMediaHtml(data.current_html ?? (task.html || task.original_content), origin)),
      article = snapshot.slice(0, 8000),
      instruction = data.instruction || '生成一张适合作为文章头图的配图',
      history = conversationContext(store, taskId),
      skills = resolveImageSkills(store, instruction, data.skill_ids ?? (data.template_id ? [data.template_id] : []), task.style),
      invocations = skills.map(skill => skill.invocation);
    try {
      assertSkillSnapshot(store, invocations, '配图');
      const response = await generator.chat(
        {
          messages: [
            {
              role: "system",
              content:
                `你是新闻配图提示词设计师。基于文章事实写一个具体、克制、无文字水印的中文图片生成提示词。只返回提示词正文。${CONVERSATION_RULE}`,
            },
            {
              role: "user",
              content: `${history}${imageSkillContext(skills)}文章标题：${articleTitle(snapshot, task.original_title)}\n文章内容：${article}\n用户要求：${instruction}`,
            },
          ],
          temperature: 0.4,
        },
        lifetime.signal,
      );
      const result = (await response.json()) as Row,
        prompt = String(result.choices?.[0]?.message?.content || "").trim();
      if (!prompt) throw new Error("模型未返回图片提示词");
      assertSkillSnapshot(store, invocations, '配图');
      const cleaned = prompt.replace(/^```(?:text)?\s*|\s*```$/g, "");
      recordConversation(store, taskId, instruction, `图片提示词记录（只供查看，不代表已生成图片或已获得生图授权）：\n${cleaned.slice(0, 8000)}`,
        { skill_ids: invocations.map(skill => skill.id) }, { skills: invocations });
      res.json({
        prompt: cleaned,
        aspect_ratio: "16:9",
        alt_text: data.instruction || task.original_title,
        skills: invocations,
      });
    } catch (error) {
      recordConversation(store, taskId, instruction, '图片提示词准备失败，尚未生图。请明确要求后重试。',
        { skill_ids: invocations.map(skill => skill.id) }, { skills: invocations, status: 'failed' });
      if (error instanceof HttpError) throw error;
      throw new HttpError(503, errorMessage(error));
    }
  });
  app.post('/api/tasks/:taskId/image-skills', (req, res) => {
    const task = required(store.task(param(req, 'taskId')), '文章不存在');
    const data = imageSkillSelectionInput.parse(req.body ?? {});
    const skills = resolveImageSkills(store, data.instruction, data.skill_ids ?? (data.template_id ? [data.template_id] : []), task.style);
    res.json({ invocations: skills.map(skill => skill.invocation) });
  });
  app.post("/api/media/:assetId/edit", async (req, res) => {
    const data = imageInput.parse(req.body),
      approvalId = z.string().min(1).parse(req.body?.approval_id),
      source = required(
        store.get<Asset>("media_assets", param(req, "assetId")),
        "媒体不存在",
      );
    if (source.media_type !== "image")
      throw new HttpError(415, "仅支持编辑图片");
    beginApproval(store, approvalId, "image_generation", data.task_id ?? null, { ...data, source_asset_id: source.id });
    try {
      const images = saveImages(
            await generator.imageProvider.edit(source, data, lifetime.signal),
            data,
            source,
          );
      finishApproval(store, approvalId);
      res.status(201).json(images);
    } catch (error) {
      finishApproval(store, approvalId, error);
      throw new HttpError(503, errorMessage(error));
    }
  });
  app.post("/api/tasks/:taskId/media/:assetId/select", (req, res) => {
    const taskId = param(req, "taskId"),
      asset = required(store.get<Asset>("media_assets", param(req, "assetId")), "媒体不存在");
    required(store.task(taskId), "文章不存在");
    if (asset.task_id !== taskId || asset.media_type !== "image" || asset.status !== "ready" || !asset.url)
      throw new HttpError(409, "该图片不能插入这篇文章");
    res.json(store.update<Asset>("media_assets", asset.id, {
      metadata_json: { ...asset.metadata_json, selection_required: true, selected_at: now() },
    }));
  });
  app.delete("/api/media/:assetId", async (req, res) => {
    const key = param(req, "assetId"),
      asset = required(store.get<Asset>("media_assets", key), "媒体不存在");
    if (asset.local_path) {
      try {
        await unlink(await ownedMediaPath(mediaDir, asset.local_path));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    store.delete("media_assets", key);
    res.sendStatus(204);
  });
  app.post("/api/tasks/:taskId/publish", (req, res) => {
    const task = required(store.task(param(req, "taskId")), "任务不存在"),
      data = z
        .object({ account_id: z.string(), policy: policy.optional() })
        .parse(req.body),
      account = required(store.account(data.account_id), "账号不存在");
    if (!task.html) throw new HttpError(409, "请先生成或保存草稿");
    if (store.rows("SELECT id FROM publish_schedules WHERE task_id=? AND status IN ('scheduled','publishing','paused_import','awaiting_browser','awaiting_approval','needs_handoff')", task.id).length)
      throw new HttpError(409, "这篇文章已有未结束的发布记录，请先继续、接管或取消");
    if (account.adapter === "browser") {
      if (!isWechatPlatform(account.platform)) throw new HttpError(409, "第一版浏览器发布仅支持微信公众号");
      if (!account.entry_url) throw new HttpError(409, "请先配置公众号登录或图文编辑页");
      if ((data.policy || account.publish_policy) !== "manual") throw new HttpError(409, "公众号浏览器发布目前只支持逐次人工确认");
      const created = createSchedule(store, task.id, account, "manual");
      const schedule = store.update<Schedule>("publish_schedules", created.id, {
        status: "awaiting_browser",
        version_id: task.active_version_id,
        account_revision: account.updated_at,
        title_snapshot: task.original_title,
      })!;
      store.insert("publish_events", { id: id(), schedule_id: schedule.id, stage: "created", status: "awaiting_browser",
        message: "发布内容已锁定，等待打开公众号并填写", summary: { version_id: schedule.version_id }, created_at: now() });
      store.update("tasks", task.id, { publish_status: "awaiting_browser" });
      store.event(task.id, null, "status", { publish_status: "awaiting_browser" });
      res.status(201).json({ ...schedule, status: "awaiting_browser", browser: true });
      return;
    }
    res.status(201).json(createSchedule(
          store,
          task.id,
          account,
          data.policy || account.publish_policy,
        ));
  });
  const browserContext = (scheduleId: string) => {
    const schedule = required(store.get<Schedule>("publish_schedules", scheduleId), "发布记录不存在"),
      task = required(store.task(schedule.task_id), "文章不存在"),
      account = required(store.account(schedule.account_id), "账号不存在");
    if (account.adapter !== "browser" || !isWechatPlatform(account.platform) || !account.entry_url)
      throw new HttpError(409, "该记录不是可执行的微信公众号浏览器发布");
    if (!["awaiting_browser", "needs_handoff", "awaiting_approval", "publishing"].includes(schedule.status))
      throw new HttpError(409, "该公众号发布记录已结束，不能继续执行");
    if (!schedule.version_id) throw new HttpError(409, "该发布记录缺少已锁定文章版本，请取消后重新发起");
    if (!schedule.title_snapshot) throw new HttpError(409, "该发布记录缺少已锁定文章标题，请取消后重新发起");
    if (schedule.account_revision !== account.updated_at)
      throw new HttpError(409, "公众号账号配置已变化，旧发布确认已失效，请取消后重新发起");
    return { schedule, task, account };
  };
  app.get("/api/publishing/browser/:scheduleId/context", (req, res) => {
    const { schedule, task, account } = browserContext(param(req, "scheduleId"));
    const version = required(store.get<Row>("draft_versions", schedule.version_id!), "已锁定的文章版本不存在");
    const html = String(version.html).replace(/(src|poster)="(\/api\/media\/[^"?]+\/content)"/g,
      (_match, attribute, path) => `${attribute}="${origin}${signMediaPath(path, mediaKey)}"`);
    res.json({ schedule: { id: schedule.id, status: schedule.status, idempotency_key: schedule.idempotency_key, requires_outcome_review: requiresOutcomeReview(store, schedule) },
      account: { id: account.id, name: account.name, platform: account.platform, entry_url: account.entry_url },
      article: { title: schedule.title_snapshot, html, image_count: (html.match(/<img\b/gi) ?? []).length, version_id: schedule.version_id },
    });
  });
  app.post("/api/publishing/browser/:scheduleId/begin", (req, res) => {
    const { schedule, task } = browserContext(param(req, "scheduleId"));
    if (schedule.status !== "awaiting_approval") throw new HttpError(409, "公众号发布尚未等待最终确认，或确认已使用");
    const updated = store.transaction(() => {
      const fresh = required(store.get<Schedule>("publish_schedules", schedule.id), "发布记录不存在");
      if (fresh.status !== "awaiting_approval") throw new HttpError(409, "公众号发布确认已失效");
      store.update("tasks", task.id, { publish_status: "publishing" });
      store.event(task.id, null, "status", { publish_status: "publishing" });
      store.insert("publish_events", { id: id(), schedule_id: schedule.id, stage: "confirm", status: "publishing",
        message: "用户已确认最终内容，正在执行公众号发布", summary: {}, created_at: now() });
      return store.update("publish_schedules", schedule.id, { status: "publishing" });
    });
    res.json(updated);
  });
  app.post("/api/publishing/browser/:scheduleId/status", (req, res) => {
    const { schedule, task, account } = browserContext(param(req, "scheduleId"));
    const data = z.object({ status: z.enum(["awaiting_approval", "needs_handoff", "published", "failed"]), message: z.string().max(1000),
      stage: z.enum(["prepare", "confirm"]), summary: z.record(z.string(), z.unknown()).optional() }).parse(req.body);
    const allowed = data.stage === "prepare" ? ["awaiting_browser", "needs_handoff"] : ["publishing"];
    if (!allowed.includes(schedule.status)) throw new HttpError(409, "公众号发布状态已变化，请刷新后重试");
    if (data.stage === 'prepare' && requiresOutcomeReview(store, schedule)) throw new HttpError(409, '上次发布结果不明确，请先核对平台结果，不能直接重新填写');
    const targetStatuses = data.stage === "prepare" ? ["awaiting_approval", "needs_handoff"] : ["published", "needs_handoff", "failed"];
    if (!targetStatuses.includes(data.status)) throw new HttpError(409, "公众号发布阶段与目标状态不匹配");
    const updated = store.transaction(() => {
      store.insert("publish_events", { id: id(), schedule_id: schedule.id, stage: data.stage, status: data.status,
        message: data.message, summary: data.summary ?? {}, created_at: now() });
      if (data.stage === "confirm") store.insert("publish_attempts", { id: id(), schedule_id: schedule.id,
        request_summary: { task_id: task.id, account_id: account.id, idempotency_key: schedule.idempotency_key, ...data.summary },
        response_status: data.status === "published" ? 200 : null, error: data.status === "published" ? null : data.message, created_at: now() });
      store.update("tasks", task.id, { publish_status: data.status });
      store.event(task.id, null, "status", { publish_status: data.status, message: data.message });
      return store.update("publish_schedules", schedule.id, { status: data.status,
        last_error: data.status === "published" ? null : data.message,
        attempt_count: schedule.attempt_count + (data.stage === "confirm" ? 1 : 0) });
    });
    res.json(updated);
  });
  app.post('/api/publishing/browser/:scheduleId/resolve', (req, res) => {
    const data = z.object({ outcome: z.enum(['published', 'not_published']) }).parse(req.body);
    res.json(resolveBrowserOutcome(store, param(req, 'scheduleId'), data.outcome));
  });
  app.get("/api/publishing/schedules", (_req, res) =>
    res.json(
      store.rows<Schedule>(
        "SELECT s.*, (SELECT id FROM publish_attempts a WHERE a.schedule_id=s.id ORDER BY a.created_at DESC LIMIT 1) AS latest_attempt_id, (SELECT adapter FROM accounts_v2 ac WHERE ac.id=s.account_id) AS account_adapter, (SELECT platform FROM accounts_v2 ac WHERE ac.id=s.account_id) AS account_platform FROM publish_schedules s ORDER BY s.created_at DESC",
      ).map(schedule => ({ ...schedule, requires_outcome_review: requiresOutcomeReview(store, schedule) })),
    ),
  );
  app.get("/api/publishing/schedules/:scheduleId/events", (req, res) => {
    const scheduleId = param(req, "scheduleId");
    required(store.get("publish_schedules", scheduleId), "发布记录不存在");
    res.json(store.rows("SELECT * FROM publish_events WHERE schedule_id=? ORDER BY rowid", scheduleId));
  });
  app.delete("/api/publishing/schedules/:scheduleId", (req, res) => {
    const schedule = store.get<Schedule>(
      "publish_schedules",
      param(req, "scheduleId"),
    );
    if (!schedule || !["scheduled", "failed", "paused_import", "awaiting_browser", "awaiting_approval", "needs_handoff"].includes(schedule.status))
      throw new HttpError(409, "计划不存在或已开始执行");
    if (requiresOutcomeReview(store, schedule)) throw new HttpError(409, '上次发布结果不明确，请先核对平台结果，不能通过取消绕过核对');
    store.update("publish_schedules", schedule.id, { status: "cancelled" });
    if (store.rows("SELECT id FROM publish_events WHERE schedule_id=? LIMIT 1", schedule.id).length)
      store.insert("publish_events", { id: id(), schedule_id: schedule.id, stage: "cancel", status: "cancelled",
        message: "用户取消了发布", summary: {}, created_at: now() });
    store.update("tasks", schedule.task_id, { publish_status: "cancelled" });
    res.sendStatus(204);
  });
  app.post("/api/publishing/attempts/:attemptId/retry", (req, res) => {
    const attempt = required(
        store.get("publish_attempts", param(req, "attemptId")),
        "发布尝试不存在",
      ),
      schedule = required(
        store.get<Schedule>("publish_schedules", attempt.schedule_id),
        "发布计划不存在",
      );
    if (schedule.status !== "failed")
      throw new HttpError(409, "只有失败的发布计划可以手动重试");
    const result = store.update("publish_schedules", schedule.id, {
      status: "scheduled",
      next_attempt_at: now(),
      last_error: null,
    });
    store.update("tasks", schedule.task_id, { publish_status: "scheduled" });
    res.json(result);
  });
  app.get("/api/system/version", async (_req, res) =>
    res.json(
      await checkVersion(store, version, options.request, lifetime.signal),
    ),
  );
  app.get("/api/desktop/info", (_req, res) =>
    res.json({
      version,
      runtime: "node",
      data_dir: dataDir,
      integration_url: origin,
      integration_token_configured: Boolean(options.integrationToken),
    }),
  );
  app.get("/api/desktop/integration-token", (_req, res) =>
    res.json({ value: options.integrationToken || "" }),
  );
  app.post("/api/articles", async (req, res) => {
    const data = articleInput.parse(req.body),
      normalized = normalizeArticle(data.article),
      account = targetAccount(data.target_account_id);
    const task = store.createTask({
      ...data,
      title: normalized.title,
      content: normalized.paragraphs.join("\n\n") || normalized.title,
      comments: normalized.comments,
    });
    const template = store.template(null, task.style),
      run = store.createRun({
        task_id: task.id,
        template_id: template?.id ?? null,
        tool_permissions: template?.permissions ?? ["web_search"],
        kind: "rewrite",
        ...rewritePrompts(template, task),
      });
    if (account && (data.publish_policy || account.publish_policy) !== "manual")
      createSchedule(
        store,
        task.id,
        account,
        data.publish_policy || account.publish_policy,
      );
    const work = (options.importMedia ?? importSourceMedia)(
      store,
      mediaDir,
      task.id,
      normalized.media,
      normalized.article_url,
      lifetime.signal,
    );
    imports.add(work);
    let assets: Asset[];
    try {
      assets = await work;
    } catch (error) {
      // Database failures must surface. A media failure must leave a recoverable
      // article and a complete media summary, even if the importer stops early.
      if (String((error as NodeJS.ErrnoException).code).includes("SQLITE")) throw error;
      const existing = store.media(task.id);
      assets = normalized.media.map(item => {
        const matches = existing.filter(asset => (asset.metadata_json.original_url || asset.url) === item.source_url);
        const finished = matches.find(asset => asset.status === "ready") || matches.find(asset => asset.status === "failed");
        if (finished) return finished;
        const metadata_json = { ...item, origin: "aimaster", original_url: item.source_url, error: errorMessage(error) };
        return matches.length
          ? store.update<Asset>("media_assets", matches[0].id, { status: "failed", metadata_json })!
          : store.createMedia({ task_id: task.id, media_type: item.media_type, url: item.source_url, alt_text: item.alt_text, status: "failed", metadata_json });
      });
    } finally {
      imports.delete(work);
    }
    assets = assets.map(asset => ["ready", "failed"].includes(asset.status) ? asset : store.update<Asset>("media_assets", asset.id, {
      status: "failed", metadata_json: { ...asset.metadata_json, error: "媒体导入未完成，请重试" },
    })!);
    launch(run);
    res.json({
      task_id: task.id,
      status: task.generation_status,
      run_id: run.id,
      media: {
        total: assets.length,
        ready: assets.filter((a) => a.status === "ready").length,
        failed: assets.filter((a) => a.status === "failed").length,
      },
    });
  });
  app.get("/api/articles", (req, res) =>
    res.json(store.tasks(positiveInt(req.query.size, 10, 1000)).map(articleSummary)),
  );
  app.get("/api/articles/:taskId", (req, res) =>
    res.json(articleSummary(required(store.task(param(req, "taskId")), "任务不存在"))),
  );
  app.post("/api/articles/:taskId/retry", (req, res) => {
    const task = required(store.task(param(req, "taskId")), "任务不存在");
    if (task.generation_status !== "failed")
      throw new HttpError(400, "只能重试失败的任务");
    const run = rewrite(task.id);
    res.json({ task_id: task.id, status: "queued", run_id: run.id });
  });
  const lengthHints: Row = {
    short: "控制在 300 字左右",
    medium: "控制在 800 字左右",
    long: "控制在 1500 字以上",
    auto: "保持与原文相近的长度",
  };
  for (const kind of ["rewrite", "generate"])
    app.post(`/api/${kind}`, async (req, res) => {
      const data = z
        .object({
          content: z.string().optional(),
          topic: z.string().optional(),
          style: z.string().default("professional"),
          length: z.string().default(kind === "rewrite" ? "auto" : "medium"),
          keywords: z.array(z.string()).default([]),
        })
        .parse(req.body);
      if (!(kind === "rewrite" ? data.content : data.topic))
        throw new HttpError(
          422,
          kind === "rewrite" ? "请提供原文" : "请提供主题",
        );
      const prompt =
        kind === "rewrite"
          ? `请将以下文章改写为「${data.style}」风格，${lengthHints[data.length] || lengthHints.auto}。\n\n原文：\n---\n${data.content}\n---\n\n直接输出改写后的文章即可，不要加任何说明。`
          : `请以「${data.topic}」为主题，写一篇${data.style}风格的文章。\n\n要求：\n- ${lengthHints[data.length] || lengthHints.medium}\n- 关键词参考：${data.keywords.join("、") || "无特殊要求"}\n- 结构清晰，包含标题、引言、正文、结尾`;
      const response = await generator.chat(
          {
            messages: [
              {
                role: "system",
                content:
                  kind === "rewrite" ? "你是一个资深媒体编辑，擅长事实核查和内容创作。" : "你是一个专业的内容创作助手。请根据用户提供的主题和要求，生成一篇高质量的文章。文章应结构清晰、内容充实、语言流畅。",
              },
              { role: "user", content: prompt },
            ],
            temperature: kind === "rewrite" ? 0.8 : 0.9,
          },
          lifetime.signal,
        ),
        result = (await response.json()) as Row,
        content = result.choices?.[0]?.message?.content || "";
      res.json(
        kind === "rewrite"
          ? {
              content,
              original_length: [...data.content!].length,
              rewritten_length: [...content].length,
            }
          : { content, length: [...content].length },
      );
    });
  app.use("/api", (_req, res) =>
    res.status(404).json({ detail: "接口不存在" }),
  );
  if (options.webDir) {
    app.use(express.static(resolve(options.webDir), { index: false }));
    app.get("/{*path}", (_req, res) =>
      res.sendFile(join(resolve(options.webDir!), "index.html")),
    );
  }
  const onError: ErrorRequestHandler = (error, _req, res, _next) => {
    if (res.headersSent) {
      res.end();
      return;
    }
    const status =
      error instanceof HttpError
        ? error.status
        : error instanceof z.ZodError
          ? 422
          : error instanceof multer.MulterError
            ? 413
            : error.status === 400
              ? 400
              : 500;
    res
      .status(status)
      .json({
        detail:
          error instanceof z.ZodError
            ? error.issues
                .map((i) => `${i.path.join(".")}: ${i.message}`)
                .join("；")
            : errorMessage(error),
      });
  };
  app.use(onError);
  const server = createServer(app);
  try {
    await new Promise<void>((ok, fail) => {
      server.once("error", fail);
      server.listen(options.port ?? 0, "127.0.0.1", () => {
        server.off("error", fail);
        ok();
      });
    });
  } catch (error) {
    store.close();
    throw error;
  }
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("无法启动本地服务");
  origin = `http://127.0.0.1:${address.port}`;
  let versionTimer: NodeJS.Timeout | undefined;
  if (options.workers !== false) {
    store.recover();
    for (const run of store.rows<Run>(
      "SELECT * FROM generation_runs WHERE status='queued' ORDER BY created_at",
    ))
      generator.enqueue(run.id);
    publisher.start();
    versionTimer = setInterval(
      () => {
        void checkVersion(store, version, options.request, lifetime.signal);
      },
      6 * 60 * 60 * 1000,
    );
    versionTimer.unref();
  }
  return {
    app,
    store,
    server,
    origin,
    generator,
    publisher,
    async close() {
      clearInterval(versionTimer);
      lifetime.abort();
      const closed = new Promise<void>((resolve) =>
        server.close(() => resolve()),
      );
      server.closeAllConnections();
      await Promise.allSettled([
        generator.stop(),
        publisher.stop(),
        ...imports,
      ]);
      await closed;
      store.close();
    },
  };
}
