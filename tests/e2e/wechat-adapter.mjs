import { _electron as electron } from 'playwright';
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const temp = await mkdtemp(join(tmpdir(), 'ai-media-wechat-adapter-'));
const entry = join(temp, 'wechat-adapter.cjs');
const env = { ...process.env, AI_MEDIA_TEST_DIR: temp };
delete env.ELECTRON_RUN_AS_NODE;
let app;
try {
  await build({ entryPoints: ['tests/e2e/wechat-adapter-app.ts'], outfile: entry, bundle: true, platform: 'node', format: 'cjs', target: 'node22', external: ['electron'] });
  app = await electron.launch({ args: [entry], env, timeout: 30_000 });
  app.process().stderr.on('data', chunk => process.stderr.write(chunk));
  const page = await app.firstWindow();
  await page.waitForFunction(() => document.title === 'wechat-adapter-passed', undefined, { timeout: 40_000 });
  const report = await page.evaluate(() => window.__wechatReport);
  assert.equal(report.prepared.status, 'awaiting_approval');
  assert.deepEqual(report.filled, { title: '公众号测试标题', body: '正文内容', images: 1 });
  assert.equal(report.confirmed.status, 'published');
  assert.equal(report.changed.status, 'needs_handoff');
  assert.match(report.changed.message, /确认内容不同/);
  for (const [name, guard] of Object.entries(report.finalGuards)) {
    assert.equal(guard.result.status, 'needs_handoff', name);
    assert.equal(guard.finalClicks, 0, `${name}: final confirmation must not be clicked`);
  }
  assert.match(report.finalGuards.title.result.message, /确认内容不同/);
  assert.match(report.finalGuards.body.result.message, /确认内容不同/);
  assert.match(report.finalGuards.image.result.message, /平台托管/);
  assert.match(report.finalGuards.verification.result.message, /安全验证/);
  assert.equal(report.untrusted.status, 'needs_handoff');
  assert.match(report.untrusted.message, /不是微信公众号官方页面/);
  assert.deepEqual(report.untouched, { title: '', body: '' });
  assert.equal(report.login.status, 'needs_handoff');
  assert.match(report.login.message, /完成登录/);
  assert.equal(report.externalImage.status, 'needs_handoff');
  assert.match(report.externalImage.message, /外部直链图片/);
  assert.equal(report.imagePrepared.status, 'awaiting_approval');
  assert.deepEqual(report.pastedImage, { images: 1, src: 'https://mmbiz.qpic.cn/mock-upload.png', markers: 0, body: '图片之前\n\n图片之后' });
  assert.equal(report.restoredClipboard, 'ai-media-clipboard-sentinel');
  assert.equal(report.concurrentClipboard, 'user-copied-during-paste');
  assert.equal(report.failedImagePrepared.status, 'needs_handoff');
  assert.match(report.failedImagePrepared.message, /图片自动粘贴失败/);
  assert.equal(report.failedPasteClipboard, 'ai-media-failed-paste-sentinel');
  assert.equal(report.navigation.prepared.status, 'awaiting_approval');
  assert.deepEqual(report.navigation.prepared.summary.navigation_steps, ['新的创作', '图文消息']);
  assert.equal(report.navigation.publishClicks, 0);
  assert.equal(report.navigation.body, '正文内容');
  assert.match(report.navigation.ambiguous.message, /多个/);
  assert.equal(report.navigation.ambiguousClicks, 0);
  assert.match(report.navigation.unsafe.message, /不安全地址/);
  assert.match(report.navigation.verification.message, /安全验证/);
  assert.equal(report.navigation.verificationTitle, '');
  assert.match(report.navigation.stalled.message, /未能自动进入/);
  assert.equal(report.navigation.stalledClicks, 1);
  assert.equal(report.navigation.retry.status, 'awaiting_approval');
  assert.equal(report.navigation.secondPrepare.status, 'awaiting_approval');
  assert.equal(report.navigation.existingDraft.status, 'needs_handoff');
  assert.match(report.navigation.existingDraft.message, /没有覆盖/);
  assert.deepEqual(report.navigation.preservedDraft, { title: '平台中未保存的标题', body: '平台中未保存的正文' });
  assert.equal(report.navigation.linkedPage.status, 'awaiting_approval');
  assert.deepEqual(report.navigation.linkedPage.summary.navigation_steps, ['新建图文']);
  assert.ok(report.navigation.linkedUrl.endsWith('/navigation-editor'));
  console.log(JSON.stringify({ status: 'passed', checks: ['official_origin_before_article_injection', 'login_handoff', 'semantic_home_to_editor_navigation', 'ambiguous_and_unsafe_navigation_stop', 'verification_before_filling', 'bounded_navigation_and_retry', 'navigation_never_publishes', 'semantic_title_body_fill', 'external_image_handoff', 'local_image_native_paste', 'image_paste_failure_handoff', 'clipboard_restoration', 'separate_final_confirmation', 'pre_click_content_revalidation', 'final_dialog_content_and_verification_guards', 'final_button_visibility_and_ambiguity_guards', 'success_evidence'] }));
} finally {
  if (app) { await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy())).catch(() => {}); await app.close(); }
  await rm(temp, { recursive: true, force: true });
}
