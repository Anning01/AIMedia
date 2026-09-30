import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Layout checks use an isolated desktop database, no models or publishing.
const temp = await mkdtemp(join(tmpdir(), 'ai-media-layout-'));
const env = { ...process.env, AI_MEDIA_DATA_DIR: temp, AI_MEDIA_PORT: '0', AI_MEDIA_DISABLE_WORKERS: '1' };
delete env.ELECTRON_RUN_AS_NODE;
delete env.AI_MEDIA_DEV_URL;
let app, page;
const report = { checks: [], status: 'running' };
const api = async (path, body, method = 'POST') => page.evaluate(async ({ path, body, method }) => {
  const response = await fetch(window.desktop.apiBase + path, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}, { path, body, method });
const checkOverflow = async label => {
  const result = await page.evaluate(() => ({ width: window.innerWidth, content: document.documentElement.scrollWidth }));
  assert.ok(result.content <= result.width + 1, `${label}: horizontal overflow ${JSON.stringify(result)}`);
};
const checkContrast = async (locator, label, pseudo = null) => {
  const ratio = await locator.evaluate((node, pseudo) => {
    const parse = value => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const luminance = value => {
      const [r, g, b] = parse(value).map(channel => channel / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
      return .2126 * r + .7152 * g + .0722 * b;
    };
    let parent = node;
    let background = 'rgba(0, 0, 0, 0)';
    while (parent && /rgba?\([^)]*,\s*0(?:\.0+)?\)/.test(background)) { background = getComputedStyle(parent).backgroundColor; parent = parent.parentElement; }
    const foreground = getComputedStyle(node, pseudo || undefined).color;
    const a = luminance(foreground), b = luminance(background);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  }, pseudo);
  assert.ok(ratio >= 4.5, `${label}: contrast ${ratio.toFixed(2)} is below 4.5`);
};
const snapshot = async name => page.screenshot({ path: resolve(`artifacts/workspace-${name}.png`), animations: 'disabled' });
const checkTheme = async theme => {
  const expected = theme === 'dark'
    ? { canvas: 'rgb(16, 18, 22)', primary: 'rgb(141, 176, 255)', surface: 'rgb(25, 29, 36)' }
    : { canvas: 'rgb(245, 247, 250)', primary: 'rgb(36, 87, 214)', surface: 'rgb(255, 255, 255)' };
  await page.waitForFunction(expected => {
    const primary = document.querySelector('.ui-button--default');
    const surface = document.querySelector('.bg-surface');
    return primary && surface && getComputedStyle(document.body).backgroundColor === expected.canvas &&
      getComputedStyle(primary).backgroundColor === expected.primary && getComputedStyle(surface).backgroundColor === expected.surface;
  }, expected, { timeout: 5000 });
};
const checkFocus = async locator => {
  const target = await locator.elementHandle();
  try { await page.waitForFunction(node => node === document.activeElement, target, { timeout: 5000 }); }
  finally { await target?.dispose(); }
};

try {
  await mkdir('artifacts', { recursive: true });
  app = await electron.launch({ args: ['.'], env, timeout: 30_000 });
  page = await app.firstWindow({ timeout: 30_000 });
  await page.waitForURL('**/articles');
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const task = await api('/api/tasks', { platform: 'manual', title: '窗口与改稿工作区验收：' + '这是一篇用于检查长标题不会挤压界面的文章'.repeat(3), content: '原文' });
  await api(`/api/tasks/${task.id}/draft`, { html: Array.from({ length: 45 }, (_, i) => `<p>第 ${i + 1} 段：核实来源、修改文章并保留用户输入。</p>`).join('') }, 'PATCH');
  const base = await page.evaluate(() => window.desktop.apiBase);
  await page.goto(`${base}/articles/${task.id}`);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('.tiptap').waitFor();
  await page.locator('.tiptap p').first().fill('尚未保存的人工修改');
  const input = page.getByRole('textbox', { name: '向文章 Agent 提出修改要求' });
  await input.fill('尚未发送的要求');
  assert.equal(await page.getByRole('button', { name: '资料', exact: true }).count(), 0);
  assert.equal(await page.getByRole('complementary', { name: '文章资料' }).count(), 1);
  await checkOverflow('wide');
  await checkTheme('light');
  await snapshot('wide');
  await page.getByRole('button', { name: '展开导航', exact: true }).click();
  await checkOverflow('expanded navigation');
  await page.getByRole('button', { name: '收起导航', exact: true }).click();
  report.checks.push('wide_layout_and_collapsible_navigation');

  await page.setViewportSize({ width: 1200, height: 900 });
  await page.getByRole('button', { name: '资料', exact: true }).waitFor();
  assert.equal(await page.getByRole('tablist').count(), 0);
  assert.ok(await input.isVisible());
  await checkOverflow('two columns');
  await checkContrast(page.getByText('手动创建', { exact: true }), 'light muted copy');
  await checkContrast(input, 'light composer placeholder', '::placeholder');
  await snapshot('two-columns');
  const trigger = page.getByRole('button', { name: '资料', exact: true });
  await trigger.click();
  await page.getByRole('dialog', { name: '文章资料' }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: '文章资料' }).waitFor({ state: 'hidden' });
  await checkFocus(trigger);
  await trigger.click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('dialog', { name: '文章资料' }).waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => document.body.style.pointerEvents), '');
  report.checks.push('drawer_escape_focus_and_resize_cleanup');

  await input.focus();
  await page.setViewportSize({ width: 800, height: 900 });
  assert.ok(await input.isVisible(), 'Resizing must retain the focused conversation panel');
  const articleTab = page.getByRole('tab', { name: '正文', exact: true });
  await articleTab.click();
  await page.locator('.workspace-article').evaluate(node => { node.scrollTop = 500; });
  const articleScroll = await page.locator('.workspace-article').evaluate(node => node.scrollTop);
  await articleTab.press('ArrowRight');
  assert.equal(await page.getByRole('tab', { name: '对话', exact: true }).getAttribute('aria-selected'), 'true');
  assert.equal(await input.inputValue(), '尚未发送的要求');
  await page.getByRole('tab', { name: '对话', exact: true }).press('Home');
  assert.equal(await page.locator('.workspace-article').evaluate(node => node.scrollTop), articleScroll);
  assert.equal(await page.locator('.tiptap p').first().innerText(), '尚未保存的人工修改');
  await snapshot('compact-article');
  await page.getByRole('button', { name: '发布', exact: true }).click();
  await page.getByRole('tab', { name: '对话 1 待确认', exact: true }).waitFor();
  await page.getByRole('region', { name: '核对发布内容', exact: true }).waitFor();
  await snapshot('compact-approval');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  assert.equal(await input.inputValue(), '尚未发送的要求');
  report.checks.push('tabs_keyboard_scroll_input_and_approval_access');

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByRole('tab', { name: '正文', exact: true }).click();
    await checkOverflow(`article ${width}`);
    await page.getByRole('tab', { name: '对话', exact: true }).click();
    await checkOverflow(`agent ${width}`);
    const send = await page.getByRole('button', { name: '发送修改要求', exact: true }).boundingBox();
    assert.ok(send && send.y >= 0 && send.y + send.height <= 844, `composer must remain visible at ${width}`);
    if (width === 390) await snapshot('narrow-agent');
  }
  await page.getByRole('button', { name: '切换到深色模式' }).click();
  await checkTheme('dark');
  await snapshot('narrow-dark');
  await page.getByRole('button', { name: '打开导航', exact: true }).click();
  await page.getByRole('dialog', { name: 'AI Media 导航' }).waitFor();
  const motion = await page.evaluate(() => ({
    page: getComputedStyle(document.querySelector('.studio-page')).animationName,
    drawer: getComputedStyle(document.querySelector('.ui-drawer-left')).animationName,
    overlay: getComputedStyle(document.querySelector('.ui-dialog-overlay')).animationName,
  }));
  assert.equal(motion.page, 'studio-page-in');
  assert.equal(motion.drawer, 'studio-left-in');
  assert.equal(motion.overlay, 'studio-overlay-in');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reducedDuration = await page.locator('.ui-drawer-left').evaluate(node => getComputedStyle(node).animationDuration);
  const reducedSeconds = reducedDuration.endsWith('ms') ? Number.parseFloat(reducedDuration) / 1000 : Number.parseFloat(reducedDuration);
  assert.ok(reducedSeconds <= 0.00001, `Reduced animation duration must be effectively zero, received ${reducedDuration}`);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.keyboard.press('Escape');
  await checkFocus(page.getByRole('button', { name: '打开导航', exact: true }));
  report.checks.push('320_and_390_width_dark_theme_and_mobile_navigation');
  report.checks.push('studio_light_and_dark_rendered_palette');
  report.checks.push('page_drawer_overlay_and_reduced_motion_contract');

  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByText('已保存', { exact: true }).waitFor();
  const wechat = await api('/api/admin/accounts', { platform: '微信公众号', name: '窄屏公众号', adapter: 'browser', entry_url: 'https://mp.weixin.qq.com/', publish_policy: 'manual' });
  const browserSchedule = await api(`/api/tasks/${task.id}/publish`, { account_id: wechat.id });
  await api(`/api/publishing/browser/${browserSchedule.id}/status`, { stage: 'prepare', status: 'awaiting_approval', message: '模拟填写完成' });
  await api(`/api/publishing/browser/${browserSchedule.id}/begin`, {});
  await api(`/api/publishing/browser/${browserSchedule.id}/status`, { stage: 'confirm', status: 'needs_handoff', message: '模拟结果不明' });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ['articles', 'skills', 'publishing', 'settings']) {
      await page.goto(`${base}/${route}`, { waitUntil: 'commit' });
      await page.locator('main').waitFor();
      await checkOverflow(`${route} ${width}`);
    }
    await page.goto(`${base}/publishing`, { waitUntil: 'commit' });
    if (width === 390) await checkContrast(page.getByText('查看发布结果、失败原因和需要接管的任务', { exact: true }), 'dark muted copy');
    await page.getByRole('button', { name: '查看步骤', exact: true }).click();
    await page.getByRole('dialog', { name: '公众号执行步骤' }).waitFor();
    await checkOverflow(`publishing timeline ${width}`);
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await page.getByRole('button', { name: '核对发布结果', exact: true }).click();
    await page.getByRole('dialog', { name: '核对公众号发布结果' }).waitFor();
    await checkOverflow(`publishing outcome review ${width}`);
    if (width === 320) await page.screenshot({ path: resolve('artifacts/wechat-outcome-review-narrow.png'), animations: 'disabled' });
    await page.getByRole('button', { name: '暂不处理', exact: true }).click();
    await page.getByRole('button', { name: '平台与账号', exact: true }).click();
    await page.getByRole('dialog', { name: '平台与账号' }).waitFor();
    await page.getByRole('heading', { name: '窄屏公众号', exact: true }).waitFor();
    await page.getByRole('button', { name: '打开公众号', exact: true }).waitFor();
    await checkOverflow(`account drawer ${width}`);
    if (width === 320) await page.screenshot({ path: resolve('artifacts/app-pages-narrow-accounts.png'), animations: 'disabled' });
    await page.keyboard.press('Escape');
    await page.getByRole('dialog', { name: '平台与账号' }).waitFor({ state: 'hidden' });
    await checkFocus(page.getByRole('button', { name: '平台与账号', exact: true }));
  }
  report.checks.push('all_pages_320_and_390_no_overflow_and_dialog_focus');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${base}/articles/${task.id}`, { waitUntil: 'commit' });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(2));
  await page.getByRole('tab', { name: '对话', exact: true }).waitFor();
  await page.getByRole('tab', { name: '对话', exact: true }).click();
  await checkOverflow('200 percent zoom');
  await input.fill('200% 缩放后仍能输入');
  await page.getByRole('button', { name: '发送修改要求', exact: true }).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: '发送修改要求', exact: true }).click({ trial: true });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  report.zoom = await page.evaluate(() => {
    const button = document.querySelector('button[aria-label="发送修改要求"]');
    const box = button.getBoundingClientRect();
    return { width: innerWidth, height: innerHeight, scroll: scrollY, top: box.top, bottom: box.bottom, hit: button.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)) };
  });
  assert.ok(report.zoom.hit && report.zoom.top >= 0 && report.zoom.bottom <= report.zoom.height, 'Zoomed send button must be visible and reachable');
  // Electron's native capture reflects page zoom and scroll accurately; the
  // emulated Playwright screenshot offsets the viewport at non-1 zoom factors.
  const nativeZoom = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));
  await writeFile('artifacts/workspace-zoom-200.png', Buffer.from(nativeZoom, 'base64'));
  assert.equal(await input.inputValue(), '200% 缩放后仍能输入');
  report.checks.push('real_electron_200_percent_zoom');
  assert.deepEqual(errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.error = String(error);
  if (page && !page.isClosed()) await snapshot('failure').catch(() => {});
  process.exitCode = 1;
} finally {
  await writeFile('artifacts/workspace-layout.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (app) {
    await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows().forEach(window => window.destroy()); }).catch(() => {});
    await app.close();
  }
  await rm(temp, { recursive: true, force: true });
}
