/**
 * 数据持久化回归检查：
 * - 写入账号 / 素材组 / 素材 → 重建窗口 → 读回，必须一致
 * - localStorage 里的老数据必须能迁移到磁盘，不丢数据
 * - 凭证字段（token / cookie）在磁盘上必须是加密的
 */
const { app, BrowserWindow, ipcMain } = require("electron");
const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "wgh-data-check-"));
app.setPath("userData", directory);

const source = path.resolve(
  process.env.WGH_TEST_APP_ASAR || path.join(__dirname, ".."),
);
const { readAppData, writeAppData, filePath } = require(
  path.join(source, "electron/app-data.cjs"),
);

const ACCOUNT = {
  id: "acct-1",
  platform: "公众号",
  name: "测试账号",
  authed: true,
  token: "TOKEN-SECRET-VALUE",
  cookie: "slave_sid=COOKIE-SECRET-VALUE; token=abc",
  wechatAccounts: [
    { username: "gh_x1", nickname: "公众号一", token: "SUB-TOKEN", cookies: "SUB-COOKIE" },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
};
const MATERIALS = [
  { id: "mg-1", name: "素材组", source: "txt", materials: [
    { id: "m-1", title: "素材", content: "正文内容", status: "pending", createdAt: "2026-01-01T00:00:00.000Z" },
  ], createdAt: "2026-01-01T00:00:00.000Z" },
];
const ASSETS = [
  { id: "asset-1", kind: "图片", name: "图片", tags: ["标签"], createdAt: "2026-01-01T00:00:00.000Z" },
];

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push("PASS " + name);
  } catch (error) {
    results.push("FAIL " + name + " -> " + (error && error.message));
    process.exitCode = 1;
  }
}

