"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "wgh-toutiao-images-"));
const root = path.resolve(process.env.WGH_TEST_APP_ASAR || path.join(__dirname, ".."));
const quiet = { log() {}, warn() {}, error() {} };
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jftkAAAAASUVORK5CYII=", "base64");

function evaluate(file, overrides, extra = "") {
  const localRequire = createRequire(file);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8") + extra, {
    require: name => Object.hasOwn(overrides, name) ? overrides[name] : localRequire(name),
    module, exports: module.exports, console: quiet, Buffer, URL, URLSearchParams,
    FormData, Blob, AbortSignal, fetch: mockFetch, setTimeout, clearTimeout,
  }, { filename: file });
  return module.exports;
}

let uploads = [], writes = [], failUpload = false, failCover = false, omitUrl = false, downloadUrls = [], partitions = [], destroyed = 0, activeWindows = 0, useOfficialClient = false, draftFailure = false, invalidArticleId = false;
const json = value => ({ ok: true, status: 200, text: async () => JSON.stringify(value), json: async () => value });
async function mockFetch(url, opts = {}) {
  const parsed = new URL(url);
  if (parsed.hostname === 'xxbg.snssdk.com') return { text: async () => '_callback("test")' };
  if (parsed.pathname === '/tt-anti-token') return json({errno: 0, data: {token: 'mock-submit-token'}});
  if (parsed.pathname === '/spice/image') {
    assert.equal(opts.headers.Cookie, 'passport_csrf_token=test; sessionid=account-a');
    const cover = parsed.searchParams.get('need_cover_url') === '1';
    if (failUpload || (cover && failCover)) return json({code: -1, message: '模拟上传拒绝'});
    const file = opts.body.get('image');
    if (!cover) {
      assert(file instanceof Blob);
      assert.equal(file.type, 'image/png');
      assert.deepEqual(Buffer.from(await file.arrayBuffer()), png);
      uploads.push(file);
    }
    return json({ code: 0, data: { image_uri: `${cover ? 'cover' : 'uploaded'}-${uploads.length}`, image_url: omitUrl ? '' : `https://p3.test/image-${uploads.length}.png`, cover_url: `https://p3.test/cover-${uploads.length}.png`, image_width: 800, image_height: 600 } });
  }
  if (parsed.pathname === '/mp/agw/article/new') return json({code: 0, data: {media_id: 'account-a'}});
  if (parsed.pathname === '/mp/agw/article/publish') {
    if (!opts.headers.Cookie) assert.equal(opts.headers['tt-anti-token'], 'mock-submit-token');
    const form = new URLSearchParams(opts.body);
    writes.push(form);
    if (draftFailure && form.get('save') === '0') return json({code:7050,message:'保存失败'});
    return json({code: 0, data: {pgc_id: invalidArticleId ? '0' : 'draft-a'}});
  }
  if (parsed.hostname === 'images.test') {
    downloadUrls.push(url);
    return {ok: true, headers: new Headers({'content-type':'image/png'}), arrayBuffer: async () => png};
  }
  throw new Error(`Unexpected network request: ${url}`);
}
const images = evaluate(path.join(root, 'electron/images.cjs'), {
  electron: {app: { getPath: () => directory }, protocol: {registerSchemesAsPrivileged() {} }},
});
class FakeXMLHttpRequest {
  constructor() { this.headers = {}; }
  open(method, url) { this.method = method; this.url = url; }
  setRequestHeader(name, value) { this.headers[name] = value; }
  async send(body) {
    try {
      assert.equal(this.withCredentials, true);
      const response = await mockFetch(this.url, {method: this.method, headers: this.headers, body});
      this.status = response.status;
      this.responseText = await response.text();
      this.onload();
    } catch(error) { this.onerror(error); }
  }
}
class FakeWindow {
  constructor(options) {
    assert.equal(options.webPreferences.partition, partitions.at(-1));
    assert.equal(++activeWindows, 1, 'shared login session operations cannot overlap');
    const officialClient = {
      async get(url, config) {return (await mockFetch(url, config)).json();},
      async post(url, body, config) {
        assert.equal(typeof body, 'string', 'official client skips object serialization when Content-Type is explicit');
        assert(!Object.keys(config.headers).some(key => key.toLowerCase() === 'x-secsdk-csrf-token'), 'leave signed CSRF headers to the official Web SDK');
        return (await mockFetch(url, {...config, body})).json();
      },
    };
    this.webContents = {setUserAgent() {}, executeJavaScript: script => vm.runInNewContext(script, {window: useOfficialClient ? {Garr:{network:officialClient}} : {}, XMLHttpRequest: FakeXMLHttpRequest, URLSearchParams})};
  }
  async loadURL() {}
  isDestroyed() { return false; }
  destroy() { destroyed++; activeWindows--; }
}
const electron = {BrowserWindow: FakeWindow, session: {fromPartition(name) {
  assert.equal(name, 'persist:pub-toutiao', 'reuse the original login Web SDK device state');
  partitions.push(name);
  return {async clearStorageData() {}, cookies: {async get() {return [{name:'passport_csrf_token',value:'stale-path-cookie'}];}, async set() {}, async flushStore() {}}};
}}};
const loadToutiao = browser => evaluate(path.join(root, 'electron/toutiao.cjs'), {electron: browser ? electron : null, './images.cjs': images, './fingerprint.cjs': {hardenLoginWebContents: async () => false}}, `
sleep = randomDelay = async () => {};
module.exports.prepareToutiaoContent = prepareToutiaoContent;
`);
const cookie = 'passport_csrf_token=test; sessionid=account-a';

