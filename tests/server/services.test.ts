import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  rm,
  mkdir,
  writeFile,
  readFile,
  readdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../../electron/server/store.js";
import { normalizeHtml, composeMediaHtml } from "../../electron/server/content.js";
import { Generator, streamDeltas, type Fetch } from "../../electron/server/generation.js";
import {
  nextDailySlot,
  Publisher,
  createSchedule,
  checkVersion,
} from "../../electron/server/publishing.js";
import {
  normalizeArticle,
  resolvePublic,
  CompatibleImageProvider,
} from "../../electron/server/media.js";
import { importStorage } from "../../electron/server/import-storage.js";
import type { Account, Asset, Run, Schedule, Row } from "../../electron/server/types.js";

test("normalization strips scripts/document wrappers and preserves paragraph-index source media", () => {
  const html = normalizeHtml(
    "```html\n<html><head><title>壳</title></head><body><p>一</p><p>二</p><script>bad()</script></body></html>\n```",
  );
  assert.equal(html, "<p>一</p><p>二</p>");
  const asset = (id: string, meta: Row) =>
    ({
      id,
      task_id: null,
      local_path: null,
      mime_type: null,
      created_at: new Date().toISOString(),
      media_type: "image",
      url: `https://example.com/${id}.png`,
      status: "ready",
      alt_text: "",
      metadata_json: { origin: "aimaster", ...meta },
    }) as Asset;
  const result = composeMediaHtml(html, [
    asset("later", { paragraph_index: 0, source_order: 1 }),
    asset("first", { paragraph_index: 0, source_order: 0 }),
  ]);
  assert.ok(result.indexOf("first.png") < result.indexOf("later.png"));
  assert.ok(result.indexOf("later.png") < result.indexOf("<p>二"));
  assert.equal(normalizeHtml("一\n单行\n\n二"), "<p>一<br />单行</p><p>二</p>");
});
test("article aliases deduplicate media and reject unsafe protocols", async () => {
  const result = normalizeArticle({
    body: [{ text: "甲" }, { content: "乙" }],
    imageUrls: ["https://example.com/a.png"],
    media: [
      { url: "https://example.com/a.png" },
      { type: "video", src: "https://example.com/a.mp4", position: 1 },
      { src: "file:///etc/passwd" },
    ],
  });
  assert.deepEqual(result.paragraphs, ["甲", "乙"]);
  assert.equal(result.media.length, 2);
  assert.equal(result.media[1].paragraph_index, 1);
  for (const url of [
    "http://127.0.0.1/x",
    "http://[::1]/x",
    "http://169.254.169.254/x",
    "http://10.0.0.1/x",
    "http://[::ffff:127.0.0.1]/x",
    "file:///etc/passwd",
  ])
    await assert.rejects(resolvePublic(url));
});
test("SSE parser handles UTF-8 byte boundaries, CRLF and truncated streams", async () => {
  const encoded = new TextEncoder().encode(
    'data: {"choices":[{"delta":{"content":"中文"}}]}\r\n\r\ndata: [DONE]\r\n\r\n',
  );
  const stream = new ReadableStream({
    start(controller) {
      for (const byte of encoded) controller.enqueue(Uint8Array.of(byte));
      controller.close();
    },
  });
  let result = "";
  for await (const delta of streamDeltas(new Response(stream))) result += delta;
  assert.equal(result, "中文");
  await assert.rejects(async () => {
    for await (const _delta of streamDeltas(
      new Response('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'),
    )) {
    }
  }, /提前结束/);
});
test("generation persists final draft, keeps search failure nonfatal, and supports non-writing source runs", async (t) => {
  const store = new Store(":memory:");
  t.after(() => store.close());
  store.setConfig("openai_api_key", "test");
  store.setConfig("search_enabled", true);
  const task = store.createTask({
    platform: "x",
    title: "来源",
    content: "正文",
  });
  let calls = 0;
  const request: Fetch = async (_url, init) => {
    calls++;
    const body = JSON.parse(String(init?.body));
    if (body.tools)
      return Response.json({ choices: [{ message: { tool_calls: [] } }] });
    return new Response(
      'data: {"choices":[{"delta":{"content":"<p>生成内容</p>"}}]}\n\ndata: [DONE]\n\n',
    );
  };
  const generator = new Generator(store, "/unused", request),
    run = store.createRun({ task_id: task.id, user_prompt: "改写" });
  await generator.run(run.id, new AbortController().signal);
  assert.equal(store.task(task.id)?.html, "<p>生成内容</p>");
  assert.equal(store.get<Run>("generation_runs", run.id)?.status, "completed");
  assert.equal(calls, 1, "改稿不应在用户确认前自动调用图片模型");
  assert.ok(
    store
      .events(0, run.id)
      .some((e) => e.event_type === "error" && e.payload.scope === "search"),
  );
  const before = store.task(task.id)?.active_version_id,
    sourceOnly = store.createRun({
      source_task_id: task.id,
      kind: "rewrite",
      user_prompt: "只生成结果，不写回文章",
    });
  await generator.run(sourceOnly.id, new AbortController().signal);
  assert.equal(store.task(task.id)?.active_version_id, before);
  assert.equal(
    store.get<Run>("generation_runs", sourceOnly.id)?.partial_html,
    "<p>生成内容</p>",
  );
});
test("a Skill cannot use web search unless it declares that permission", async (t) => {
  const store = new Store(":memory:");
  t.after(() => store.close());
  store.setConfig("openai_api_key", "test");
  store.setConfig("firecrawl_api_key", "search-test");
  store.setConfig("search_enabled", true);
  const task = store.createTask({ platform: "x", title: "标题", content: "正文" });
  store.insert("rewrite_templates", {
    id: "no-search",
    skill_key: "no-search",
    name: "无搜索权限",
    description: "test",
    style_key: null,
    system_prompt: "编辑",
    user_prompt_template: "{content}",
    is_builtin: false,
    enabled: true,
    version: "1.0.0",
    source: "file",
    permissions: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  const urls: string[] = [];
  const generator = new Generator(store, "/unused", async (url) => {
    urls.push(String(url));
    return new Response(
      'data: {"choices":[{"delta":{"content":"<p>完成</p>"}}]}\n\ndata: [DONE]\n\n',
    );
  });
  const run = store.createRun({
    task_id: task.id,
    template_id: "no-search",
    kind: "agent_edit",
    base_html: "<p>正文</p>",
    tool_permissions: [],
    user_prompt: "改写",
  });
  await generator.run(run.id, new AbortController().signal);
  assert.equal(urls.length, 1);
  assert.ok(urls[0].endsWith("/chat/completions"));
  assert.equal(store.events(0, run.id).find(event => event.payload.status === "fact_check_completed")?.payload.report.status, "skipped");
  assert.equal(
    store.events(0, run.id).some((event) => event.event_type === "tool_call"),
    false,
  );
});
test("original media bypasses AI image decision; failed generation never overwrites a draft", async (t) => {
  const s = new Store(":memory:");
  t.after(() => s.close());
  s.setConfig("openai_api_key", "test");
  s.setConfig("search_enabled", false);
  const task = s.createTask({ platform: "x", title: "t", content: "c" });
  s.saveDraft(task.id, "<p>保留</p>", "manual");
  s.createMedia({
    task_id: task.id,
    media_type: "video",
    url: "https://example.com/video.mp4",
    metadata_json: { origin: "aimaster", paragraph_index: 0 },
  });
  const g = new Generator(s, "/unused", async (_url, init) => {
    assert.equal(JSON.parse(String(init?.body)).tools, undefined);
    return new Response(
      'data: {"choices":[{"delta":{"content":"未完成"}}]}\n\n',
    );
  });
  const run = s.createRun({ task_id: task.id, user_prompt: "go" });
  await g.run(run.id, new AbortController().signal);
  assert.equal(s.task(task.id)?.html, "<p>保留</p>");
  assert.equal(s.get<Run>("generation_runs", run.id)?.status, "failed");
});
test("SQLite restart recovery preserves history and safely resumes interrupted work", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "ai-media-recovery-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  let s = new Store(join(dir, "data.db")),
    task = s.createTask({ platform: "x", title: "t", content: "c" }),
    run = s.createRun({ task_id: task.id, user_prompt: "p" });
  s.saveDraft(task.id, "<p>历史</p>", "manual");
  s.update("generation_runs", run.id, { status: "running" });
  s.update("tasks", task.id, { generation_status: "running" });
  const media = s.createMedia({
    task_id: task.id,
    media_type: "image",
    status: "downloading",
    metadata_json: { origin: "aimaster" },
  });
  const account = s.createAccount({ platform: "微信公众号", name: "公众号", adapter: "browser", entry_url: "https://mp.weixin.qq.com/", publish_policy: "manual" });
  const schedule = s.createSchedule({ task_id: task.id, account_id: account.id, policy: "manual" });
  s.update("publish_schedules", schedule.id, { status: "publishing" });
  s.update("tasks", task.id, { publish_status: "publishing" });
  s.close();
  s = new Store(join(dir, "data.db"));
  s.recover();
  assert.equal(s.get<Run>("generation_runs", run.id)?.status, "queued");
  assert.equal(s.task(task.id)?.html, "<p>历史</p>");
  assert.equal(s.get<Asset>("media_assets", media.id)?.status, "failed");
  assert.equal(s.get<Schedule>("publish_schedules", schedule.id)?.status, "needs_handoff");
  assert.match(s.get<Schedule>("publish_schedules", schedule.id)?.last_error ?? "", /不会自动重试/);
  assert.equal(s.task(task.id)?.publish_status, "needs_handoff");
  s.close();
});
test("daily slots honor timezone, occupied times and invalid ranges", () => {
  const date = new Date("2026-09-02T00:00:00Z"),
    first = nextDailySlot(date, ["09:30"], "Asia/Shanghai");
  assert.equal(Date.parse(first), Date.parse("2026-09-02T01:30:00Z"));
  const next = nextDailySlot(
    date,
    ["09:30"],
    "Asia/Shanghai",
    new Set([Date.parse(first)]),
  );
  assert.equal(Date.parse(next), Date.parse("2026-09-03T01:30:00Z"));
  assert.throws(() => nextDailySlot(date, [], "Asia/Shanghai"));
  assert.throws(() => nextDailySlot(date, ["25:00"], "Asia/Shanghai"));
});
test("publisher retries with same idempotency key, applies branding and blocks failed media", async (t) => {
  const s = new Store(":memory:");
  t.after(() => s.close());
  const task = s.createTask({ platform: "x", title: "original", content: "c" });
  s.saveDraft(task.id, "<h1>标题</h1><p>正文</p>", "manual");
  s.update("tasks", task.id, { generation_status: "completed" });
  s.setConfig("branding_header_html", "<p>品牌</p>");
  const publicAccount = s.createAccount({
      platform: "x",
      name: "a",
      webhook_url: "https://example.com/hook",
      credentials: { token: "private" },
    }),
    account = s.account(publicAccount.id)!;
  const schedule = createSchedule(s, task.id, account, "immediate"),
    keys: string[] = [];
  let calls = 0;
  const publisher = new Publisher(s, async (_url, init) => {
    const payload = JSON.parse(String(init?.body));
    assert.ok(payload.html.startsWith("<p>品牌</p>"));
    assert.equal(payload.title, "标题");
    assert.equal(payload.credentials, undefined);
    keys.push(payload.idempotency_key);
    return new Response(++calls === 1 ? "retry" : "ok", {
      status: calls === 1 ? 503 : 200,
    });
  });
  await publisher.publish(schedule);
  assert.equal(
    s.get<Schedule>("publish_schedules", schedule.id)?.status,
    "scheduled",
  );
  await publisher.publish(s.get<Schedule>("publish_schedules", schedule.id)!);
  assert.equal(s.task(task.id)?.publish_status, "published");
  assert.equal(keys[0], keys[1]);
  assert.equal(s.task(task.id)?.html, "<h1>标题</h1><p>正文</p>");
  const failed = s.createMedia({
      task_id: task.id,
      media_type: "image",
      status: "failed",
    }),
    second = createSchedule(s, task.id, account, "immediate");
  await publisher.publish(second);
  assert.equal(calls, 2);
  assert.ok(
    s
      .get<Schedule>("publish_schedules", second.id)
      ?.last_error?.includes("媒体"),
  );
  s.delete("media_assets", failed.id);
});
test("release 304 preserves update availability", async (t) => {
  const s = new Store(":memory:");
  t.after(() => s.close());
  s.setConfig("github_repository", "example/project");
  const first = await checkVersion(s, "0.4.0", async () =>
    Response.json(
      {
        tag_name: "v0.5.0",
        html_url: "https://github.com/example/project/releases",
      },
      { headers: { etag: "example-etag" } },
    ),
  );
  assert.equal(first.update_available, true);
  const second = await checkVersion(
    s,
    "0.4.0",
    async () => new Response(null, { status: 304 }),
  );
  assert.equal(second.update_available, true);
});
test("database import is idempotent, copies media and pauses imported jobs until restart", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "ai-media-import-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const sourceDir = join(dir, "source"),
    targetDir = join(dir, "target"),
    source = new Store(join(sourceDir, "ai_media.db")),
    target = new Store(join(targetDir, "ai_media.db"));
  t.after(() => {
    source.close();
    target.close();
  });
  const task = source.createTask({
    platform: "x",
    title: "旧任务",
    content: "原始",
  });
  await mkdir(join(sourceDir, "media"), { recursive: true });
  const path = join(sourceDir, "media", "source.png");
  await writeFile(path, "image-data");
  const media = source.createMedia({
    task_id: task.id,
    media_type: "image",
    local_path: path,
    url: "http://localhost:8000/api/media/old/content",
  });
  source.saveDraft(task.id, `<p>正文</p><img src="${media.url}">`, "manual");
  source.createRun({ task_id: task.id, user_prompt: "旧任务" });
  source.setConfig("openai_api_key", "old");
  target.setConfig("openai_api_key", "new");
  const first = await importStorage(
    target,
    sourceDir,
    join(targetDir, "media"),
  );
  assert.equal(first.tasks, 1);
  assert.equal(first.media, 1);
  assert.equal(target.config().openai_api_key, "new");
  assert.ok(!target.task(task.id)?.html.includes("localhost:8000"));
  assert.equal(
    await readFile(
      target.get<Asset>("media_assets", media.id)!.local_path!,
      "utf8",
    ),
    "image-data",
  );
  assert.equal(
    target.rows<Run>("SELECT * FROM generation_runs")[0].status,
    "paused_import",
  );
  assert.equal((await readdir(join(targetDir, "backups"))).length, 1);
  const second = await importStorage(
    target,
    sourceDir,
    join(targetDir, "media"),
  );
  assert.equal(second.tasks, 0);
  assert.equal(second.media, 0);
  target.recover();
  assert.equal(
    target.rows<Run>("SELECT * FROM generation_runs")[0].status,
    "queued",
  );
  assert.equal(
    source.rows<Run>("SELECT * FROM generation_runs")[0].status,
    "queued",
  );
});
test("JSON import preserves tasks, accounts and configuration", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "ai-media-json-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const source = join(dir, "source");
  await mkdir(source);
  await writeFile(
    join(source, "tasks.json"),
    JSON.stringify({
      one: {
        id: "one",
        platform: "x",
        original_title: "旧文章",
        original_content: "源文",
        rewritten_content: "旧草稿",
        created_at: "2025-01-01T00:00:00Z",
      },
    }),
  );
  await writeFile(
    join(source, "accounts.json"),
    JSON.stringify([
      { id: "a", platform: "x", name: "旧账号", app_secret: "secret" },
    ]),
  );
  await writeFile(
    join(source, "config.json"),
    JSON.stringify({ llm_model: "old-model" }),
  );
  const store = new Store(join(dir, "new", "ai_media.db"));
  t.after(() => store.close());
  const result = await importStorage(store, source, join(dir, "new", "media"));
  assert.equal(result.tasks, 1);
  assert.equal(result.accounts, 1);
  assert.equal(store.config().llm_model, "old-model");
  assert.ok(store.task("one")?.html.includes("旧草稿"));
});
test("image provider uses runtime config, stores generated PNG and uploads image-edit multipart", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "ai-media-image-test-")),
    store = new Store(":memory:");
  t.after(async () => {
    store.close();
    await rm(dir, { recursive: true, force: true });
  });
  store.setConfig("image_api_key", "image-test-key");
  store.setConfig("image_model", "test-model");
  store.setConfig("image_base_url", "https://provider.example/v1");
  const png =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aip0AAAAASUVORK5CYII=";
  const requests: Array<{ url: string; body: BodyInit | null | undefined }> =
    [];
  const provider = new CompatibleImageProvider(
    store,
    dir,
    async (url, init) => {
      requests.push({ url: String(url), body: init?.body });
      assert.equal(
        (init?.headers as Row).Authorization,
        "Bearer image-test-key",
      );
      return Response.json({
        data: [{ b64_json: png, revised_prompt: "修订提示词" }],
      });
    },
  );
  const generated = await provider.generate({
    prompt: "配图",
    aspect_ratio: "1:1",
    count: 1,
  });
  assert.equal(generated[0].mime_type, "image/png");
  assert.equal(
    (await readFile(generated[0].local_path!)).subarray(0, 4).toString("hex"),
    "89504e47",
  );
  assert.equal(JSON.parse(String(requests[0].body)).model, "test-model");
  assert.equal(JSON.parse(String(requests[0].body)).size, "1024x1024");
  const asset = store.createMedia({ media_type: "image", ...generated[0] });
  await provider.edit(asset, { prompt: "编辑图片" });
  assert.ok(requests[1].url.endsWith("/images/edits"));
  assert.ok(requests[1].body instanceof FormData);
  assert.equal((requests[1].body as FormData).get("prompt"), "编辑图片");
  assert.ok((requests[1].body as FormData).get("image") instanceof Blob);
  store.setConfig("image_api_key", "");
  await assert.rejects(provider.generate({ prompt: "x" }), /API Key/);
});