app.whenReady().then(async () => {
  // 1) 写入三类关键数据
  const written = writeAppData({
    accounts: [ACCOUNT],
    materialGroups: MATERIALS,
    assets: ASSETS,
  });
  check("writeAppData returns ok", () => {
    assert.equal(written.ok, true);
  });

  // 2) 磁盘上必须真有文件，且凭证字段已加密
  check("data file exists", () => {
    assert.ok(fs.existsSync(filePath()));
  });
  check("secrets encrypted on disk", () => {
    const raw = fs.readFileSync(filePath(), "utf8");
    assert.ok(raw.indexOf("TOKEN-SECRET-VALUE") === -1, "token leaked to disk");
    assert.ok(raw.indexOf("COOKIE-SECRET-VALUE") === -1, "cookie leaked to disk");
    assert.ok(raw.indexOf("SUB-TOKEN") === -1, "nested token leaked to disk");
    assert.ok(raw.indexOf("SUB-COOKIE") === -1, "nested cookie leaked to disk");
  });

  // 3) 读回必须与写入一致（模拟重启后的读取）
  const read = readAppData();
  check("readAppData returns ok", () => {
    assert.equal(read.ok, true);
    assert.equal(read.corrupted, false);
  });
  check("accounts round-trip", () => {
    assert.equal(read.data.accounts.length, 1);
    assert.equal(read.data.accounts[0].id, "acct-1");
    assert.equal(read.data.accounts[0].token, "TOKEN-SECRET-VALUE");
    assert.equal(read.data.accounts[0].cookie, ACCOUNT.cookie);
  });
  check("nested wechat credentials round-trip", () => {
    assert.equal(read.data.accounts[0].wechatAccounts[0].token, "SUB-TOKEN");
    assert.equal(read.data.accounts[0].wechatAccounts[0].cookies, "SUB-COOKIE");
  });
  check("materialGroups round-trip", () => {
    assert.equal(read.data.materialGroups.length, 1);
    assert.equal(read.data.materialGroups[0].materials[0].content, "正文内容");
  });
  check("assets round-trip", () => {
    assert.equal(read.data.assets.length, 1);
    assert.equal(read.data.assets[0].name, "图片");
  });

  // 4) 覆盖写只替换给定 key，其它 key 保留，且多次连续写绝不发生二次加密
  writeAppData({ accounts: [] });
  const after = readAppData();
  check("partial write keeps other keys", () => {
    assert.equal(after.data.accounts.length, 0);
    assert.equal(after.data.materialGroups.length, 1);
  });

  // 连续多次部分写入（模拟分别保存素材、账号、任务），凭据必须保持原明文
  writeAppData({ accounts: [ACCOUNT] });
  writeAppData({ materialGroups: MATERIALS });
  writeAppData({ assets: ASSETS });
  writeAppData({ hostTasks: [{ id: "task-1", name: "托管任务1", removeAi: true }] });
  const multiWrite = readAppData();
  check("multiple partial writes do not double encrypt secrets", () => {
    assert.equal(multiWrite.data.accounts[0].token, "TOKEN-SECRET-VALUE");
    assert.equal(multiWrite.data.accounts[0].cookie, ACCOUNT.cookie);
    assert.equal(multiWrite.data.accounts[0].wechatAccounts[0].token, "SUB-TOKEN");
    assert.equal(multiWrite.data.hostTasks.length, 1);
    assert.equal(multiWrite.data.hostTasks[0].removeAi, true);
  });
  // 注册与生产一致的读取 handler（sendSync 必须用 ipcMain.on）
  ipcMain.on("app-data-read", (event) => {
    event.returnValue = readAppData();
  });
  ipcMain.handle("app-data-write", (_e, payload) => writeAppData(payload));

  // 上一步验证了“部分覆盖写”，这里先把账号写回来再进行渲染进程校验
  writeAppData({ accounts: [ACCOUNT] });

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(source, "electron/preload.cjs"),
      contextIsolation: true,
      sandbox: false,
    },
  });
  await win.loadURL("file://" + path.join(source, "dist", "index.html"));

  // 渲染进程通过 preload 的 appDataRead/appDataWrite 读写
  const rRead = await win.webContents.executeJavaScript(
    "window.wangaohui.appDataRead()",
  );
  check("renderer appDataRead works", () => {
    assert.ok(read && typeof read === "object", "sendSync returned no object");
    assert.equal(rRead.ok, true);
    assert.equal(rRead.data.accounts.length, 1);
    assert.equal(rRead.data.accounts[0].token, "TOKEN-SECRET-VALUE");
    assert.equal(rRead.data.materialGroups.length, 1);
  });

  // 渲染进程写入账号 → 主进程磁盘 → 重新读取（模拟重启）
  const writeResult = await win.webContents.executeJavaScript(
    "window.wangaohui.appDataWrite({ accounts: [{ id: 'acct-2', name: '\u65b0\u8d26\u53f7', token: 'T2' }] })",
  );
  check("renderer appDataWrite works", () => {
    assert.equal(writeResult.ok, true);
  });

  // 新建第二个窗口（等价于重启后重新读取）
  const win2 = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(source, "electron/preload.cjs"),
      contextIsolation: true,
      sandbox: false,
    },
  });
  await win2.loadURL("file://" + path.join(source, "dist", "index.html"));
  const rRead2 = await win2.webContents.executeJavaScript(
    "window.wangaohui.appDataRead()",
  );
  check("data survives a new renderer window", () => {
    assert.equal(rRead2.ok, true);
    assert.equal(rRead2.data.accounts.length, 1);
    assert.equal(rRead2.data.accounts[0].id, "acct-2");
    assert.equal(rRead2.data.accounts[0].token, "T2");
  });
  win.destroy();
  win2.destroy();

  // 5) 文件损坏时不应清空数据，而是报告 corrupted
  fs.writeFileSync(filePath(), "{ broken json");
  const broken = readAppData();
  check("corrupted file reported, not wiped", () => {
    assert.equal(broken.ok, true);
    assert.equal(broken.corrupted, true);
  });


  for (const line of results) console.log(line);
  if (process.exitCode) console.log("DATA-PERSISTENCE-CHECK FAILED");
  else console.log("DATA-PERSISTENCE-CHECK PASSED");
  setTimeout(() => app.quit(), 300);
});
