"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert/strict");
const { createRequire } = require("module");
const { ipcMain, app } = require("electron");
const os = require("os");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "wgh-wechat-drafts-"));
app.setPath("userData", directory);
const source = path.resolve(process.env.WGH_TEST_APP_ASAR || path.join(__dirname, ".."));
const file = path.join(source, "electron/wechatMp.cjs");
const code = fs.readFileSync(file, "utf8");
assert(!/masssend|publishWithFallback|freePublish|signProtocolIfNeeded|forPublish/.test(code), "direct WeChat publication implementation must be absent");
const calls = [];
const moduleObject = { exports: {} };
const quiet = { log() {}, warn() {}, error() {} };
vm.runInNewContext(code + `
refreshAuth = async (token, cookies) => ({ success: true, token, cookies, found: true });
requestJson = mockRequest;
uploadImageToCdn = async () => ({url:'https://mmbiz.qpic.cn/test-image',fileId:'image-test'});
`, {
  require: createRequire(file), module: moduleObject, exports: moduleObject.exports,
  console: quiet, Buffer, URL, URLSearchParams, setTimeout, clearTimeout,
  mockRequest: async (url, options) => {
    const pathname = new URL(url).pathname;
    assert(["/cgi-bin/appmsg", "/cgi-bin/operate_appmsg"].includes(pathname), "draft flow must not call any publication route");
    assert(!String(options?.rawBody || "").includes("is_masssend"));
    calls.push({ url, options });
    return { data: { base_resp: { ret: 0 }, appMsgId: "draft-test" }, headers: {} };
  },
});
const wechat = moduleObject.exports;
app.whenReady().then(async () => {
  let exitCode = 0;
  try {
    for (const [postType, content] of [["article", '<p style="color:#123456">中文正文</p>'], ["sticker", "贴图正文"]]) {
      const result = await wechat.createDraft("test-token", "test-cookie", "test-fingerprint", {
        title: "草稿标题", content, postType, forPublish: true, images: ["https://mmbiz.qpic.cn/test-image"],
      });
      assert(result.success);
      assert.equal(result.appmsgid, "draft-test");
      const submitted = calls.at(-1);
      assert.equal(new URL(submitted.url).searchParams.get("sub"), "create");
      if (postType === "article") assert(submitted.options.rawBody.includes(content), "inline article formatting is preserved");
    }
    await wechat.updateDraft("test-token", "test-cookie", "test-fingerprint", "draft-test", "0", { title: "编辑后的草稿", content: "<p>更新正文</p>" });
    assert.equal(new URL(calls.at(-1).url).searchParams.get("sub"), "update");

    // Exercise the real IPC handler with legacy callers requesting direct publish.
    const real = require(path.join(source, "electron/wechatMp.cjs"));
    const original = { ...real };
    try {
      let draftCalls = 0, refreshed = 0, failOnce = false;
      real.createDraft = async (_token, _cookies, _fingerprint, options) => {
        draftCalls++;
        assert(!Object.hasOwn(options, "forPublish"));
        if (failOnce && !refreshed) return { success: false, errorCode: 200003, error: "invalid session" };
        return { success: true, appmsgid: "ipc-draft-test", cookies: "updated-test-cookie" };
      };
      real.refreshAuth = async (token, cookies) => ({ success: true, found: true, token, cookies });
      real.refreshSession = async () => { refreshed++;return { success: true, token: "new-test-token", cookies: "new-test-cookie" }; };
      const handlers = new Map();
      const handle = ipcMain.handle;
      ipcMain.handle = (name, handler) => handlers.set(name, handler);
      try { require(path.join(source, "electron/ipc.cjs")).registerIpc(); } finally { ipcMain.handle = handle; }
      const handler = handlers.get("platform-publish");
      assert(handler);
      for (const saveDraftOnly of [undefined, false, true]) {
        const result = await handler({}, { platform: "wechat", token: "test-token", cookie: "test-cookie", title: "草稿", content: "<p>正文</p>", saveDraftOnly });
        assert.equal(result.ok, true);
        assert.equal(result.method, "draft");
        assert.equal(result.articleId, "ipc-draft-test");
      }
      assert.equal(draftCalls, 3);
      failOnce = true;
      const result = await handler({}, { platform: "wechat", token: "test-token", cookie: "test-cookie", title: "续期草稿", content: "<p>正文</p>", saveDraftOnly: false });
      assert.equal(result.method, "draft");
      assert.equal(refreshed, 1);
      assert.equal(draftCalls, 5, "session recovery only retries draft creation once");
    } finally { Object.assign(real, original); }
    console.log("PASS: WeChat direct publication code absent; article/sticker/create/update stay draft-only; legacy IPC publish flags and session recovery return drafts. No live network requests.");
  } catch (error) { console.error(error);exitCode = 1; }
  finally { fs.rmSync(directory, { recursive: true, force: true });app.exit(exitCode); }
});