test("image gateway supports basic parameters and data URL base64 without padding", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "ai-media-image-gateway-"));
  const store = new Store(":memory:");
  t.after(async () => { store.close(); await rm(dir, { recursive: true, force: true }); });
  store.setConfig("image_api_key", " gateway-key ");
  store.setConfig("image_base_url", "https://gateway.example/v1");
  store.setConfig("image_custom_size_quality", false);
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aip0AAAAASUVORK5CYII=";
  const provider = new CompatibleImageProvider(store, dir, async (_url, init) => {
    assert.equal((init!.headers as Row).Authorization, "Bearer gateway-key");
    if (init!.body instanceof FormData) {
      assert.equal(init!.body.has("size"), false);
      assert.equal(init!.body.has("quality"), false);
      assert.ok(init!.body.get("image") instanceof Blob);
    } else {
      const data = JSON.parse(String(init!.body));
      assert.equal(data.size, undefined);
      assert.equal(data.quality, undefined);
      assert.equal(data.n, 1);
    }
    return Response.json({ data: [{ b64_json: `data:image/png;base64,${png.replace(/=+$/, "")}` }] });
  });
  const [result] = await provider.generate({ prompt: "test", count: 1, aspect_ratio: "1:1" });
  assert.deepEqual(await readFile(result.local_path!), Buffer.from(png, "base64"));
  await provider.edit(store.createMedia({ media_type: "image", ...result }), { prompt: "edit" });
  const abort = new AbortController();
  const cancellable = new CompatibleImageProvider(store, dir, async (_url, init) => {
    abort.abort(new Error("application shutdown"));
    init!.signal!.throwIfAborted();
    return Response.json({ data: [] });
  });
  await assert.rejects(cancellable.generate({ prompt: "test" }, abort.signal), /application shutdown/);
});
