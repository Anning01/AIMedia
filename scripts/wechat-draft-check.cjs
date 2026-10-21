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
    const beforeGuard = calls.length;
    await assert.rejects(() => wechat.saveDraft("test-token", { value: "slave_user=account-a" }, "fp", {}, { username: "account-b" }), /身份与目标账号不一致/);
    assert.equal(calls.length, beforeGuard, "identity mismatch must stop before a write request");

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

      // Both tasks begin with account A's stored login, but select separate targets.
      const events = [];
      let rejectSwitch = false, mismatchedSwitch = false, expireOnce = false;
      real.refreshSession = async (_token, _cookies, username, _fp, _appid, accounts) => {
        assert(accounts?.some(a => a.username === username));
        events.push(`select:${username}`);
        await new Promise(resolve => setTimeout(resolve, 5));
        if (rejectSwitch) return { success: false, error: "模拟切号失败" };
        return { success: true, token: `token-${username}`, cookies: `slave_user=${mismatchedSwitch ? 'account-a' : username}; slave_sid=test` };
      };
      real.createDraft = async (token, cookies, _fp, options) => {
        real.assertAccount(cookies, options.username);
        assert.equal(token, `token-${options.username}`);
        events.push(`write:${options.username}`);
        if (expireOnce) { expireOnce = false; return { success: false, errorCode: 200003, error: "invalid session" }; }
        return { success: true, appmsgid: `draft-${options.username}`, cookies };
      };
      const request = username => ({ platform: "wechat", token: "token-account-a", cookie: "slave_user=account-a; slave_sid=test", wechatUsername: username, wechatAccounts: [{username:'account-a'}, {username:'account-b'}], title: username, content: "<p>正文</p>" });
      const results = await Promise.all([handler({}, request('account-a')), handler({}, request('account-b'))]);
      assert(results.every(r => r.ok));
      assert.deepEqual(results.map(r => r.articleId), ['draft-account-a', 'draft-account-b']);
      assert.deepEqual(events, ['select:account-a', 'write:account-a', 'select:account-b', 'write:account-b'], 'target selection and writes cannot interleave');
      assert.equal(results[1].cookies, 'slave_user=account-b; slave_sid=test');
      const writeCount = events.filter(e => e.startsWith('write:')).length;
      rejectSwitch = true;
      assert.equal((await handler({}, request('account-b'))).ok, false);
      rejectSwitch = false; mismatchedSwitch = true;
      assert.equal((await handler({}, request('account-b'))).ok, false);
      assert.equal(events.filter(e => e.startsWith('write:')).length, writeCount, 'failed or mismatched selection must never create a draft');
      mismatchedSwitch = false; expireOnce = true; events.length = 0;
      assert.equal((await handler({}, request('account-b'))).ok, true);
      assert.deepEqual(events, ['select:account-b', 'write:account-b', 'select:account-b', 'write:account-b'], 'session recovery reselects the same target once');
    } finally { Object.assign(real, original); }
    console.log("PASS: WeChat direct publication code absent; article/sticker/create/update stay draft-only; legacy IPC publish flags and session recovery return drafts. No live network requests.");
  } catch (error) { console.error(error);exitCode = 1; }
  finally {
    try { fs.rmSync(directory, { recursive: true, force: true }); }
    catch (error) {
      // Windows keeps Chromium session files locked until Electron exits.
      if (process.platform !== "win32" || !["EBUSY", "EPERM"].includes(error.code)) {
        console.error(error);
        exitCode = 1;
      }
    } finally { app.exit(exitCode); }
  }
});