(async () => {
  try {
    const {url} = await images.saveImageFromDataUrl(`data:image/png;base64,${png.toString('base64')}`, 'library');
    const toutiao = loadToutiao(false);
    const original = `<p style="color:#123456">正文</p><img data-src="ignored" src='${url}' /><img src="${url}" />`;
    const prepared = await toutiao.prepareToutiaoContent(cookie, original);
    assert.equal(uploads.length, 1, 'repeated library images upload once per operation');
    assert(!prepared.content.includes('wgh-image://'));
    assert(prepared.content.includes('style="color:#123456"'));
    assert(prepared.content.includes('data-src="ignored"'));
    assert.equal((prepared.content.match(/https:\/\/p3.test\/image-1.png/g) || []).length, 2);
    assert.equal(prepared.coverData.imageUri, 'cover-1');
    assert.equal(prepared.coverData.coverUrl, 'https://p3.test/cover-1.png');
    const body = `<img src="${url}"><img src="data:image/png;base64,${png.toString('base64')}">`;
    for (const browser of [false, true, true]) {
      useOfficialClient = browser && !useOfficialClient;
      uploads = []; writes = [];
      const client = loadToutiao(browser);
      const result = await client.publishArticle(cookie, {title: '模拟文章', content: body, cover_image_url: url, save_draft_only: false});
      assert.equal(result.success, true);
      assert.equal(uploads.length, 2);
      assert.deepEqual(writes.map(w => w.get('save')), ['1'], 'publish directly without an extra draft request');
      for (const write of writes) {
        assert(!/wgh-image:|data:image/.test(write.get('content')));
        assert(write.get('content').includes('web_uri="uploaded-1"'), 'body retains the body upload URI, not the separately generated cover URI');
        const covers = JSON.parse(write.get('pgc_feed_covers'));
        assert.equal(covers[0].uri, 'cover-1');
      }
      draftFailure = true; writes = [];
      assert.equal((await client.publishArticle(cookie, {title:'草稿失败不应阻止直接发布',content:body})).success,true);
      assert.deepEqual(writes.map(w=>w.get('save')),['1']);
      writes = [];
      const draft = await client.publishArticle(cookie, {title:'仅保存草稿',content:body,save_draft_only:true});
      assert.equal(draft.success,false);
      assert.match(draft.error,/7050/);
      assert.deepEqual(writes.map(w=>w.get('save')),['0'], 'draft failure must never turn into a public publication');
      draftFailure = false; invalidArticleId = true;
      assert.equal((await client.publishArticle(cookie, {title:'无效文章ID',content:body})).success,false);
      invalidArticleId = false;
      for (const mode of ['upload', 'cover', 'url', 'missing']) {
        writes = []; failUpload = mode === 'upload'; failCover = mode === 'cover'; omitUrl = mode === 'url';
        const result = await client.publishArticle(cookie, {title: '模拟失败', content: mode === 'missing' ? '<img src="wgh-image://library/missing.png">' : body});
        assert.equal(result.success, false, `${mode} must fail`);
        assert.match(result.error, /头条图片处理失败/);
        assert.equal(writes.length, 0, 'never save or publish with missing/unuploaded images');
      }
      failUpload = failCover = omitUrl = false;
    }
    const client = loadToutiao(true);
    writes = [];
    const parallel = await Promise.all(['first', 'second'].map(title => client.publishArticle(cookie, {title, content: body, save_draft_only: true})));
    assert(parallel.every(result => result.success));
    assert.deepEqual(writes.map(w=>w.get('save')),['0','0']);
    assert.equal(activeWindows, 0);
    assert.equal(destroyed, partitions.length, 'all hidden windows close on success and failure');
    const remote = await toutiao.prepareToutiaoContent(cookie, '<img src="https://images.test/a.png?a=1&amp;b=2">', url);
    assert.equal(downloadUrls.at(-1), 'https://images.test/a.png?a=1&b=2');
    assert(remote.coverData, 'a separate cover outside the article is uploaded too');
    await assert.rejects(() => toutiao.prepareToutiaoContent(cookie, '<img src="wgh-image://library/%2e%2e%2f%2e%2e%2fsecret.png">'), /非法图片路径/);
    console.log('PASS: Toutiao local-library/data/remote images uploaded; body and cover URIs valid; duplicate images deduplicated; upload/read/cover failures block browser and HTTP publication; login device state preserved and browser operations serialized. No live network requests.');
  } finally { fs.rmSync(directory, {recursive: true, force: true}); }
})().catch(error => { console.error(error); process.exitCode = 1; });
