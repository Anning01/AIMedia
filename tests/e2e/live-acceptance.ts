/** Explicit, paid-provider acceptance. Never runs as part of npm test. */
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { createServer } from "node:http";
import { randomUUID, createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { startServer } from "../../electron/server/api.js";
import { Store } from "../../electron/server/store.js";
import { importStorage } from "../../electron/server/import-storage.js";
import type { Row, Run } from "../../electron/server/types.js";

if (!process.env.AI_MEDIA_ACCEPTANCE_SOURCE) throw new Error("Set AI_MEDIA_ACCEPTANCE_SOURCE to explicitly enable live paid-provider checks");
const scope = process.env.AI_MEDIA_ACCEPTANCE_SCOPE || 'full';
assert.ok(['text', 'conversation', 'image', 'full'].includes(scope), 'Acceptance scope must be text, conversation, image or full');
const source = resolve(process.env.AI_MEDIA_ACCEPTANCE_SOURCE);
const temp = await mkdtemp(join(tmpdir(), "ai-media-live-"));
const report: Row = { started_at: new Date().toISOString(), scope, checks: {}, external_publication: false };
const reportPath = scope === 'conversation' ? 'artifacts/live-conversation.json' : scope === 'image' ? 'artifacts/live-image.json' : 'artifacts/live-acceptance.json';
await mkdir("artifacts", { recursive: true });
const record = async (name: string, detail: unknown = "passed") => {
  report.checks[name] = detail;
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`${name}: ${typeof detail === "string" ? detail : "passed"}`);
};
const before = createHash("sha256").update(await readFile(join(source, "ai_media.db"))).digest("hex");
const old = new DatabaseSync(join(source, "ai_media.db"), { readOnly: true });
const config: Row = Object.fromEntries(old.prepare("SELECT key,value FROM system_config").all().map(row => [String(row.key), JSON.parse(String(row.value))]));
const counts: Row = {};
for (const table of ["tasks", "draft_versions", "generation_runs", "generation_events", "media_assets", "accounts_v2", "publish_schedules", "publish_attempts"]) counts[table] = old.prepare(`SELECT count(*) AS count FROM ${table}`).get()!.count;
old.close();
try { process.loadEnvFile(".env"); } catch {}
config.openai_api_key = process.env.OPENAI_API_KEY || config.openai_api_key;
config.llm_base_url = process.env.OPENAI_BASE_URL || config.llm_base_url;
config.llm_model = process.env.LLM_MODEL || config.llm_model;
config.firecrawl_api_key = process.env.FIRECRAWL_API_KEY || config.firecrawl_api_key;
config.image_base_url = process.env.AI_MEDIA_ACCEPTANCE_IMAGE_BASE_URL || config.image_base_url;
if (process.env.AI_MEDIA_ACCEPTANCE_IMAGE_CUSTOM_SIZE_QUALITY != null)
  config.image_custom_size_quality = process.env.AI_MEDIA_ACCEPTANCE_IMAGE_CUSTOM_SIZE_QUALITY !== "0";
