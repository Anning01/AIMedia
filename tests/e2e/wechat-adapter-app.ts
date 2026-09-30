import { app, BrowserWindow, clipboard, session } from "electron";
import { createServer } from "node:http";
import { prepareWechat, confirmWechat, snapshotClipboard } from "../../electron/publishing/wechat.js";

declare global { interface Window { __wechatReport?: unknown } }
if (!process.env.AI_MEDIA_TEST_DIR) throw new Error('An isolated test directory is required');
app.setPath('userData', process.env.AI_MEDIA_TEST_DIR);
async function start() {
await app.whenReady();
// These fixtures must never contact a real platform or use its login state.
session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => {
  callback({ cancel: new URL(details.url).hostname !== '127.0.0.1' });
});
const originalClipboard = await snapshotClipboard();
try {
const mediaServer = createServer((request, response) => {
  if (request.url === '/navigation-home') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end('<a href="/navigation-editor" target="_blank">新建图文</a>'); return;
  }
  if (request.url === '/navigation-editor') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(page); return;
  }
  if (request.url?.startsWith('/api/media/test-image/content')) {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    response.writeHead(200, { 'content-type': 'image/png', 'content-length': png.length }); response.end(png); return;
  }
  response.writeHead(404); response.end();
});
await new Promise<void>((resolve, reject) => { mediaServer.once('error', reject); mediaServer.listen(0, '127.0.0.1', resolve); });
mediaServer.unref();
const mediaPort = (mediaServer.address() as { port: number }).port;
const window = new BrowserWindow({ width: 900, height: 720, show: true, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
const page = `<!doctype html><html><body>
<textarea aria-label="文章标题"></textarea>
<div aria-label="正文编辑器" role="textbox" contenteditable="true"></div>
<button id="publish">发表</button>
<script>
document.querySelector('[contenteditable]').addEventListener('paste',event=>{if(![...event.clipboardData.items].some(item=>item.type.startsWith('image/')))return;event.preventDefault();const image=document.createElement('img');image.src='https://mmbiz.qpic.cn/mock-upload.png';const selection=getSelection();if(selection.rangeCount)selection.getRangeAt(0).insertNode(image)});
document.querySelector('#publish').onclick=()=>{const dialog=document.createElement('div');dialog.setAttribute('role','dialog');dialog.textContent='确认发表';const confirm=document.createElement('button');confirm.textContent='确认发表';confirm.onclick=()=>{const success=document.createElement('p');success.setAttribute('role','status');success.textContent='发表成功';document.body.append(success)};dialog.append(confirm);document.body.append(dialog)}
</script>
</body></html>`;
await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page)}`);
const prepared = await prepareWechat(window, { title: "公众号测试标题", html: "<p>正文内容</p><img src=\"https://mmbiz.qpic.cn/a.png\">", image_count: 1 }, { allowTestOrigin: true });
const filled = await window.webContents.executeJavaScript(`({ title: document.querySelector('textarea').value, body: document.querySelector('[contenteditable]').innerText, images: document.querySelectorAll('[contenteditable] img').length })`);
const context = { title: "公众号测试标题", html: "<p>正文内容</p><img src=\"https://mmbiz.qpic.cn/a.png\">", image_count: 1 };
const confirmed = await confirmWechat(window, context, { allowTestOrigin: true });
const changedWindow = new BrowserWindow({ width: 700, height: 600, show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
await changedWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page)}`);
await prepareWechat(changedWindow, context, { allowTestOrigin: true });
await changedWindow.webContents.executeJavaScript(`document.querySelector('textarea').value='被手动改动的标题'`);
const changed = await confirmWechat(changedWindow, context, { allowTestOrigin: true });
changedWindow.destroy();
const finalGuards: Record<string, unknown> = {};
const guardWindow = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
for (const [name, mutation] of Object.entries({
  title: `document.querySelector('textarea').value='确认弹窗期间修改的标题'`,
  body: `document.querySelector('[contenteditable] p').textContent='确认弹窗期间修改的正文'`,
  image: `document.querySelector('[contenteditable] img').src='https://example.com/unhosted.png'`,
  verification: `dialog.prepend('发表前请完成安全验证')`,
  disabled: `button.disabled=true`,
  hidden: `button.style.display='none'`,
  ambiguous: `dialog.append(button.cloneNode(true))`,
})) {
  await guardWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page)}`);
  await prepareWechat(guardWindow, context, { allowTestOrigin: true });
  await guardWindow.webContents.executeJavaScript(`window.finalClicks=0;const publish=document.querySelector('#publish');const original=publish.onclick;publish.onclick=()=>{original();const dialog=document.querySelector('[role="dialog"]');const button=dialog.querySelector('button');button.onclick=()=>{window.finalClicks++};${mutation}};undefined`);
  const result = await confirmWechat(guardWindow, context, { allowTestOrigin: true });
  const finalClicks = await guardWindow.webContents.executeJavaScript('window.finalClicks');
  finalGuards[name] = { result, finalClicks };
}
guardWindow.destroy();
const untrustedWindow = new BrowserWindow({ width: 700, height: 600, show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
await untrustedWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page)}`);
const untrusted = await prepareWechat(untrustedWindow, context);
const untouched = await untrustedWindow.webContents.executeJavaScript(`({ title: document.querySelector('textarea').value, body: document.querySelector('[contenteditable]').innerText })`);
untrustedWindow.destroy();
const loginWindow = new BrowserWindow({ width: 700, height: 600, show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
await loginWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent('<main>微信公众平台 · 扫码登录</main>')}`);
const login = await prepareWechat(loginWindow, context, { allowTestOrigin: true });
loginWindow.destroy();
const externalImageWindow = new BrowserWindow({ width: 700, height: 600, show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
await externalImageWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page)}`);
const externalImage = await prepareWechat(externalImageWindow, { title: '外部图片', html: '<p>正文</p><img src="https://example.com/not-hosted.png">', image_count: 1 }, { allowTestOrigin: true });
externalImageWindow.destroy();
const imageWindow = new BrowserWindow({ width: 700, height: 600, show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
await imageWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page)}`);
const imageContext = { title: '本机图片粘贴', html: `<p>图片之前</p><img src="http://127.0.0.1:${mediaPort}/api/media/test-image/content?signature=test"><p>图片之后</p>`, image_count: 1 };
await clipboard.writeText('ai-media-clipboard-sentinel');
const imagePrepared = await prepareWechat(imageWindow, imageContext, { allowTestOrigin: true, mediaOrigin: `http://127.0.0.1:${mediaPort}` });
const pastedImage = await imageWindow.webContents.executeJavaScript(`({ images: document.querySelectorAll('[contenteditable] img').length, src: document.querySelector('[contenteditable] img')?.src, markers: document.querySelectorAll('[data-ai-media-image-slot]').length, body: document.querySelector('[contenteditable]').innerText })`);
const restoredClipboard = await clipboard.readText();
await imageWindow.webContents.executeJavaScript(`document.querySelector('[contenteditable]').innerHTML=''`);
const concurrentPaste = prepareWechat(imageWindow, imageContext, { allowTestOrigin: true, mediaOrigin: `http://127.0.0.1:${mediaPort}` });
const copyDeadline = Date.now() + 3000;
while (!await imageWindow.webContents.executeJavaScript(`Boolean(document.querySelector('[contenteditable] img'))`)) {
  if (Date.now() > copyDeadline) throw new Error('Timed out waiting for native paste before concurrent copy');
  await new Promise(resolve => setTimeout(resolve, 10));
}
await clipboard.writeText('user-copied-during-paste');
await concurrentPaste;
const concurrentClipboard = await clipboard.readText();
imageWindow.destroy();
const failedImageWindow = new BrowserWindow({ width: 700, height: 600, show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
await failedImageWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent('<textarea aria-label="文章标题"></textarea><div aria-label="正文编辑器" role="textbox" contenteditable="true"></div>')}`);
await clipboard.writeText('ai-media-failed-paste-sentinel');
const failedImagePrepared = await prepareWechat(failedImageWindow, imageContext, { allowTestOrigin: true, mediaOrigin: `http://127.0.0.1:${mediaPort}`, imagePasteTimeoutMs: 500 });
const failedPasteClipboard = await clipboard.readText();
failedImageWindow.destroy();
const navigationWindow = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
const loadNavigation = (html: string) => navigationWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
const navigationOptions = { allowTestOrigin: true, navigationTimeoutMs: 800 };
const emptyEditor = '<textarea aria-label="文章标题"></textarea><div aria-label="正文编辑器" contenteditable="true"></div><button onclick="window.publishClicks++">发表</button>';
await loadNavigation(`<button>新的创作</button><script>window.publishClicks=0;document.querySelector('button').onclick=()=>{document.body.innerHTML='<button>图文消息</button>';document.querySelector('button').onclick=()=>{document.body.innerHTML=${JSON.stringify(emptyEditor)}}}</script>`);
const navigationPrepared = await prepareWechat(navigationWindow, context, navigationOptions);
const navigationState = await navigationWindow.webContents.executeJavaScript(`({publishClicks:window.publishClicks,body:document.querySelector('[contenteditable]').innerText})`);
await loadNavigation('<button onclick="window.clicks++">图文消息</button><button onclick="window.clicks++">新建文章</button><script>window.clicks=0</script>');
const ambiguous = await prepareWechat(navigationWindow, context, navigationOptions);
const ambiguousClicks = await navigationWindow.webContents.executeJavaScript('window.clicks');
await loadNavigation('<a href="https://example.com/not-wechat">图文消息</a>');
const unsafe = await prepareWechat(navigationWindow, context, navigationOptions);
await loadNavigation(`${emptyEditor}<div role="dialog">请完成安全验证</div>`);
const verification = await prepareWechat(navigationWindow, context, navigationOptions);
const verificationTitle = await navigationWindow.webContents.executeJavaScript("document.querySelector('textarea').value");
await loadNavigation('<button onclick="window.clicks++">图文消息</button><script>window.clicks=0</script>');
const stalled = await prepareWechat(navigationWindow, context, navigationOptions);
const stalledClicks = await navigationWindow.webContents.executeJavaScript('window.clicks');
await loadNavigation(`<button disabled>图文消息</button><button style="display:none">图文消息</button><button id="actual" aria-label="新建文章">进入</button><script>document.querySelector('#actual').onclick=()=>{document.body.innerHTML=${JSON.stringify(emptyEditor)}}</script>`);
const retry = await prepareWechat(navigationWindow, context, navigationOptions);
const secondPrepare = await prepareWechat(navigationWindow, context, navigationOptions);
await loadNavigation('<textarea aria-label="文章标题">平台中未保存的标题</textarea><div aria-label="正文编辑器" contenteditable="true">平台中未保存的正文</div>');
const existingDraft = await prepareWechat(navigationWindow, context, navigationOptions);
const preservedDraft = await navigationWindow.webContents.executeJavaScript(`({title:document.querySelector('textarea').value,body:document.querySelector('[contenteditable]').innerText})`);
await navigationWindow.loadURL(`http://127.0.0.1:${mediaPort}/navigation-home`);
const linkedPage = await prepareWechat(navigationWindow, context, { ...navigationOptions, navigationTimeoutMs: 2000 });
const linkedUrl = navigationWindow.webContents.getURL();
navigationWindow.destroy(); mediaServer.close();
const navigation = { prepared: navigationPrepared, ...navigationState, ambiguous, ambiguousClicks, unsafe, verification, verificationTitle, stalled, stalledClicks, retry, secondPrepare, existingDraft, preservedDraft, linkedPage, linkedUrl };
await window.webContents.executeJavaScript(`window.__wechatReport=${JSON.stringify({ prepared, filled, confirmed, changed, finalGuards, untrusted, untouched, login, externalImage, imagePrepared, pastedImage, restoredClipboard, concurrentClipboard, failedImagePrepared, failedPasteClipboard, navigation })}`);
} finally {
  await clipboard.write(originalClipboard);
}
await BrowserWindow.getAllWindows()[0].webContents.executeJavaScript("document.title='wechat-adapter-passed'");
}
void start().catch(error => { console.error(error); app.exit(1); });
