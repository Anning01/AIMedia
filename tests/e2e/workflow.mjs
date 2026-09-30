import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

// Real Electron/Node/SQLite/HTTP, with deterministic local provider responses.
// No production data, external API keys or paid-provider requests are used.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB3sAAAAASUVORK5CYII=", "base64");
const deliveries = [], calls = { chat: 0, generate: 0, edit: 0 };
let failNext = false, receiverError;
const provider = http.createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks);
    if (req.url === "/hook") {
      const data = JSON.parse(raw.toString());
      assert.equal(req.headers.authorization, "Bearer webhook-fixture");
      assert.equal(req.headers["idempotency-key"], data.idempotency_key);
      assert.equal(data.title, "流程验收新标题");
      assert.ok(data.html.includes("人工编辑验收") && data.html.includes("验收品牌"));
      assert.ok(data.media.length > 0);
      for (const media of data.media) {
        const response = await fetch(media.url);
        assert.equal(response.status, 200);
        assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
      }
      assert.ok(!raw.includes(Buffer.from("llm-fixture")));
      deliveries.push(data);
      res.writeHead(200).end("ok");
    } else if (req.url === "/v1/chat/completions") {
      calls.chat++;
      assert.equal(req.headers.authorization, "Bearer llm-fixture");
      const data = JSON.parse(raw.toString());
      if (data.messages[0].content.includes('动作识别器')) {
        const instruction = data.messages.at(-1).content;
        const action = instruction === '帮这篇文章配图' ? 'image_prompt' : instruction === '准备发布这篇文章' ? 'publish_preview' : instruction === '先改稿再配图' ? 'clarify' : 'article_edit';
        if (instruction === '帮这篇文章配图') assert.ok(data.messages.slice(1, -1).some(message => message.content === '先改稿还是先配图？'), 'Follow-up classification receives the clarification exchange');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ action, message: action === 'clarify' ? '先改稿还是先配图？' : '' }) } }] }));
        return;
      }
      if (failNext) { failNext = false; res.writeHead(503).end("Deliberate temporary model failure"); return; }
      if (!data.stream) {
        if (data.messages[1].content.includes('帮这篇文章配图')) assert.ok(data.messages[1].content.includes('人工编辑验收'), 'Image prompt must use unsaved editor text');
        if (data.messages[1].content.includes('验收术语配图')) {
          assert.ok(data.messages[1].content.includes('本轮配图 Skills'), 'Explicit image Skill is included in prompt design');
          assert.ok(data.messages[1].content.includes('references/rules.md') && data.messages[1].content.includes('保留人工编辑验收'), 'Image Skill references are loaded');
        }
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ choices: [{ message: { content: "fixture image prompt" } }] }));
      } else {
        const generatedTitle = calls.chat === 1 ? "流程验收文章" : "流程验收新标题";
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        for (const delta of [`<h1>${generatedTitle}</h1>`, "<p>自动改写第一段。</p>", "<p>自动改写第二段。</p>"]) {
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: delta } }] })}\n\n`);
          await delay(100);
        }
        res.end("data: [DONE]\n\n");
      }
    } else if (["/v1/images/generations", "/v1/images/edits"].includes(req.url)) {
      assert.equal(req.headers.authorization, "Bearer image-fixture");
      if (req.url.endsWith("edits")) {
        calls.edit++;
        assert.match(req.headers["content-type"], /multipart\/form-data; boundary=/);
        assert.ok(raw.includes(png));
      } else calls.generate++;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ data: [{ b64_json: png.toString("base64"), revised_prompt: "fixture" }] }));
    } else res.writeHead(404).end();
  } catch (error) {
    receiverError = String(error);
    res.writeHead(400).end("Fixture validation failed");
  }
});
const temp = await mkdtemp(join(tmpdir(), "ai-media-workflow-"));
const env = { ...process.env, AI_MEDIA_DATA_DIR: temp, AI_MEDIA_PORT: "0" };
delete env.ELECTRON_RUN_AS_NODE;
delete env.AI_MEDIA_DISABLE_WORKERS;
delete env.AI_MEDIA_DEV_URL;
const executablePath = process.env.AI_MEDIA_EXECUTABLE;
let app, page;
const report = { checked_at: new Date().toISOString(), providers: "local HTTP fixtures", packaged: Boolean(executablePath), checks: [] };
const record = async name => {
  report.checks.push(name);
  await writeFile("artifacts/desktop-workflow.json", JSON.stringify(report, null, 2));
  console.log(`${name}: passed`);
};
async function launch() {
  app = await electron.launch({ args: executablePath ? [] : ["."], ...(executablePath ? { executablePath } : {}), env, timeout: 30_000 });
  page = await app.firstWindow({ timeout: 30_000 });
  await page.waitForURL("**/articles");
}
const api = async (path, body, method = body === undefined ? "GET" : "POST") => {
  const result = await page.evaluate(async ({ path, body, method }) => {
    const res = await fetch(window.desktop.apiBase + path, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, text: await res.text() };
  }, { path, body, method });
  assert.ok(result.status < 300, `${path}: ${result.status} ${result.text}`);
  return result.text ? JSON.parse(result.text) : undefined;
};
const until = async (predicate, label) => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (receiverError) throw new Error(receiverError);
    if (await predicate()) return;
    await delay(150);
  }
  throw new Error(`Timed out: ${label}`);
};
const dismissToasts = async () => {
  await page.mouse.move(0, 0);
  await page.waitForFunction(() => document.querySelectorAll('[data-sonner-toast]').length === 0, undefined, { timeout: 15_000 });
};
try {
  await mkdir("artifacts", { recursive: true });
  await new Promise(done => provider.listen(0, "127.0.0.1", done));
  const providerUrl = `http://127.0.0.1:${provider.address().port}`;
  await launch();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const base = await page.evaluate(() => window.desktop.apiBase);
  await api("/api/admin/config", { openai_api_key: "llm-fixture", llm_base_url: providerUrl + "/v1", llm_model: "fixture", search_enabled: false, image_api_key: "image-fixture", image_base_url: providerUrl + "/v1", image_model: "fixture", public_base_url: base, branding_header_html: "<p>验收品牌</p>" }, "PATCH");
  const account = await api("/api/admin/accounts", { platform: "acceptance", name: "流程验收接收端", webhook_url: providerUrl + "/hook", credentials: { token: "webhook-fixture" }, publish_policy: "immediate" });
  const integration = await api("/api/desktop/integration-token");
  const captureResponse = await fetch(base + "/api/articles", { method: "POST", headers: { Authorization: `Bearer ${integration.value}`, Origin: "chrome-extension://acceptance", "Content-Type": "application/json" }, body: JSON.stringify({ platform: "acceptance", article: { title: "流程验收文章", body: "原始文章第一段。\n\n第二段。" } }) });
  assert.equal(captureResponse.status, 200);
  const capture = await captureResponse.json();
  await until(async () => (await api(`/api/tasks/${capture.task_id}`)).generation_status === "completed", "initial capture generation");
  await page.goto(base + `/articles/${capture.task_id}`);
  await page.getByText("1 个版本", { exact: false }).waitFor();
  assert.equal(calls.generate, 0, "Initial rewrite must not generate an image without approval");
  await record("capture_streaming_generation_without_unapproved_image");
  await page.getByRole("textbox", { name: "向文章 Agent 提出修改要求" }).fill("核实全文并优化表达");
  await page.getByRole("button", { name: "发送修改要求" }).click();
  await page.getByRole("button", { name: "接受修改", exact: true }).waitFor();
  await page.screenshot({ path: resolve("artifacts/agent-review.png"), fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "接受修改", exact: true }).click();
  await until(async () => (await api(`/api/tasks/${capture.task_id}/versions`)).length === 2, "accepted agent version");
  await page.getByText("2 个版本", { exact: false }).waitFor();
  assert.ok((await page.locator(".tiptap").innerText()).includes("自动改写第二段"));
  assert.equal((await api(`/api/tasks/${capture.task_id}`)).original_title, "流程验收新标题");
  await record("agent_rewrite_requires_review_and_acceptance");
  await dismissToasts();
  failNext = true;
  await page.getByRole("textbox", { name: "向文章 Agent 提出修改要求" }).fill("再次优化标题");
  await page.getByRole("button", { name: "发送修改要求" }).click();
  await until(async () => (await api(`/api/tasks/${capture.task_id}`)).generation_status === "failed", "model failure");
  assert.equal((await api(`/api/tasks/${capture.task_id}/versions`)).length, 2);
  assert.ok((await api(`/api/tasks/${capture.task_id}`)).html.includes("自动改写"));
  await page.getByText("这次处理失败了，原文没有被覆盖。你可以稍后重试。", { exact: true }).waitFor();
  await dismissToasts();
  await page.getByRole("textbox", { name: "向文章 Agent 提出修改要求" }).fill("再次优化标题");
  await page.getByRole("button", { name: "发送修改要求" }).click();
  await page.getByRole("button", { name: "接受修改", exact: true }).waitFor();
  await page.getByRole("button", { name: "接受修改", exact: true }).click();
  await until(async () => (await api(`/api/tasks/${capture.task_id}/versions`)).length === 3, "accepted retry version");
  await page.getByText("3 个版本", { exact: false }).waitFor();
  await record("model_failure_preserves_draft_and_retry_succeeds");
  await page.getByRole('textbox', { name: '向文章 Agent 提出修改要求' }).fill('先改稿再配图');
  await page.getByRole('button', { name: '发送修改要求' }).click();
  await page.getByText('先改稿还是先配图？', { exact: true }).waitFor();
  assert.equal((await api(`/api/tasks/${capture.task_id}/versions`)).length, 3, 'Clarification must not create a draft');
  await page.locator('.tiptap').locator('p').last().fill("人工编辑验收");
  await page.getByRole("textbox", { name: "向文章 Agent 提出修改要求" }).fill("帮这篇文章配图");
  await page.getByRole("button", { name: "发送修改要求" }).click();
  await page.getByText("fixture image prompt", { exact: true }).waitFor();
  await page.screenshot({ path: resolve("artifacts/image-prompt-approval.png"), fullPage: true, animations: "disabled" });
  assert.equal(calls.generate, 0, "Prompt creation must not generate an image");
  await page.getByRole("button", { name: "确认生成", exact: true }).click();
  await page.getByText("图片已生成，等待选择", { exact: true }).waitFor();
  await page.getByRole("heading", { name: "选择生成结果", exact: true }).waitFor();
  assert.equal(await page.locator('.tiptap img[alt="帮这篇文章配图"]').count(), 0, "Generating must not insert an image");
  await page.getByRole("button", { name: "插入正文", exact: true }).click();
  await page.locator('.tiptap img[alt="帮这篇文章配图"]').waitFor();
  await dismissToasts();
  await page.getByRole('button', { name: '资料', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "uploaded.png", mimeType: "image/png", buffer: png });
  await page.getByText("媒体已加入文章", { exact: true }).waitFor();
  await page.getByRole('button', { name: '关闭资料', exact: true }).click();
  await dismissToasts();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByText("4 个版本", { exact: false }).waitFor();
  await page.reload();
  await page.getByText(/^图片提示词记录（只供查看/).waitFor();
  assert.equal(await page.getByRole('button', { name: '确认生成', exact: true }).count(), 0, 'History restoration cannot resurrect an image approval');
  assert.equal(calls.generate, 1);
  await record('clarification_and_image_history_restore_without_granting_approval');
  const task = await api(`/api/tasks/${capture.task_id}`);
  assert.ok(task.html.includes("人工编辑验收") && !task.html.includes(base));
  const reference = task.media.at(-1);
  assert.ok(reference?.id, "uploaded reference image is available to the article UI");
  await page.getByRole("button", { name: "添加配图", exact: true }).click();
  await page.getByRole("textbox", { name: "希望图片表达什么？" }).fill("根据参考图调整画面");
  await page.getByRole("button", { name: "确定", exact: true }).click();
  await page.getByText("fixture image prompt", { exact: true }).waitFor();
  await page.getByLabel("参考图").selectOption(reference.id);
  await page.locator('img[alt^="图生图参考："]').waitFor();
  assert.equal(calls.edit, 0, "selecting a reference must not call the image-edit provider before approval");
  await page.getByRole("button", { name: "确认图生图", exact: true }).click();
  await page.getByRole("heading", { name: "选择生成结果", exact: true }).waitFor();
  assert.equal(calls.edit, 1, "approved image-to-image uses the edit provider");
  await page.getByRole("button", { name: "暂不插入", exact: true }).click();
  await record("conversation_image_routing_unsaved_snapshot_approval_upload_save_and_image_edit");
  const skillPackage = { files: [
    { path: "SKILL.md", content: "---\nname: 流程验收 Skill\ndescription: 使用验收术语整理文章与配图\nversion: 1.0.0\npermissions: [image_generation]\ntriggers: [验收术语]\n---\n遵循[写作规则](references/rules.md)处理文章与图片提示词。" },
    { path: "references/rules.md", content: "保留人工编辑验收这句话，不增加未经证实的数据。" },
  ] };
  const skillPreview = await api("/api/skills/import/preview", skillPackage);
  const installedSkill = (await api("/api/skills/import", { ...skillPackage, approval_token: skillPreview.approval_token })).skill;
  await page.goto(base + "/skills");
  await page.getByRole("button", { name: /流程验收 Skill/ }).click();
  await page.getByText("references/rules.md", { exact: true }).waitFor();
  await page.goto(base + `/articles/${capture.task_id}`);
  await page.getByLabel("本轮 Skill").selectOption(installedSkill.id);
  await page.getByRole("textbox", { name: "向文章 Agent 提出修改要求" }).fill("请按验收术语整理，不要添加数据");
  await page.getByRole("button", { name: "发送修改要求" }).click();
  await page.getByText(/本轮 Skills：流程验收 Skill/).click();
  await page.getByText("用户在选择器中指定", { exact: true }).waitFor();
  await page.getByRole("button", { name: "放弃这版", exact: true }).click();
  const generatedBeforeSkillPrompt = calls.generate;
  await page.getByRole('button', { name: '添加配图', exact: true }).click();
  await page.getByRole('textbox', { name: '希望图片表达什么？' }).fill('验收术语配图');
  await page.getByRole('button', { name: '确定', exact: true }).click();
  await page.getByRole('heading', { name: '确认图片提示词', exact: true }).waitFor();
  await page.getByText(/本轮 Skills：流程验收 Skill/).waitFor();
  assert.equal(calls.generate, generatedBeforeSkillPrompt, 'Image Skill cannot generate before prompt approval');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  assert.equal(calls.generate, generatedBeforeSkillPrompt, 'Cancelling an image Skill prompt does not generate');
  await record("skill_directory_install_reference_and_visible_explicit_execution");
  await dismissToasts();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("textbox", { name: "向文章 Agent 提出修改要求" }).fill("准备发布这篇文章");
  await page.getByRole("button", { name: "发送修改要求" }).click();
  await page.getByLabel("目标账号").selectOption(account.id);
  assert.equal(deliveries.length, 0, 'A conversation request may only open the preview');
  await page.getByRole("button", { name: "确认发布", exact: true }).click();
  await until(async () => (await api(`/api/tasks/${capture.task_id}`)).publish_status === "published", "publication");
  assert.equal(deliveries.length, 1);
  await record("desktop_publish_branding_signed_media_http_delivery");
  const wechatAccount = await api("/api/admin/accounts", { platform: "微信公众号", name: "公众号验收账号", adapter: "browser", entry_url: "https://mp.weixin.qq.com/", publish_policy: "manual" });
  const timelineTask = await api('/api/tasks', { platform: 'manual', title: '公众号步骤验收文章', content: '公众号步骤验收正文' });
  await api(`/api/tasks/${timelineTask.id}/draft`, { html: '<p>公众号步骤验收正文</p>', base_version_id: null }, 'PATCH');
  const browserSchedule = await api(`/api/tasks/${timelineTask.id}/publish`, { account_id: wechatAccount.id });
  await page.goto(base + "/publishing");
  const browserRecord = page.locator('article').filter({ hasText: '待填写公众号' });
  await browserRecord.getByRole('button', { name: '查看步骤' }).click();
  await page.getByRole('dialog', { name: '公众号执行步骤' }).waitFor();
  await page.getByText('发布内容已锁定，等待打开公众号并填写', { exact: true }).waitFor();
  await page.screenshot({ path: resolve("artifacts/wechat-publish-timeline.png"), fullPage: true, animations: "disabled" });
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await api(`/api/publishing/browser/${browserSchedule.id}/status`, { stage: 'prepare', status: 'awaiting_approval', message: '模拟填写完成' });
  await api(`/api/publishing/browser/${browserSchedule.id}/begin`, {});
  await api(`/api/publishing/browser/${browserSchedule.id}/status`, { stage: 'confirm', status: 'needs_handoff', message: '模拟发布结果不明，请先人工核对' });
  const blockedPrepare = await page.evaluate(async id => {
    try { await window.desktop.prepareBrowserPublish(id); return 'unexpected success'; }
    catch (error) { return String(error); }
  }, browserSchedule.id);
  assert.match(blockedPrepare, /核对平台结果/, 'desktop must reject a repeated fill before opening a browser');
  await page.reload();
  await page.getByRole('button', { name: '核对发布结果', exact: true }).click();
  const resultReview = page.getByRole('dialog', { name: '核对公众号发布结果' });
  await resultReview.waitFor();
  assert.equal(await resultReview.getByRole('button', { name: '确认未发布，允许重新填写' }).isEnabled(), false);
  await resultReview.getByRole('checkbox').check();
  await page.screenshot({ path: resolve('artifacts/wechat-outcome-review.png'), fullPage: true, animations: 'disabled' });
  await resultReview.getByRole('button', { name: '确认未发布，允许重新填写' }).click();
  await until(async () => (await api(`/api/publishing/browser/${browserSchedule.id}/context`)).schedule.status === 'awaiting_browser', 'manual outcome review');
  await api(`/api/publishing/schedules/${browserSchedule.id}`, undefined, "DELETE");
  await record("wechat_locked_version_timeline_and_explicit_outcome_review");
  await page.screenshot({ path: resolve("artifacts/desktop-workflow.png"), fullPage: true });
  const finalTask = await api(`/api/tasks/${capture.task_id}`);
  assert.deepEqual(errors, []);
  await app.close(); app = undefined;
  await launch();
  assert.equal((await api(`/api/desktop/integration-token`)).value, integration.value);
  const restored = await api(`/api/tasks/${capture.task_id}`);
  assert.equal(restored.html, finalTask.html);
  assert.equal(restored.publish_status, "published");
  await page.goto((await page.evaluate(() => window.desktop.apiBase)) + `/articles/${capture.task_id}`);
  await page.getByText("5 个版本", { exact: false }).waitFor();
  assert.equal(await page.getByText(/^图片提示词记录（只供查看/).count(), 3, 'Image conversations and Skill-guided prompts survive the app restart');
  assert.equal(await page.getByText('先改稿还是先配图？', { exact: true }).count(), 1);
  await page.waitForFunction(() => [...document.querySelectorAll(".tiptap img")].every(img => img.naturalWidth > 0));
  assert.equal(deliveries.length, 1);
  await record("restart_retains_drafts_assets_publication_and_integration_token");
  report.status = "passed";
  report.provider_calls = calls;
  await writeFile("artifacts/desktop-workflow.json", JSON.stringify(report, null, 2));
} catch (error) {
  report.status = "failed";
  report.error = String(error);
  await writeFile("artifacts/desktop-workflow.json", JSON.stringify(report, null, 2));
  throw error;
} finally {
  if (app) await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows().forEach(window => window.destroy()); }).catch(() => {});
  await app?.close();
  await new Promise(done => { provider.closeAllConnections(); provider.close(() => done()); });
  await rm(temp, { recursive: true, force: true });
}
