import {
  app,
  BrowserWindow,
  Menu,
  dialog,
  ipcMain,
  shell,
  utilityProcess,
  session,
  type UtilityProcess,
} from "electron";
import { createHash, randomBytes } from "node:crypto";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import { prepareWechat, confirmWechat, type WechatPublishContext } from "./publishing/wechat.js";

app.setName("AI Media");
if (process.env.AI_MEDIA_DATA_DIR)
  app.setPath("userData", process.env.AI_MEDIA_DATA_DIR);
let window: BrowserWindow | null = null,
  worker: UtilityProcess | undefined,
  origin = "",
  quitting = false,
  closing = false;
let quitAfterClose: (() => void) | undefined;
const dataDir = join(app.getPath("userData"), "storage"),
  token = randomBytes(32).toString("hex");
const devUrl = !app.isPackaged ? process.env.AI_MEDIA_DEV_URL : undefined;
const pending = new Map<
  number,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>();
const browserSessions = new Map<string, BrowserWindow>();
let sequence = 0;
const locked = app.requestSingleInstanceLock();
if (!locked) app.quit();
else {
  app.on("second-instance", () => {
    if (window?.isMinimized()) window.restore();
    window?.show();
    window?.focus();
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("activate", () => {
    if (origin && !window) void createWindow();
  });
  app.on("before-quit", (event) => {
    if (quitting) return;
    event.preventDefault();
    if (closing) return;
    closing = true;
    // Let the editor reject closing before stopping its backend. A cancelled
    // quit must leave the application able to save and continue working.
    if (window && !window.isDestroyed()) {
      quitAfterClose = () => { quitAfterClose = undefined; stopWorkerAndQuit(); };
      window.once('closed', quitAfterClose);
      window.close();
    } else stopWorkerAndQuit();
  });
  function stopWorkerAndQuit() {
    if (!worker) {
      quitting = true;
      app.quit();
      return;
    }
    worker.once("exit", () => {
      quitting = true;
      app.quit();
    });
    worker.postMessage({ type: "stop" });
    setTimeout(() => {
      worker?.kill();
      quitting = true;
      app.quit();
    }, 5000).unref();
  }
  void app
    .whenReady()
    .then(start)
    .catch((error) => {
      dialog.showErrorBox("AI Media 启动失败", String(error));
      quitting = true;
      worker?.kill();
      app.quit();
    });
}
async function start() {
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  worker = utilityProcess.fork(join(__dirname, "worker.cjs"), [], {
    serviceName: "AI Media 本机服务",
    stdio: "pipe",
  });
  worker.stdout?.on("data", (chunk) => process.stdout.write(chunk));
  worker.stderr?.on("data", (chunk) => process.stderr.write(chunk));
  worker.on(
    "message",
    (message: {
      type: string;
      origin?: string;
      message?: string;
      requestId?: number;
      result?: unknown;
    }) => {
      if (message.requestId) {
        const request = pending.get(message.requestId);
        pending.delete(message.requestId);
        if (message.type === "error")
          request?.reject(new Error(message.message));
        else request?.resolve(message.result);
      }
    },
  );
  worker.on("exit", () => {
    for (const request of pending.values())
      request.reject(new Error("本机服务已退出"));
    pending.clear();
    if (!closing) {
      dialog.showErrorBox(
        "本机服务已停止",
        "请重新打开 AI Media。未完成任务会在下次启动时恢复。",
      );
      quitting = true;
      app.quit();
    }
  });
  origin = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("本机服务启动超时")),
      30_000,
    );
    const receive = (message: {
      type: string;
      origin?: string;
      message?: string;
    }) => {
      if (message.type === "ready" || message.type === "error") {
        clearTimeout(timeout);
        worker!.off("message", receive);
        message.type === "ready"
          ? resolve(message.origin!)
          : reject(new Error(message.message));
      }
    };
    worker!.on("message", receive);
    worker!.postMessage({
      type: "start",
      dataDir,
      webDir: join(app.getAppPath(), "renderer", "dist"),
      token,
      devOrigin: devUrl,
      port: Number(process.env.AI_MEDIA_PORT ?? 8000),
      version: app.getVersion(),
      workers: process.env.AI_MEDIA_DISABLE_WORKERS !== "1",
    });
  });
  const trusted = (url: string) => {
    try {
      return new URL(url).origin === (devUrl || origin);
    } catch {
      return false;
    }
  };
  const validateSender = (event: Electron.IpcMainInvokeEvent) => {
    if (
      !window ||
      event.sender !== window.webContents ||
      !event.senderFrame ||
      !trusted(event.senderFrame.url) ||
      event.senderFrame !== window.webContents.mainFrame
    )
      throw new Error("不允许的桌面请求");
  };
  ipcMain.handle("desktop:import", async (event) => {
    validateSender(event);
    return chooseImport();
  });
  ipcMain.handle("desktop:open-data", async (event) => {
    validateSender(event);
    const error = await shell.openPath(dataDir);
    if (error) throw new Error(error);
  });
  ipcMain.handle("desktop:open-browser-session", async (event, input: unknown) => {
    validateSender(event);
    const value = input as { accountId?: unknown; url?: unknown; preserveExisting?: unknown };
    if (typeof value?.accountId !== "string" || !/^[\w.-]{1,128}$/.test(value.accountId))
      throw new Error("发布账号标识无效");
    if (typeof value.url !== "string") throw new Error("发布页面地址无效");
    let target: URL;
    try {
      target = new URL(value.url);
    } catch {
      throw new Error("发布页面地址无效");
    }
    if (!["http:", "https:"].includes(target.protocol) || target.username || target.password)
      throw new Error("发布页面必须使用安全的 HTTP(S) 地址");
    await openBrowserSession(value.accountId, target.toString(), value.preserveExisting === true);
  });
  ipcMain.handle("desktop:prepare-browser-publish", async (event, scheduleId: unknown) => {
    validateSender(event);
    if (typeof scheduleId !== "string" || !/^[\w-]{1,128}$/.test(scheduleId)) throw new Error("发布记录标识无效");
    const context = await localApi<{ schedule: { status: string; requires_outcome_review: boolean }; account: { id: string; name: string; platform: string; entry_url: string }; article: WechatPublishContext & { version_id: string } }>(`/api/publishing/browser/${scheduleId}/context`);
    if (context.schedule.requires_outcome_review) throw new Error('上次发布结果不明确，请先在发布记录中核对平台结果');
    if (!['awaiting_browser', 'needs_handoff'].includes(context.schedule.status)) throw new Error('该记录当前不能重新填写，请在发布记录中处理');
    const browser = await openBrowserSession(context.account.id, context.account.entry_url, true);
    const result = await prepareWechat(browser, context.article, { mediaOrigin: origin });
    await localApi(`/api/publishing/browser/${scheduleId}/status`, { method: "POST", body: JSON.stringify({ ...result, stage: "prepare" }) });
    return { ...result, scheduleId, preview: { account: { name: context.account.name, platform: context.account.platform }, article: context.article } };
  });
  ipcMain.handle("desktop:confirm-browser-publish", async (event, scheduleId: unknown) => {
    validateSender(event);
    if (typeof scheduleId !== "string" || !/^[\w-]{1,128}$/.test(scheduleId)) throw new Error("发布记录标识无效");
    const context = await localApi<{ account: { id: string }; article: WechatPublishContext }>(`/api/publishing/browser/${scheduleId}/context`),
      browser = browserSessions.get(context.account.id);
    if (!browser || browser.isDestroyed()) throw new Error("公众号浏览器已关闭，请先重新打开并继续填写");
    await localApi(`/api/publishing/browser/${scheduleId}/begin`, { method: "POST", body: "{}" });
    try {
      const result = await confirmWechat(browser, context.article);
      await localApi(`/api/publishing/browser/${scheduleId}/status`, { method: "POST", body: JSON.stringify({ ...result, stage: "confirm" }) });
      return { ...result, scheduleId };
    } catch (error) {
      const result = { status: "needs_handoff" as const, message: `自动操作中断：${String(error)}。请检查公众号页面，系统不会自动重试。` };
      await localApi(`/api/publishing/browser/${scheduleId}/status`, { method: "POST", body: JSON.stringify({ ...result, stage: "confirm" }) }).catch(() => {});
      return { ...result, scheduleId };
    }
  });
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(process.platform === "darwin" ? [{ role: "appMenu" as const }] : []),
      {
        label: "文件",
        submenu: [
          {
            label: "导入数据…",
            click: () => {
              void chooseImport().catch((error) =>
                dialog.showErrorBox("导入失败", String(error)),
              );
            },
          },
          {
            label: "打开数据文件夹",
            click: () => {
              void shell.openPath(dataDir);
            },
          },
          { type: "separator" },
          { role: "close" },
        ],
      },
      { role: "editMenu" },
      { role: "viewMenu" },
      { role: "windowMenu" },
    ]),
  );
  await createWindow();
}
async function createWindow() {
  const ses = session.fromPartition("persist:ai-media");
  const canWriteClipboard = (contents: Electron.WebContents | null, permission: string) =>
    permission === "clipboard-sanitized-write" && Boolean(contents && new URL(contents.getURL()).origin === new URL(devUrl || origin).origin);
  ses.setPermissionRequestHandler((contents, permission, callback) => callback(canWriteClipboard(contents, permission)));
  ses.setPermissionCheckHandler((contents, permission) => canWriteClipboard(contents, permission));
  await ses.cookies.set({
    url: origin,
    name: "ai_media_session",
    value: token,
    httpOnly: true,
    sameSite: "strict",
    path: "/",
  });
  window = new BrowserWindow({
    width: 1380,
    height: 920,
    minWidth: 900,
    minHeight: 640,
    title: "AI Media",
    backgroundColor: "#f4f5f2",
    show: false,
    webPreferences: {
      session: ses,
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      additionalArguments: [`--ai-media-origin=${origin}`],
    },
  });
  const openExternal = (url: string) => {
    try {
      const u = new URL(url);
      if (
        ["http:", "https:"].includes(u.protocol) &&
        !u.username &&
        !u.password
      )
        void shell.openExternal(url);
    } catch {}
  };
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== new URL(devUrl || origin).origin) {
      event.preventDefault();
      openExternal(url);
    }
  });
  window.webContents.on("will-attach-webview", (event) =>
    event.preventDefault(),
  );
  window.webContents.on('will-prevent-unload', event => {
    if (!window) return;
    const choice = dialog.showMessageBoxSync(window, {
      type: 'warning', title: '还有未保存的文章',
      message: '离开会丢失未保存的编辑',
      detail: '可以返回文章保存后再继续；选择放弃只丢弃未保存的编辑，不会删除已保存版本。',
      buttons: ['返回保存', '放弃并继续'], defaultId: 0, cancelId: 0,
    });
    if (choice === 1) event.preventDefault();
    else {
      if (quitAfterClose) window.removeListener('closed', quitAfterClose);
      quitAfterClose = undefined;
      closing = false;
    }
  });
  window.on("closed", () => {
    window = null;
  });
  await window.loadURL(devUrl || origin);
  window.show();
}
async function localApi<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(origin + path, { ...init, headers });
  const body = await response.json().catch(() => ({ detail: response.statusText }));
  if (!response.ok) throw new Error(String(body.detail || "本机服务请求失败"));
  return body as T;
}
async function openBrowserSession(accountId: string, url: string, preserveExisting = false): Promise<BrowserWindow> {
  const existing = browserSessions.get(accountId);
  if (existing && !existing.isDestroyed()) {
    existing.show();
    existing.focus();
    if (!preserveExisting) await existing.loadURL(url);
    return existing;
  }
  const partition = `persist:ai-media-publish-${createHash("sha256").update(accountId).digest("hex").slice(0, 24)}`;
  const ses = session.fromPartition(partition);
  ses.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);
  const browser = new BrowserWindow({
    width: 1240,
    height: 860,
    minWidth: 760,
    minHeight: 560,
    title: "AI Media · 平台登录",
    backgroundColor: "#ffffff",
    show: false,
    webPreferences: {
      session: ses,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  browserSessions.set(accountId, browser);
  browser.webContents.setWindowOpenHandler(({ url: popupUrl }) => {
    try {
      const target = new URL(popupUrl);
      if (!["http:", "https:"].includes(target.protocol)) return { action: "deny" };
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          parent: browser,
          webPreferences: {
            session: ses,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true,
          },
        },
      };
    } catch {
      return { action: "deny" };
    }
  });
  browser.webContents.on("will-navigate", (event, targetUrl) => {
    try {
      if (!["http:", "https:"].includes(new URL(targetUrl).protocol)) event.preventDefault();
    } catch {
      event.preventDefault();
    }
  });
  browser.on("closed", () => browserSessions.delete(accountId));
  await browser.loadURL(url);
  browser.show();
  return browser;
}
async function chooseImport(): Promise<unknown> {
  if (!window || !worker) return null;
  const selected = await dialog.showOpenDialog(window, {
    title: "选择数据文件夹",
    properties: ["openDirectory"],
    buttonLabel: "导入数据",
  });
  if (selected.canceled || !selected.filePaths[0]) return null;
  const requestId = ++sequence;
  const result = await new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject });
    worker!.postMessage({
      type: "import",
      source: selected.filePaths[0],
      dataDir,
      requestId,
    });
  });
  // Imported queued jobs resume on the next launch, avoiding publication during the import review.
  await dialog.showMessageBox(window, {
    type: "info",
    message: "数据已导入",
    detail:
      "已保留当前数据并建立备份。导入的待执行生成和发布计划将在下次启动时继续。",
    buttons: ["完成"],
  });
  window.webContents.reload();
  return result;
}
