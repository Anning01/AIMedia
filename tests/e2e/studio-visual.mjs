import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Real renderer and local API with disposable data. No model calls or publication.
const temporaryData = await mkdtemp(join(tmpdir(), 'ai-media-studio-'));
const output = resolve(process.env.AI_MEDIA_VISUAL_OUTPUT || 'artifacts/studio-redesign-2026-09-10');
const env = { ...process.env, AI_MEDIA_DATA_DIR: temporaryData, AI_MEDIA_PORT: '0', AI_MEDIA_DISABLE_WORKERS: '1' };
delete env.ELECTRON_RUN_AS_NODE;
delete env.AI_MEDIA_DEV_URL;
let app, page;
const errors = [];
const report = { checks: [], screenshots: [], status: 'running' };
const api = async (path, body, method = 'POST') => page.evaluate(async ({ path, body, method }) => {
  const response = await fetch(window.desktop.apiBase + path, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(path + ': ' + response.status);
  return response.json();
}, { path, body, method });
const capture = async name => {
  const path = join(output, name + '.png');
  await page.screenshot({ path, animations: 'disabled' });
  report.screenshots.push(path);
};
const checkOverflow = async label => {
  const result = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  assert.ok(result.scrollWidth <= result.width + 1, label + ': horizontal overflow ' + JSON.stringify(result));
};
const fixtures = [
  { title: '把零散的阅读笔记，整理成清楚的观点', platform: 'manual', content: '先找到值得讨论的问题，再整理相关材料与自己的观察，保留资料的来处。' },
  { title: '文章开头的第一句话，应该留给什么', platform: 'manual', content: '从具体场景进入主题，让读者知道这篇文章关注的问题与自己的关系。' },
  { title: '重读旧稿时，我们究竟在修改什么', platform: 'manual', content: '调整篇章的顺序、核对引用，再删去没有推进论述的段落。' },
  { title: '如何给一篇长文章找到更清晰的结构', platform: 'manual', content: '将背景、问题、证据与观点分别梳理，帮助读者看见每一段之间的联系。' },
  { title: '在日常观察中，找到值得记录的细节', platform: 'manual', content: '从一个动作、一段对话或一个场景开始，记录那些尚未被概括的经验。' },
  { title: '从初稿到发布：一次认真审阅的过程', platform: 'manual', content: '确认事实与来源，检查文章结构、表达和配图，再核对最终发布内容。' },
  { title: '让资料服务于文章，而不是堆满文章', platform: 'manual', content: '每一条引用都应该回应正在讨论的问题，帮助论证向前推进。' },
  { title: '怎样把熟悉的话题讲出新的角度', platform: 'manual', content: '回到具体的问题与自己的观察，重新安排材料，寻找更准确的表达方式。' },
  { title: '留下一点余味：关于文章结尾的笔记', platform: 'manual', content: '结尾可以回到开头的问题，也可以留下一个与全文相关、值得继续思考的细节。' },
  { title: '慢一点，才能看见变化发生的地方', platform: 'manual', content: '把注意力从信息流移回生活。关于观察、记录，以及那些需要时间才能显现的细节。' },
  { title: '一杯咖啡里的城市：重新发现日常生活', platform: 'manual', content: '街角的咖啡馆、雨后的梧桐叶、还没打开的笔记本。每一种熟悉的日常，都藏着值得重新讲述的故事。' },
  { title: '把复杂问题讲清楚，比给出答案更重要', platform: 'manual', content: '真正有用的解释，往往从一个具体的问题开始。试着换一个角度组织材料，让读者看见论证的每一步。' },
  { title: '内容创作的下一步：从收集灵感到建立自己的表达方式', platform: 'aimaster', content: '从零散的阅读笔记，到有逻辑、有细节的完整文章：如何组织资料，筛选观点，再形成自己的表达。' },
  { title: '当 AI 成为写作伙伴，我们如何保留自己的声音', platform: 'manual', content: '好的写作，始于一个真正想要表达的想法。工具可以帮助我们整理资料、调整结构，但观察生活的方式和判断的尺度，仍然属于作者。' },
];
const articleHtml = '<h1>当 AI 成为写作伙伴，我们如何保留自己的声音</h1><p>好的写作，始于一个真正想要表达的想法。工具可以帮助我们整理资料、调整结构，但观察生活的方式和判断的尺度，仍然属于作者。</p><h2>先有自己的问题，再寻找答案</h2><p>与其一开始就要求工具生成一篇完整文章，不如先写下：这一次，我究竟想说什么？从具体的经历和感受出发，内容才有清晰的方向。</p><blockquote><p>让工具处理繁复的过程，把重要的判断留给自己。</p></blockquote><h2>把协作留在可以审阅的范围里</h2><p>一篇文章的完成，是许多次选择的结果。哪些资料值得引用，哪一个段落需要删去，什么样的结尾更有余味，都值得认真推敲。</p><ul><li><p>保留原始观察，明确想要传达的观点。</p></li><li><p>核对关键事实，让每一条引用有迹可循。</p></li><li><p>逐次审阅修改，保留自己的表达节奏。</p></li></ul><p>写作伙伴的价值，是让我们有更多时间回到内容本身。</p>';

try {
  await mkdir(output, { recursive: true });
  app = await electron.launch({ args: ['.'], env, timeout: 30_000 });
  page = await app.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  await page.waitForURL('**/articles');
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.getByText('从第一篇文章开始', { exact: true }).waitFor();
  await capture('articles-empty-light');
  let article;
  for (const fixture of fixtures) {
    article = await api('/api/tasks', fixture);
    await api('/api/tasks/' + article.id + '/draft', { html: fixture === fixtures.at(-1) ? articleHtml : '<h1>' + fixture.title + '</h1><p>' + fixture.content + '</p>' }, 'PATCH');
  }
  const base = await page.evaluate(() => window.desktop.apiBase);
  const routes = [
    ['articles', '/articles', '.article-row'],
    ['workspace', '/articles/' + article.id, '.tiptap'],
    ['skills', '/skills', '.skill-list-item'],
    ['publishing', '/publishing', '.publishing-log'],
    ['settings', '/settings', '#settings-model-title'],
  ];
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.getByRole('button', { name: '切换到深色模式' }).click();
    for (const [name, route, ready] of routes) {
      await page.goto(base + route);
      await page.locator(ready).first().waitFor();
      await checkOverflow(name + ' ' + theme + ' 1440');
      await capture(name + '-' + theme);
    }
  }
  report.checks.push('five_pages_light_and_dark_at_1440');

  await page.goto(base + '/articles');
  await page.locator('.article-row').first().waitFor();
  await page.getByRole('button', { name: '切换到浅色模式' }).click();
  const clamp = await page.locator('.article-row-excerpt').first().evaluate(node => ({ lines: getComputedStyle(node).webkitLineClamp, height: node.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(node).lineHeight) }));
  assert.equal(clamp.lines, '1');
  assert.ok(clamp.height <= clamp.lineHeight + 1, 'The article preview must occupy a single line on desktop');
  await page.getByRole('button', { name: '已发布', exact: true }).click();
  await page.getByText('没有匹配的文章', { exact: true }).waitFor();
  assert.equal(await page.locator('.article-row').count(), 0, 'Completed editing must not count as published');
  await page.getByRole('button', { name: '查看全部文章', exact: true }).click();
  await page.getByRole('textbox', { name: '搜索文章' }).fill('AI Master');
  assert.equal(await page.locator('.article-row').count(), 1);
  await page.getByRole('button', { name: '清空搜索', exact: true }).click();
  assert.equal(await page.locator('.article-row').count(), fixtures.length);
  report.checks.push('real_article_filters_source_search_and_excerpt_clamp');

  await page.setViewportSize({ width: 1474, height: 1048 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  report.density = await page.evaluate(() => {
    const library = document.querySelector('.article-library').getBoundingClientRect();
    const list = document.querySelector('.article-list').getBoundingClientRect();
    const rows = [...document.querySelectorAll('.article-row')].map(node => node.getBoundingClientRect());
    return { width: innerWidth, height: innerHeight, contentLeft: Math.round(library.left), listTop: Math.round(list.top), rowHeight: Math.round(rows[0].height), visibleRows: rows.filter(row => row.top >= 0 && row.bottom <= innerHeight).length };
  });
  assert.ok(report.density.contentLeft <= 200, 'The article list must start close to the navigation');
  assert.ok(report.density.listTop <= 180, 'The article list must not be pushed down by introductory content');
  assert.ok(report.density.rowHeight <= 84, 'Desktop article rows must retain the compact two-line layout');
  assert.ok(report.density.visibleRows >= 10, 'At least ten complete articles must fit this desktop viewport');
  report.checks.push('article_list_position_and_first_screen_density');
  await capture('articles-density-light');

  for (const width of [1200, 800, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, route, ready] of routes) {
      await page.goto(base + route);
      await page.locator(ready).first().waitFor();
      await checkOverflow(name + ' ' + width);
      const undersized = await page.locator('button:visible').evaluateAll(nodes => nodes.flatMap(node => {
        const box = node.getBoundingClientRect();
        return box.height < 43.5 || box.width < 43.5 ? [node.getAttribute('aria-label') || node.textContent] : [];
      }));
      assert.deepEqual(undersized, [], name + ' has small button targets at ' + width);
      if (width === 390) await capture(name + '-narrow-light');
    }
  }
  report.checks.push('five_pages_at_1200_800_390_320_and_44px_buttons');

  await page.getByRole('button', { name: '打开导航', exact: true }).click();
  const navigationDrawer = page.getByRole('dialog', { name: 'AI Media 导航' });
  await navigationDrawer.getByRole('link', { name: 'AI Media 首页' }).click();
  await navigationDrawer.waitFor({ state: 'hidden' });
  await page.waitForURL('**/articles');
  assert.equal(await page.evaluate(() => document.body.style.pointerEvents), '');
  report.checks.push('mobile_brand_navigation_closes_drawer');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + '/articles/' + article.id);
  await page.getByRole('tab', { name: '对话', exact: true }).click();
  await page.locator('.agent-help summary').click();
  assert.ok(await page.locator('.agent-conversation').evaluate(node => node.clientHeight) >= 120);
  const input = page.getByRole('textbox', { name: '向文章 Agent 提出修改要求' });
  await input.fill('请保留我的表达方式');
  const send = page.getByRole('button', { name: '发送修改要求', exact: true });
  await send.scrollIntoViewIfNeeded();
  await send.click({ trial: true });
  await checkOverflow('390 composer with help expanded');
  await capture('agent-help-narrow');
  await page.getByRole('button', { name: '切换到深色模式' }).click();
  await capture('agent-narrow-dark');

  await page.setViewportSize({ width: 320, height: 700 });
  await page.locator('.agent-help summary').click();
  await page.getByRole('button', { name: '发布', exact: true }).click();
  const approval = page.getByRole('region', { name: '核对发布内容', exact: true });
  await approval.waitFor();
  await approval.scrollIntoViewIfNeeded();
  assert.ok(await page.locator('.agent-conversation').evaluate(node => node.clientHeight) >= 120);
  await page.getByRole('button', { name: '取消', exact: true }).scrollIntoViewIfNeeded();
  await capture('approval-narrow-dark');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  assert.equal(await input.inputValue(), '请保留我的表达方式');
  report.checks.push('expanded_help_short_window_approval_and_unsent_input_retention');
  assert.deepEqual(errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.error = String(error);
  if (page && !page.isClosed()) await capture('failure').catch(() => {});
  process.exitCode = 1;
} finally {
  await writeFile(join(output, 'verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (app) {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.destroy())).catch(() => {});
    await app.close();
  }
  await rm(temporaryData, { recursive: true, force: true });
}
