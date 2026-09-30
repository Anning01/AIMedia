import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const temp = await mkdtemp(join(tmpdir(), 'ai-media-review-'));
const env = { ...process.env, AI_MEDIA_DATA_DIR: temp, AI_MEDIA_PORT: '0' };
delete env.ELECTRON_RUN_AS_NODE;
delete env.AI_MEDIA_DISABLE_WORKERS;
delete env.AI_MEDIA_DEV_URL;
const prompts = [];
let release, hold = false, article = '<p>Agent 核实后的候选正文。</p>';
const provider = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString());
  if (body.messages[0].content.includes('动作识别器')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ action: 'article_edit', message: '' }) } }] }));
    return;
  }
  prompts.push(body);
  res.writeHead(200, { 'Content-Type': 'text/event-stream' });
  res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: '<div>' } }] })}\n\n`);
  if (hold) await new Promise(resolve => { release = resolve; });
  res.end(`data: ${JSON.stringify({ choices: [{ delta: { content: article + '</div>' } }] })}\n\ndata: [DONE]\n\n`);
});
let app, page;
const report = { checks: [], status: 'running' };
async function until(check, label) {
  for (let i = 0; i < 150; i++) { if (await check()) return; await delay(100); }
  throw new Error(`Timed out: ${label}`);
}
const api = async (path, body, method = body === undefined ? 'GET' : 'POST') => page.evaluate(async ({ path, body, method }) => {
  const response = await fetch(window.desktop.apiBase + path, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
}, { path, body, method });
const snapshot = name => page.screenshot({ path: resolve(`artifacts/article-review-${name}.png`), animations: 'disabled' });

try {
  await mkdir('artifacts', { recursive: true });
  await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
  app = await electron.launch({ args: ['.'], env, timeout: 30_000 });
  page = await app.firstWindow();
  // Electron owns the unsaved-changes confirmation; don't let Playwright's
  // automatic beforeunload acceptance race the native confirmation handler.
  page.on('dialog', () => {});
  await page.waitForURL('**/articles');
  await api('/api/admin/config', { openai_api_key: 'fixture', llm_base_url: `http://127.0.0.1:${provider.address().port}/v1`, llm_model: 'fixture', search_enabled: false }, 'PATCH');
  const task = await api('/api/tasks', { platform: 'manual', title: '改稿差异与版本保护', content: '初始正文' });
  await api(`/api/tasks/${task.id}/draft`, { html: '<p>最初保存的正文。</p>' }, 'PATCH');
  const base = await page.evaluate(() => window.desktop.apiBase);
  await page.goto(`${base}/articles/${task.id}`);
  const editor = page.locator('.tiptap');
  const instruction = page.getByRole('textbox', { name: '向文章 Agent 提出修改要求' });
  const accept = page.getByRole('button', { name: '接受修改', exact: true });
  const discard = page.getByRole('button', { name: '放弃这版', exact: true });
  const run = async message => {
    await instruction.fill(message);
    await page.getByRole('button', { name: '发送修改要求', exact: true }).click();
  };
  // The database may finish before its SSE completion reaches the renderer.
  // A conflict can keep Accept disabled, so wait for its busy state to clear.
  const completed = async () => until(async () => (await api(`/api/tasks/${task.id}`)).generation_status === 'completed' && await accept.count() > 0 && await accept.getAttribute('aria-busy') !== 'true', 'completed proposal rendered');
  await editor.fill('发送前尚未保存的正文。');
  hold = true;
  await run('保留我最新编辑的正文并核实');
  await until(() => prompts.length === 1 && !!release, 'provider received request');
  assert.match(JSON.stringify(prompts[0]), /发送前尚未保存的正文/);
  await page.getByRole('button', { name: '编辑正文', exact: true }).click();
  await editor.fill('Agent 运行期间又作了人工编辑。');
  release(); release = undefined; hold = false;
  await completed();
  assert.ok(await accept.isDisabled());
  assert.equal((await api(`/api/tasks/${task.id}/versions`)).length, 1);
  await page.getByRole('button', { name: '查看修改对比', exact: true }).click();
  await page.getByRole('region', { name: '修改对比', exact: true }).waitFor();
  assert.ok(await page.locator('ins').count());
  assert.ok(await page.locator('del').count());
  await snapshot('local-conflict');
  await discard.click();
  assert.equal(await editor.innerText(), 'Agent 运行期间又作了人工编辑。');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByText('2 个版本', { exact: false }).waitFor();
  report.checks.push('unsaved_snapshot_local_edits_diff_and_rejection');

  await run('在这版基础上修改');
  await completed();
  const firstCandidate = article;
  article = '<p>第二轮迭代候选正文。</p>';
  await run('把候选稿再精简一些');
  await until(() => prompts.length >= 3 && JSON.stringify(prompts.at(-1)).includes(firstCandidate), 'revision receives previous candidate');
  await page.getByText(/第二轮迭代候选正文/).waitFor();
  assert.equal((await api(`/api/tasks/${task.id}/versions`)).length, 2, 'candidate iteration must not save an article version');
  assert.equal((await api(`/api/tasks/${task.id}/agent-history`)).filter(event => event.event_type === 'agent_proposal' && event.payload.status === 'superseded').length, 1);
  report.checks.push('pending_candidate_can_be_revised_without_saving_article');
  // Once a proposal is durable, reload must restore its original comparison base.
  await page.reload();
  await accept.waitFor();
  assert.ok(await accept.isEnabled());
  assert.ok(await page.getByRole('region', { name: '修改对比', exact: true }).isVisible());
  await snapshot('restored-diff');
  report.panelWidths = await page.locator('[aria-label="Agent 对话"] [aria-live]').evaluate(node => ({ visible: node.clientWidth, content: node.scrollWidth }));
  assert.ok(report.panelWidths.content <= report.panelWidths.visible, 'Approval cards must not be clipped horizontally');
  await accept.click();
  await page.getByText('3 个版本', { exact: false }).waitFor();
  assert.ok((await editor.innerText()).includes('第二轮迭代候选正文'));
  report.checks.push('reload_restores_baseline_and_accept_creates_one_version');

  await run('再优化一次');
  await completed();
  await api(`/api/tasks/${task.id}/draft`, { html: '<p>其他窗口保存的新版本。</p>' }, 'PATCH');
  await accept.click();
  await page.getByText(/正文已变更或缺少改稿基准/).waitFor();
  assert.equal((await api(`/api/tasks/${task.id}/versions`)).length, 4);
  assert.ok((await api(`/api/tasks/${task.id}`)).html.includes('其他窗口'));
  assert.ok(await accept.isDisabled());
  await discard.click();
  assert.ok((await editor.innerText()).includes('其他窗口'));
  report.checks.push('server_conflict_rejects_stale_accept_without_overwrite');

  // Delay delivery, not persistence, to exercise user edits during an in-flight save.
  let deliver;
  await page.route(`**/api/tasks/${task.id}/draft`, async route => {
    const response = await route.fetch();
    await new Promise(resolve => { deliver = resolve; });
    await route.fulfill({ response });
  });
  await editor.fill('提交保存时的正文。');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await until(() => !!deliver, 'save response pending');
  await editor.fill('等待保存返回期间又改的正文。');
  deliver();
  await page.getByText('5 个版本', { exact: false }).waitFor();
  await page.unroute(`**/api/tasks/${task.id}/draft`);
  assert.equal(await editor.innerText(), '等待保存返回期间又改的正文。');
  await page.getByRole('link', { name: '返回文章', exact: true }).click();
  await page.getByRole('link', { name: /改稿差异与版本保护/ }).click();
  assert.equal(await editor.innerText(), '等待保存返回期间又改的正文。');
  report.checks.push('inflight_save_and_navigation_keep_dirty_content');

  await app.evaluate(({ dialog, BrowserWindow }) => {
    globalThis.reviewWarningCount = 0;
    dialog.showMessageBoxSync = () => { globalThis.reviewWarningCount++; return 0; };
    BrowserWindow.getAllWindows()[0].close();
  });
  await until(() => app.evaluate(() => globalThis.reviewWarningCount === 1), 'unsaved close warning');
  assert.ok(!page.isClosed());
  assert.equal(await editor.innerText(), '等待保存返回期间又改的正文。');
  await app.evaluate(({ app }) => app.quit());
  await until(() => app.evaluate(() => globalThis.reviewWarningCount === 2), 'cancel full application quit');
  assert.equal((await api(`/api/tasks/${task.id}`)).active_version_id !== null, true);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByText('6 个版本', { exact: false }).waitFor();
  report.checks.push('window_close_and_app_quit_can_be_cancelled_without_stopping_backend');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = String(error);
  if (page && !page.isClosed()) await snapshot('failure').catch(() => {});
  process.exitCode = 1;
} finally {
  release?.();
  await writeFile('artifacts/article-review.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (app) {
    await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows().forEach(window => window.destroy()); }).catch(() => {});
    await app.close();
  }
  await new Promise(resolve => { provider.closeAllConnections(); provider.close(resolve); });
  await rm(temp, { recursive: true, force: true });
}
