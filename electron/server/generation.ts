import { composeMediaHtml, normalizeHtml } from "./content.js";
import { Store } from "./store.js";
import { CompatibleImageProvider, type ImageProvider } from "./media.js";
import { errorMessage, type Row, type Run } from "./types.js";
import { searchWithSources } from "./research/search.js";
import { checkFacts, factCheckContext } from "./research/fact-check.js";
import { assertSkillGrants } from "./skill-runtime.js";
import { revisionSource, supersedeProposal } from './article-proposals.js';

export type Fetch = typeof fetch;
const SOURCE_INSTRUCTION =
  "原文包含需要原样保留的图片或视频。请保持原文段落的先后顺序和段落数量，不要生成、替换或描述媒体；系统会按原始段落索引将媒体插回原位置。";
const SEARCH_INSTRUCTION =
  "以下网络检索资料仅用于事实核查和有依据的背景补充。优先采用权威来源；无法核实的信息不得编造。使用检索资料时，在文末以“参考来源”列出标题和 URL。";
export async function* streamDeltas(
  response: Response,
): AsyncGenerator<string> {
  if (!response.body) throw new Error("模型返回了空响应");
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = "",
    doneMarker = false;
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n");
      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = block
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (!data) continue;
        if (data === "[DONE]") {
          doneMarker = true;
          return;
        }
        const chunk = JSON.parse(data) as Row;
        if (chunk.error)
          throw new Error(chunk.error.message || "模型流式响应失败");
        const delta = chunk.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta) yield delta;
      }
      if (done) break;
    }
    if (!doneMarker)
      throw new Error("模型连接提前结束，未收到完成标记，可重新生成");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export class Generator {
  readonly imageProvider: ImageProvider;
  private active = new Map<
    string,
    { abort: AbortController; promise: Promise<void> }
  >();
  private queue: string[] = [];
  private stopping = false;
  constructor(
    readonly store: Store,
    mediaDir: string,
    readonly request: Fetch = fetch,
    imageProvider?: ImageProvider,
  ) {
    this.imageProvider =
      imageProvider ?? new CompatibleImageProvider(store, mediaDir);
  }
  enqueue(runId: string) {
    if (this.stopping || this.active.has(runId) || this.queue.includes(runId))
      return;
    this.queue.push(runId);
    this.pump();
  }
  private pump() {
    while (!this.stopping && this.active.size < 2 && this.queue.length) {
      const runId = this.queue.shift()!,
        abort = new AbortController();
      const promise = this.run(runId, abort.signal).finally(() => {
        this.active.delete(runId);
        this.pump();
      });
      this.active.set(runId, { abort, promise });
    }
  }
  cancelTask(taskId: string) {
    for (const [runId, worker] of this.active)
      if (this.store.get<Run>("generation_runs", runId)?.task_id === taskId)
        worker.abort.abort(new Error("任务已删除"));
    this.queue = this.queue.filter(
      (runId) =>
        this.store.get<Run>("generation_runs", runId)?.task_id !== taskId,
    );
  }
  async stop() {
    this.stopping = true;
    for (const worker of this.active.values())
      worker.abort.abort(new Error("应用正在退出"));
    await Promise.allSettled([...this.active.values()].map((w) => w.promise));
  }
  async chat(body: Row, signal: AbortSignal) {
    const c = this.store.config(),
      key = String(c.openai_api_key || process.env.OPENAI_API_KEY || "").trim();
    if (!key) throw new Error("请先在设置中配置 LLM API Key");
    const response = await this.request(
      `${String(c.llm_base_url || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: c.llm_model || process.env.LLM_MODEL || "gpt-4o-mini",
          ...body,
        }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(180_000)]),
      },
    );
    if (!response.ok)
      throw new Error(
        `模型服务返回 ${response.status}：${(await response.text()).slice(0, 500)}`,
      );
    return response;
  }
  async run(runId: string, signal: AbortSignal) {
    const s = this.store,
      run = s.get<Run>("generation_runs", runId);
    if (!run || run.status !== "queued") return;
    const taskId = run.task_id,
      sourceId = run.source_task_id || taskId;
    const event = (type: string, payload: Row) =>
      s.event(taskId, runId, type, payload);
    try {
      s.update("generation_runs", runId, {
        status: "running",
        partial_html: "",
        error: null,
      });
      if (taskId)
        s.update("tasks", taskId, {
          generation_status: "running",
          error: null,
        });
      event("status", { status: "running" });
      const checkedChat = (body: Row, signal: AbortSignal) => { assertSkillGrants(s, run); return this.chat(body, signal); };
      const checkedRequest: Fetch = (...args) => { assertSkillGrants(s, run); return this.request(...args); };
      assertSkillGrants(s, run);
      if (run.kind === "agent_edit") event("status", { status: "skills_selected", skills: run.skill_snapshot });
      const config = s.config(),
        source = sourceId ? s.task(sourceId) : undefined,
        canSearch = run.tool_permissions.includes("web_search");
      let prompt = run.user_prompt;
      if (run.kind === "agent_edit") {
        const inputHtml = run.parent_run_id && taskId ? revisionSource(s, taskId, run.parent_run_id).partial_html : run.base_html ?? '';
        const instruction = s.events(0, runId).find(item => item.event_type === "agent_message" && item.payload.role === "user")?.payload.content;
        const report = await checkFacts({ runId, baseVersionId: run.base_version_id, html: inputHtml, inputProposalId: run.parent_run_id ?? undefined, instruction: typeof instruction === "string" ? instruction : "",
          skipReason: !canSearch ? "本轮 Skill 未获搜索权限，当前正文未经过网络核查。" : config.search_enabled === false ? "搜索已关闭，当前正文未经过网络核查。" : undefined,
        }, { config, signal, chat: checkedChat, request: checkedRequest, event });
        prompt += `\n\n${factCheckContext(report)}`;
      } else if (canSearch && config.search_enabled !== false && source?.original_title) {
        event("tool_call", {
          name: "web_search",
          arguments: {
            query: source.original_title,
            max_results: config.max_search_results ?? 3,
          },
        });
        try {
          const { context, sources } = await searchWithSources(
            config,
            source.original_title,
            signal,
            this.request,
          );
          if (context)
            prompt += `\n\n【网络检索参考资料】\n${context}\n\n${SEARCH_INSTRUCTION}`;
          event("status", {
            status: "search_completed",
            has_context: Boolean(context),
            query: source.original_title,
            sources,
          });
        } catch (error) {
          signal.throwIfAborted();
          event("error", {
            scope: "search",
            message: errorMessage(error),
            retryable: true,
          });
        }
      }
      const existing = sourceId ? s.media(sourceId) : [],
        hasSource = existing.some((a) => a.metadata_json.origin === "aimaster");
      const response = await checkedChat(
        {
          messages: [
            {
              role: "system",
              content: `${run.system_prompt}\n${hasSource ? SOURCE_INSTRUCTION : ""}\n只输出可直接嵌入编辑器的 HTML 片段，不要输出 Markdown 代码围栏、doctype、html、head 或 body 标签。`,
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          stream: true,
        },
        signal,
      );
      let text = "";
      for await (const delta of streamDeltas(response)) {
        signal.throwIfAborted();
        text += delta;
        if (text.length > 2_000_000) throw new Error("生成内容过长");
        s.update("generation_runs", runId, { partial_html: text });
        event("text_delta", { delta });
      }
      signal.throwIfAborted();
      if (!text.trim()) throw new Error("模型未返回正文");
      assertSkillGrants(s, run);
      const html = composeMediaHtml(normalizeHtml(text), existing),
        version = taskId && run.kind !== "agent_edit"
          ? s.saveDraft(taskId, html, "ai", run.user_prompt)
          : undefined;
      s.transaction(() => {
      supersedeProposal(s, run);
      s.update("generation_runs", runId, {
        status: "completed",
        partial_html: html,
      });
      if (taskId)
        s.update("tasks", taskId, {
          generation_status: "completed",
          error: null,
        });
      event("completed", {
        run_id: runId,
        version_id: version?.id ?? null,
        html,
      });
      if (run.kind === "agent_edit")
        event("agent_message", {
          role: "assistant",
          content: "候选稿已经完成。请审阅后决定是否应用。",
          proposal_html: html,
          base_html: run.base_html,
          base_version_id: run.base_version_id,
          status: "awaiting_approval",
        });
      });
    } catch (error) {
      if (s.get<Run>("generation_runs", runId)?.status === "cancelled") return;
      const status = this.stopping ? "queued" : "failed";
      s.update("generation_runs", runId, {
        status,
        error: this.stopping ? null : errorMessage(error),
      });
      if (taskId)
        s.update("tasks", taskId, {
          generation_status: status,
          error: this.stopping ? null : errorMessage(error),
        });
      if (!this.stopping)
        if (run.kind === "agent_edit")
          event("agent_message", {
            role: "assistant",
            content: "这次处理失败了，原文没有被覆盖。你可以稍后重试。",
            status: "failed",
          });
      if (!this.stopping)
        event("error", {
          scope: "generation",
          message: errorMessage(error),
          retryable: true,
        });
    }
  }
}
