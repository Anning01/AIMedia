import { _electron as electron } from "playwright";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const temp = await mkdtemp(join(tmpdir(), "ai-media-electron-smoke-"));
const env = {
  ...process.env,
  AI_MEDIA_DATA_DIR: temp,
  AI_MEDIA_PORT: "0",
  AI_MEDIA_DISABLE_WORKERS: "1",
};
delete env.ELECTRON_RUN_AS_NODE;
const executablePath = process.env.AI_MEDIA_EXECUTABLE;
let app;
try {
  app = await electron.launch({
    args: executablePath ? [] : ["."],
    ...(executablePath ? { executablePath } : {}),
    env,
    timeout: 30_000,
  });
  app.process().stderr.on("data", (chunk) => {
    if (String(chunk).includes("Error")) process.stderr.write(chunk);
  });
  const page = await app.firstWindow({ timeout: 30_000 });
  await page.waitForURL("**/articles");
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const isolation = await app.evaluate(({ BrowserWindow }) => {
    const prefs =
      BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return {
      contextIsolation: prefs.contextIsolation,
      nodeIntegration: prefs.nodeIntegration,
      sandbox: prefs.sandbox,
    };
  });
  assert.deepEqual(isolation, {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  });
  assert.equal(await page.evaluate(() => typeof window.require), "undefined");
  const apiBase = await page.evaluate(() => window.desktop.apiBase);
  assert.equal((await fetch(apiBase + "/api/admin/config")).status, 401);
  const [platformBrowser] = await Promise.all([
    app.waitForEvent("window"),
    page.evaluate((url) => window.desktop.openBrowserSession("smoke-account", `${url}/api/health`), apiBase),
  ]);
  await platformBrowser.waitForLoadState("domcontentloaded");
  assert.equal(await platformBrowser.evaluate(() => typeof window.require), "undefined");
  const expectedPartition = `persist:ai-media-publish-${createHash("sha256").update("smoke-account").digest("hex").slice(0, 24)}`;
  const platformIsolation = await app.evaluate(({ BrowserWindow, session }, partition) => {
    const target = BrowserWindow.getAllWindows().find(item => item.webContents.getURL().includes("/api/health"));
    const prefs = target?.webContents.getLastWebPreferences();
    return { contextIsolation: prefs?.contextIsolation, nodeIntegration: prefs?.nodeIntegration, sandbox: prefs?.sandbox, expectedSession: target?.webContents.session === session.fromPartition(partition) };
  }, expectedPartition);
  assert.deepEqual({ contextIsolation: platformIsolation.contextIsolation, nodeIntegration: platformIsolation.nodeIntegration, sandbox: platformIsolation.sandbox }, { contextIsolation: true, nodeIntegration: false, sandbox: true });
  assert.equal(platformIsolation.expectedSession, true);
  await platformBrowser.close();
  await page.getByRole("button", { name: "新建文章" }).click();
  await page
    .getByRole("textbox", { name: "文章标题", exact: true })
    .fill("桌面流程验收文章");
  await page.getByRole("button", { name: "确定", exact: true }).click();
  await page
    .getByRole("link", { name: /桌面流程验收文章/ })
    .click();
  await page.locator(".tiptap").waitFor();
  await page.locator(".tiptap").fill("桌面端富文本编辑保存验证。");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByText("1 个版本", { exact: false }).waitFor();
  await page.getByRole("button", { name: "图片", exact: true }).click();
  await page
    .getByRole("textbox", { name: "图片地址", exact: true })
    .fill("https://example.com/image.png");
  await page.getByRole("button", { name: "确定", exact: true }).click();
  assert.equal(await page.locator(".tiptap img").count(), 1);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByText('2 个版本', { exact: false }).waitFor();
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({
    path: resolve("artifacts/article-workspace.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("link", { name: "Skills", exact: true }).first().click();
  await page.waitForURL("**/skills");
  await page.getByRole("button", { name: "导入", exact: true }).waitFor();
  await page.locator('input[type="file"][accept^=".md"]').setInputFiles({
    name: "SKILL.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("---\nname: 烟火气改写\ndescription: 让文章表达更自然\nversion: 1.0.0\npermissions: []\n---\n使用自然、克制的中文改写，避免套话。"),
  });
  await page.getByRole('dialog', { name: '检查 Skill 安装内容' }).waitFor();
  assert.equal(await page.evaluate(async () => (await (await fetch(window.desktop.apiBase + '/api/rewrite-templates')).json()).length), 7);
  await page.screenshot({ path: resolve('artifacts/skill-install-approval.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: '确认安装', exact: true }).click();
  await page.getByRole('dialog', { name: '检查 Skill 安装内容' }).waitFor({ state: 'hidden' });
  await page.getByText("烟火气改写", { exact: true }).first().waitFor();
  await page.screenshot({
    path: resolve("artifacts/skills-install.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("link", { name: "发布记录", exact: true }).first().click();
  await page.waitForURL("**/publishing");
  await page.getByRole("button", { name: "平台与账号", exact: true }).click();
  await page.getByLabel("账号名称").fill("浏览器验收账号");
  await page.getByPlaceholder("例如：微信公众号").fill("微信公众号");
  await page.getByPlaceholder("https://平台发布页").fill("https://mp.weixin.qq.com/");
  await page.getByRole("button", { name: "保存账号", exact: true }).click();
  await page.getByText("浏览器验收账号", { exact: true }).first().waitFor();
  await page.screenshot({ path: resolve("artifacts/browser-account-session.png"), fullPage: true, animations: "disabled" });
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("link", { name: "设置", exact: true }).first().click();
  await page.waitForURL("**/settings");
  await page.getByText("桌面应用", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "复制接入令牌", exact: true })
    .waitFor();
  await page.getByRole("link", { name: "文章", exact: true }).first().click();
  await page.waitForURL("**/articles");
  await page.getByRole("heading", { name: "文章", exact: true }).waitFor();
  await page
    .getByRole("link", { name: /桌面流程验收文章/ })
    .waitFor();
  await page.screenshot({
    path: resolve("artifacts/desktop-smoke.png"),
    fullPage: true,
    animations: "disabled",
  });
  assert.deepEqual(errors, []);
  await app.close();
  app = undefined;
  app = await electron.launch({
    args: executablePath ? [] : ["."],
    ...(executablePath ? { executablePath } : {}),
    env,
    timeout: 30_000,
  });
  const reopened = await app.firstWindow();
  await reopened.waitForURL('**/articles');
  const restoredSkill = await reopened.evaluate(async () => {
    const items = await (await fetch(window.desktop.apiBase + '/api/rewrite-templates')).json();
    return items.find(item => item.name === '烟火气改写');
  });
  assert.equal(restoredSkill?.source, 'file');
  assert.deepEqual(restoredSkill.permissions, []);
  await reopened
    .getByRole("link", { name: /桌面流程验收文章/ })
    .waitFor();
  await reopened
    .getByRole("link", { name: /桌面流程验收文章/ })
    .click();
  await reopened.getByText("2 个版本", { exact: false }).waitFor();
  console.log(
    "Electron smoke passed: isolation, authorization, create, edit, save, image dialog, SKILL.md install, navigation, restart persistence.",
  );
} finally {
  if (app) await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows().forEach(window => window.destroy()); }).catch(() => {});
  await app?.close();
  await rm(temp, { recursive: true, force: true });
}