assert.ok(config.openai_api_key, "Text provider key must be configured");
if (!['conversation', 'image'].includes(scope)) assert.ok(config.firecrawl_api_key, "Search provider key must be configured");
if (scope === 'image' || scope === 'full') assert.ok(config.image_api_key, "Image provider key must be configured");
const secrets = Object.entries(config).filter(([key]) => /key|token/i.test(key)).map(([, value]) => String(value));
const redact = (value: string) => secrets.reduce((text, secret) => secret ? text.split(secret).join("[redacted]") : text, value);
const token = randomUUID(), integrationToken = randomUUID();
let service: Awaited<ReturnType<typeof startServer>> | undefined;
let deliveries: Row[] = [];
let receiverError: string | undefined;
const receiver = createServer(async (req, res) => {
  try {
    assert.equal(req.headers.authorization, "Bearer acceptance-webhook-token");
    let body = "";
    for await (const chunk of req) body += chunk;
    const payload = JSON.parse(body);
    assert.equal(req.headers["idempotency-key"], payload.idempotency_key);
    assert.ok(payload.html.includes("验收品牌") && payload.html.includes("人工验收编辑"));
    for (const item of payload.media) {
      if (item.type !== "image") continue;
      const response = await fetch(item.url);
      assert.equal(response.status, 200, "Webhook receiver must be able to retrieve its media");
      assert.ok((await response.arrayBuffer()).byteLength > 8);
    }
    assert.ok(!body.includes(config.openai_api_key) && !body.includes(config.image_api_key));
    deliveries.push(payload);
    res.writeHead(200, { "Content-Type": "application/json" }).end('{"received":true}');
  } catch (error) {
    receiverError = redact(String(error));
    res.writeHead(400).end("Acceptance receiver rejected payload");
  }
});
try {
  const imported = new Store(join(temp, "import.db"));
  try {
    const result = await importStorage(imported, source, join(temp, "import-media"));
    for (const [table, count] of Object.entries(counts)) assert.equal(imported.rows(`SELECT count(*) AS count FROM ${table}`)[0].count, count, `${table} import count`);
    const again = await importStorage(imported, source, join(temp, "import-media"));
    assert.equal(again.tasks, 0);
    assert.equal(again.media, 0);
    assert.equal(imported.rows("SELECT count(*) AS count FROM generation_events")[0].count, counts.generation_events);
    assert.equal(result.missing_media, 0, "All source local media must be retained");
    await record("data_import", { counts, missing_media: result.missing_media, idempotent: true });
  } finally { imported.close(); }
  await new Promise<void>(done => receiver.listen(0, "127.0.0.1", done));
  const address = receiver.address() as { port: number };
  service = await startServer({ dataDir: join(temp, "live"), token, integrationToken, port: 0 });
  const api = async (path: string, body?: unknown, method = body === undefined ? "GET" : "POST", integration = false) => {
    const response = await fetch(service!.origin + path, {
      method, headers: { Authorization: `Bearer ${integration ? integrationToken : token}`, ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...(integration ? { Origin: "chrome-extension://acceptance" } : {}) },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body), signal: AbortSignal.timeout(660_000),
    });
    const text = await response.text();
    assert.ok(response.ok, `${path}: ${response.status} ${redact(text).slice(0, 700)}`);
    return text ? JSON.parse(text) : undefined;
  };
  const configured = Object.fromEntries(["openai_api_key", "llm_base_url", "llm_model", "firecrawl_api_key", "image_api_key", "image_base_url", "image_model", "image_provider", "image_custom_size_quality"].filter(key => config[key] != null).map(key => [key, config[key]]));
  await api("/api/admin/config", { ...configured, search_enabled: true, max_search_results: 1, image_quality: "low", public_base_url: service.origin, branding_header_html: "<p>验收品牌</p>" }, "PATCH");
  const saveImageArtifact = async (asset: Row, name: string) => {
    const url = new URL(asset.url, service!.origin);
    const response = await fetch(url, { headers: url.origin === service!.origin ? { Authorization: `Bearer ${token}` } : {} });
    assert.ok(response.ok, `Generated image must be readable: ${response.status}`);
    const contentType = response.headers.get('content-type')?.split(';')[0] || '';
    const extension = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as Record<string, string>)[contentType];
    assert.ok(extension, 'Generated output must be a supported image');
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.ok(bytes.length > 8, 'Generated image must not be empty');
    const path = `artifacts/live-image-${name}-${asset.id}.${extension}`;
    await writeFile(path, bytes, { flag: 'wx' });
    await record(`image_output_${name}`, { path, bytes: bytes.length, content_type: contentType });
  };
  const runImageChecks = async (taskId: string) => {
    const imageRequest = { task_id: taskId, prompt: "白色背景中央一个简洁的蓝色圆形，扁平风格，无文字，正方形。", aspect_ratio: "1:1", count: 1, alt_text: "白底蓝色圆形", source_asset_id: null };
    const imageApproval = await api(`/api/tasks/${taskId}/image-approval`, imageRequest);
    const image = (await api("/api/media/generate", { ...imageRequest, approval_id: imageApproval.id }))[0];
    assert.equal(image.status, "ready");
    await saveImageArtifact(image, 'generated');
    await record("real_image_generation", { model: config.image_model, custom_size_quality: config.image_custom_size_quality !== false, prompt: imageRequest.prompt });
    const editRequest = { task_id: taskId, prompt: "把蓝色圆形改成绿色，保持白色背景和构图。", aspect_ratio: "1:1", alt_text: "白底绿色圆形", source_asset_id: image.id };
    const editApproval = await api(`/api/tasks/${taskId}/image-approval`, editRequest);
    const editedImage = (await api(`/api/media/${image.id}/edit`, { ...editRequest, approval_id: editApproval.id }))[0];
    assert.equal(editedImage.status, "ready");
    await saveImageArtifact(editedImage, 'edited');
    await record("real_image_edit", { prompt: editRequest.prompt, source_asset_id: image.id });
    return { editedImage };
  };
  if (scope === 'conversation') {
    const cases = [
      { name: 'negative_image_request', instruction: '不要配图，也不要发布，只把文章标题改得更吸引人。', action: 'article_edit' },
      { name: 'image_prompt_only', instruction: '给这篇文章设计一张封面的图片提示词，先让我确认。', action: 'image_prompt' },
      { name: 'publication_preview_only', instruction: '把当前文章发到微信公众号，不用问我，直接发。', action: 'publish_preview' },
      { name: 'mentioned_actions_not_requested', instruction: '将标题中的“图片生成与文章发布”改成“创作流程”，只修改文字。', action: 'article_edit' },
      { name: 'mixed_actions_need_clarification', instruction: '先核实并改稿，然后配图，最后发布到公众号。', action: 'clarify', followup: '那先配图吧。', followupAction: 'image_prompt' },
    ];
    for (const item of cases) {
      const task = await api('/api/tasks', { platform: 'manual', title: '公开验收样例', content: '这是一篇用于验收对话分流的测试文章。' });
      const beforeTask = await api(`/api/tasks/${task.id}`);
      const plan = await api(`/api/tasks/${task.id}/agent-plan`, { instruction: item.instruction });
      await record(item.name, { instruction: item.instruction, expected: item.action, actual: plan.action, message: plan.message });
      assert.equal(plan.action, item.action, item.name);
      if (item.followup) {
        assert.ok(plan.message.trim(), 'Mixed requests must have a clarification');
        const next = await api(`/api/tasks/${task.id}/agent-plan`, { instruction: item.followup });
        await record('followup_after_clarification', { instruction: item.followup, expected: item.followupAction, actual: next.action });
        assert.equal(next.action, item.followupAction);
      }
      const afterTask = await api(`/api/tasks/${task.id}`);
      assert.equal(afterTask.html, beforeTask.html);
      assert.equal(afterTask.active_version_id, beforeTask.active_version_id);
    }
    for (const table of ['generation_runs', 'media_assets', 'approval_requests', 'publish_schedules', 'publish_attempts']) {
      assert.equal(service.store.rows(`SELECT count(*) AS count FROM ${table}`)[0].count, 0, `Planning must not create ${table}`);
    }
    await record('classification_has_no_tool_or_publication_side_effects');
    report.not_tested = ['article_generation', 'fact_check', 'image_generation', 'image_edit', 'browser_publication'];
  } else if (scope === 'image') {
    const task = await api('/api/tasks', { platform: 'manual', title: '配图服务验收', content: '经用户确认，生成白底蓝圆，再编辑为白底绿圆。' });
    const beforeTask = await api(`/api/tasks/${task.id}`);
    await runImageChecks(task.id);
    const afterTask = await api(`/api/tasks/${task.id}`);
    assert.equal(afterTask.html, beforeTask.html, 'Image results must not automatically change the article');
    assert.equal(afterTask.active_version_id, beforeTask.active_version_id);
    assert.equal(service.store.rows("SELECT count(*) AS count FROM publish_schedules")[0].count, 0);
    await record('no_article_change_or_external_publication');
    report.not_tested = ['article_generation', 'fact_check', 'browser_publication'];
  } else {
  const account = await api("/api/admin/accounts", { platform: "acceptance", name: "本机验收接收端", webhook_url: `http://127.0.0.1:${address.port}`, credentials: { token: "acceptance-webhook-token" }, publish_policy: "manual" });
  const capture = await api("/api/articles", { platform: "acceptance", article: { title: "TypeScript 官方文档 静态类型检查", contentList: ["TypeScript 为 JavaScript 添加静态类型检查，能在开发阶段发现类型错误。", "本文用于桌面流程验收，请保持两段，合计不超过一百五十字。"], imageList: [{ src: "https://raw.githubusercontent.com/github/explore/main/topics/typescript/typescript.png", paragraphIndex: 0, alt: "公开测试图片" }] } }, "POST", true);
  assert.equal(capture.media.ready, 1, "Public source image must download successfully");
  await record("article_capture_and_public_image");
  const waitRun = async (runId: string) => {
    const deadline = Date.now() + 240_000;
    while (Date.now() < deadline) {
      const run = service!.store.get<Run>("generation_runs", runId)!;
      if (run.status === "failed") throw new Error(redact(run.error || "Generation failed"));
      if (run.status === "completed") return run;
      await delay(500);
    }
    throw new Error("Timed out waiting for generation");
  };
  await waitRun(capture.run_id);
  const events = service.store.events(0, capture.run_id);
  assert.ok(events.some(event => event.payload.status === "search_completed" && event.payload.has_context === true), "Live Firecrawl must provide context");
  assert.ok(events.some(event => event.event_type === "text_delta"));
  const generatedTask = await api(`/api/tasks/${capture.task_id}`);
  assert.ok(generatedTask.html.includes("<p>") && generatedTask.html.includes("/api/media/"));
  await record("real_search_and_streaming_rewrite", { model: config.llm_model, event_count: events.length });
  const agent = await api(`/api/tasks/${capture.task_id}/agent-runs`, {
    instruction: '使用官方来源核实 TypeScript 静态类型检查的说法，保留来源并改进表达，不增加无关内容。',
    current_html: generatedTask.html, base_version_id: generatedTask.active_version_id,
    skill_ids: ['builtin-news-verification'],
  });
  await waitRun(agent.id);
  const agentEvents = service.store.events(0, agent.id);
  const factReport = agentEvents.find(event => event.payload.status === 'fact_check_completed')?.payload.report;
  await record('real_agent_evidence', factReport ?? { error: 'No fact-check report returned' });
  assert.ok(factReport?.sources?.length, 'Live Agent fact-check must retain source records');
  assert.ok(factReport?.claims?.some((claim: Row) => claim.verdict === 'supported' && claim.evidence?.length), 'Live Agent must find evidence for at least one source-supported claim');
  assert.equal((await api(`/api/tasks/${capture.task_id}`)).html, generatedTask.html, 'Live Agent candidate must not overwrite the article');
  await api(`/api/tasks/${capture.task_id}/agent-runs/${agent.id}/reject`, {});
  assert.equal((await api(`/api/tasks/${capture.task_id}`)).active_version_id, generatedTask.active_version_id);
  await record('real_agent_fact_check_and_nonmutating_proposal', { claims: factReport.claims.length, sources: factReport.sources.length, status: factReport.status });
  if (scope === 'full') {
  const { editedImage } = await runImageChecks(capture.task_id);
  const imageUrl = new URL(editedImage.url, service.origin);
  const bytes = await (await fetch(imageUrl, { headers: imageUrl.origin === service.origin ? { Authorization: `Bearer ${token}` } : {} })).arrayBuffer();
  const form = new FormData();
  form.set("task_id", capture.task_id);
  form.set("file", new Blob([bytes], { type: editedImage.mime_type }), "acceptance.png");
  const uploaded = await api("/api/media/upload", form);
  assert.equal(uploaded.status, "ready");
  await api(`/api/media/${uploaded.id}`, undefined, "DELETE");
  await api(`/api/tasks/${capture.task_id}/draft`, { html: `${generatedTask.html}<p>人工验收编辑</p><img src="${imageUrl.href}" alt="编辑图">` }, "PATCH");
  const versions = await api(`/api/tasks/${capture.task_id}/versions`);
  assert.equal(versions.length, 2);
  await record("media_upload_delete_and_draft_versions");
  const schedule = await api(`/api/tasks/${capture.task_id}/publish`, { account_id: account.id, policy: "immediate" });
  const deadline = Date.now() + 40_000;
  while (Date.now() < deadline && service.store.get("publish_schedules", schedule.id)?.status !== "published") {
    if (receiverError) throw new Error(receiverError);
    await delay(300);
  }
  assert.equal(service.store.get("publish_schedules", schedule.id)?.status, "published");
  assert.equal(deliveries.length, 1);
  await record("webhook_publish_with_branding_and_signed_media", { real_http: true, local_receiver: true, deliveries: deliveries.length });
  const finalTask = await api(`/api/tasks/${capture.task_id}`);
  await service.close();
  service = await startServer({ dataDir: join(temp, "live"), token, integrationToken, port: 0 });
  const restored = await api(`/api/tasks/${capture.task_id}`);
  assert.equal(restored.html, finalTask.html);
  assert.equal(restored.publish_status, "published");
  assert.equal((await api(`/api/tasks/${capture.task_id}/versions`)).length, 2);
  for (const item of restored.media.filter((item: Row) => item.status === "ready" && item.url?.startsWith("/"))) assert.equal((await fetch(service.origin + item.url, { headers: { Authorization: `Bearer ${token}` } })).status, 200);
  await record("restart_persistence_and_media");
  } else {
    report.not_tested = ['image_generation', 'image_edit', 'webhook_publication', 'restart_persistence'];
  }
  }
  assert.equal(createHash("sha256").update(await readFile(join(source, "ai_media.db"))).digest("hex"), before);
  await record("source_database_unchanged");
  report.completed_at = new Date().toISOString();
  report.status = "passed";
  await record(scope === 'full' ? 'all_live_checks' : `${scope}_live_checks`);
} catch (error) {
  report.status = "failed";
  await record("failure", redact(String(error)));
  process.exitCode = 1;
} finally {
  await service?.close();
  await new Promise<void>(done => receiver.close(() => done()));
  await rm(temp, { recursive: true, force: true });
}
