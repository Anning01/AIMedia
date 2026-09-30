import { clipboard, ClipboardItem, nativeImage, type BrowserWindow } from "electron";
import { randomUUID } from 'node:crypto';
import { openWechatEditor, wechatEditorFields } from './wechat-navigation.js';

export type WechatPublishContext = { title: string; html: string; image_count: number };
export type BrowserPublishResult = { status: "awaiting_approval" | "needs_handoff" | "published"; message: string; summary?: Record<string, unknown> };
type WechatAdapterOptions = { allowTestOrigin?: boolean; mediaOrigin?: string; imagePasteTimeoutMs?: number; navigationTimeoutMs?: number };
const run = (browser: BrowserWindow, source: string) => browser.webContents.executeJavaScript(source, true) as Promise<Record<string, unknown>>;
const pause = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));
const localMediaUrl = (value: string, mediaOrigin: string) => {
  try {
    const url = new URL(value);
    return Boolean(mediaOrigin) && url.origin === mediaOrigin && !url.username && !url.password && /^\/api\/media\/[\w.-]+\/content$/.test(url.pathname);
  } catch {
    return false;
  }
};

export async function snapshotClipboard() {
  const items = await clipboard.read();
  return Promise.all(items.map(async item => {
    const values: Record<string, string | Blob | { title: string; url: string }> = {};
    for (const type of item.types) {
      const value = await item.getType(type);
      if (value instanceof Blob) {
        values[type] = new Blob([await value.arrayBuffer()], { type: value.type || type });
      } else {
        values[type] = { title: value.title, url: value.url };
      }
    }
    return new ClipboardItem(values);
  }));
}

async function pasteLocalImages(browser: BrowserWindow, sources: string[], mediaOrigin: string, timeoutMs: number) {
  if (!sources.length) return;
  const previousClipboard = await snapshotClipboard();
  const markerType = 'web application/x.ai-media-paste';
  const markerValue = randomUUID();
  try {
    for (const [index, source] of sources.entries()) {
      if (!localMediaUrl(source, mediaOrigin)) throw new Error("图片地址不属于 AI Media 本机媒体服务");
      const response = await fetch(source, { redirect: "error", signal: AbortSignal.timeout(15_000) });
      const contentType = (response.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
      if (!response.ok || !/^image\/(?:png|jpeg|webp|gif)$/.test(contentType)) throw new Error("无法读取待发布图片");
      const declared = Number(response.headers.get("content-length") || 0);
      if (declared > 20 * 1024 * 1024) throw new Error("待发布图片超过 20MB");
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new Error("待发布图片大小无效");
      const image = nativeImage.createFromBuffer(bytes);
      if (image.isEmpty()) throw new Error("待发布图片无法解码");
      const png = image.toPNG();
      const selection = await run(browser, `(${function (slot: number) {
        const marker = document.querySelector(`[data-ai-media-image-slot="${slot}"]`);
        const editor = marker?.closest('[contenteditable="true"]');
        if (!(marker instanceof HTMLElement) || !(editor instanceof HTMLElement)) return { ok: false };
        editor.focus();
        const range = document.createRange(); range.setStartBefore(marker); range.collapse(true);
        const selected = getSelection(); selected?.removeAllRanges(); selected?.addRange(range);
        return { ok: true, images: editor.querySelectorAll('img').length };
      }})(${index})`);
      if (!selection.ok) throw new Error("公众号图片插入位置已经变化");
      await clipboard.write([new ClipboardItem({ "image/png": new Blob([png], { type: "image/png" }), [markerType]: markerValue })]);
      browser.show(); browser.focus(); browser.webContents.focus(); browser.webContents.paste();
      const deadline = Date.now() + timeoutMs;
      let inserted = false;
      while (Date.now() < deadline) {
        await pause(250);
        const state = await run(browser, `(${function (slot: number, before: number, trustedMediaOrigin: string) {
          const marker = document.querySelector(`[data-ai-media-image-slot="${slot}"]`);
          const editor = marker?.closest('[contenteditable="true"]');
          if (!(marker instanceof HTMLElement) || !(editor instanceof HTMLElement)) return { inserted: false };
          const images = [...editor.querySelectorAll('img')];
          const pending = images.some(image => {
            const source = image.getAttribute('src');
            if (!source) return true;
            try { const url = new URL(source, location.href); return ['data:', 'blob:'].includes(url.protocol) || url.origin === trustedMediaOrigin; }
            catch { return true; }
          });
          if (images.length <= before || pending) return { inserted: false };
          marker.remove();
          editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: null }));
          return { inserted: true };
        }})(${index},${Number(selection.images) || 0},${JSON.stringify(mediaOrigin)})`);
        if (state.inserted) { inserted = true; break; }
      }
      if (!inserted) throw new Error("公众号没有完成粘贴图片的上传");
    }
  } finally {
    const current = await clipboard.read();
    const marker = current.find(item => item.types.includes(markerType));
    const markerData = marker ? await marker.getType(markerType) : null;
    // Preserve anything the user copied while the platform processed the image.
    if (markerData instanceof Blob && await markerData.text() === markerValue) {
      await clipboard.write(previousClipboard);
    }
  }
}

/** Uses semantic labels and visible text first; selector fallbacks are isolated here. */
export async function prepareWechat(browser: BrowserWindow, context: WechatPublishContext, options: WechatAdapterOptions = {}): Promise<BrowserPublishResult> {
  const navigation = await openWechatEditor(browser, options);
  if (!navigation.ok) return { status: 'needs_handoff', message: navigation.message, summary: { navigation_steps: navigation.steps } };
  const mediaOrigin = options.mediaOrigin ? new URL(options.mediaOrigin).origin : "";
  const result = await run(browser, `(${function (data: WechatPublishContext, allowTestOrigin: boolean, trustedMediaOrigin: string, fields: typeof wechatEditorFields) {
    const official = location.protocol === 'https:' && location.hostname === 'mp.weixin.qq.com';
    if (!official && !allowTestOrigin) return { ok: false, message: '当前页面不是微信公众号官方页面。为保护文章和账号，系统没有填写内容，请返回 https://mp.weixin.qq.com/ 后继续。', url: location.href };
    const { title, editor } = fields();
    if (!title || !editor) {
      const pageText = (document.body?.innerText || '').slice(0, 5000);
      const message = /验证码|安全验证|身份验证|二次验证/.test(pageText)
        ? '公众号正在要求验证码或安全验证。自动操作已暂停，请在浏览器中完成验证并进入图文编辑页后继续。'
        : /扫码登录|请先登录|登录失效|登录已过期/.test(pageText)
          ? '公众号尚未登录或仍在登录页。请在浏览器中完成登录并进入图文编辑页后继续。'
          : '图文编辑页在填写前发生变化，已停止；请检查页面后重试自动填写。';
      return { ok: false, message, url: location.href };
    }
    const incoming = document.createElement('div'); incoming.innerHTML = data.html;
    const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
    const existingTitle = title.value.trim(), existingBody = normalize(editor.innerText || '');
    const hasMedia = Boolean(editor.querySelector('img,video,audio,iframe'));
    if ((existingTitle && existingTitle !== data.title) || existingBody || hasMedia) {
      const matches = existingTitle === data.title && existingBody === normalize(incoming.innerText || '') && editor.querySelectorAll('img').length === data.image_count;
      if (!matches) return { ok: false, message: '公众号编辑器已有其他内容，系统没有覆盖。请先保留现有草稿，再重新发起自动填写。', url: location.href };
      // Matching prepared content needs no second write or duplicate image paste.
      return { ok: true, localImages: [], unsupportedImages: [], url: location.href };
    }
    const localImages: string[] = [];
    const unsupportedImages: string[] = [];
    for (const image of incoming.querySelectorAll('img')) {
      let url: URL;
      try { url = new URL(image.src); } catch { continue; }
      const local = trustedMediaOrigin && url.origin === trustedMediaOrigin && !url.username && !url.password && /^\/api\/media\/[\w.-]+\/content$/.test(url.pathname);
      const hosted = url.protocol === 'https:' && /(?:^|\.)qpic\.cn$|(?:^|\.)qlogo\.cn$/.test(url.hostname);
      if (local) {
        const marker = document.createElement('span');
        marker.dataset.aiMediaImageSlot = String(localImages.length);
        marker.setAttribute('contenteditable', 'false');
        marker.setAttribute('aria-label', `待插入图片 ${localImages.length + 1}`);
        localImages.push(image.src); image.replaceWith(marker);
      } else if (!hosted) {
        unsupportedImages.push(image.src); image.remove();
      }
    }
    const setter = Object.getOwnPropertyDescriptor(title instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')?.set;
    setter?.call(title, data.title); title.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: data.title })); title.dispatchEvent(new Event('change', { bubbles: true }));
    editor.focus(); editor.innerHTML = incoming.innerHTML; editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: null })); editor.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, localImages, unsupportedImages, url: location.href };
  }})(${JSON.stringify(context)},${Boolean(options.allowTestOrigin)},${JSON.stringify(mediaOrigin)},${wechatEditorFields.toString()})`);
  if (!result.ok) return { status: "needs_handoff", message: String(result.message), summary: { navigation_steps: navigation.steps, page_url: result.url } };
  const unsupportedImages = Array.isArray(result.unsupportedImages) ? result.unsupportedImages.length : 0;
  let pasteError = "";
  try {
    const timeoutMs = Math.min(60_000, Math.max(250, options.imagePasteTimeoutMs ?? 20_000));
    await pasteLocalImages(browser, Array.isArray(result.localImages) ? result.localImages.map(String) : [], mediaOrigin, timeoutMs);
  } catch (error) {
    pasteError = error instanceof Error ? error.message : String(error);
  }
  const inspected = await run(browser, `(${function (data: WechatPublishContext, allowTestOrigin: boolean, fields: typeof wechatEditorFields) {
    if (!allowTestOrigin && (location.protocol !== 'https:' || location.hostname !== 'mp.weixin.qq.com')) return { ok: false, url: location.href };
    const { title, editor } = fields();
    const actualTitle = title?.value.trim() || '', bodyChars = (editor?.innerText || '').trim().length, images = editor?.querySelectorAll('img').length ?? 0;
    const pendingImages = editor?.querySelectorAll('[data-ai-media-image-slot]').length ?? 0;
    const unhostedImages = [...(editor?.querySelectorAll('img') ?? [])].filter(image => {
      try { const url = new URL(image.src, location.href); return url.protocol !== 'https:' || !/(?:^|\.)qpic\.cn$|(?:^|\.)qlogo\.cn$/.test(url.hostname); }
      catch { return true; }
    }).length;
    return { ok: actualTitle === data.title && bodyChars > 0 && images === data.image_count && pendingImages === 0 && unhostedImages === 0,
      actualTitle, bodyChars, images, pendingImages, unhostedImages, url: location.href };
  }})(${JSON.stringify(context)},${Boolean(options.allowTestOrigin)},${wechatEditorFields.toString()})`);
  const summary = { navigation_steps: navigation.steps, title: inspected.actualTitle, body_chars: inspected.bodyChars, image_count: inspected.images, pending_images: inspected.pendingImages,
    unsupported_images: unsupportedImages, unhosted_images: inspected.unhostedImages, page_url: inspected.url };
  return inspected.ok && !pasteError
    ? { status: "awaiting_approval", message: "标题、正文和图片已填写，请在浏览器预览核对。", summary }
    : { status: "needs_handoff", message: unsupportedImages
        ? `正文含有 ${unsupportedImages} 张外部直链图片，不能确认已进入公众号素材。请先在 AI Media 中上传这些图片，或在公众号中人工补齐后重新发起。`
        : pasteError
        ? `正文文字已填写，但图片自动粘贴失败（${pasteError}）。请人工补齐后再继续。`
        : "公众号中的标题、正文或图片数量不完整，请人工核对后再继续。", summary };
}

export async function confirmWechat(browser: BrowserWindow, context: WechatPublishContext, options: WechatAdapterOptions = {}): Promise<BrowserPublishResult> {
  const clickAction = (final: boolean) => run(browser, `(${function (data: WechatPublishContext, allowTestOrigin: boolean, fields: typeof wechatEditorFields, final: boolean) {
    const visible = (node: Element): node is HTMLElement => node instanceof HTMLElement && node.offsetParent !== null;
    const official = location.protocol === 'https:' && location.hostname === 'mp.weixin.qq.com';
    if (!official && !allowTestOrigin) return { ok: false, message: '当前页面已离开微信公众号官方域名。为避免误发，系统没有点击发布。', url: location.href };
    const dialogs = [...document.querySelectorAll('[role="dialog"],.weui-desktop-dialog')].filter(visible);
    if (dialogs.some(node => /验证码|安全验证|身份验证|二次验证/.test(node.textContent || '')))
      return { ok: false, message: '公众号要求安全验证，自动发布已暂停，请完成验证后核对平台状态。' };
    const publishDialogs = dialogs.filter(node => /发表|群发|发布/.test(node.textContent || ''));
    // Some platforms submit on the first click. Observe the result without clicking again.
    if (final && !publishDialogs.length) return { ok: true, confirmed: false, url: location.href };
    if (final && publishDialogs.length !== 1)
      return { ok: false, message: '发现多个发布确认弹窗，无法确定操作目标，自动发布已暂停。' };
    const { title, editor } = fields();
    const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
    const expected = document.createElement('div'); expected.innerHTML = data.html;
    const actualTitle = title?.value.trim() || '', actualBody = normalize(editor?.innerText || ''), expectedBody = normalize(expected.innerText || '');
    const imageNodes = [...(editor?.querySelectorAll('img') ?? [])], images = imageNodes.length;
    const unhostedImages = imageNodes.filter(image => {
      try { const url = new URL(image.src, location.href); return url.protocol !== 'https:' || !/(?:^|\.)qpic\.cn$|(?:^|\.)qlogo\.cn$/.test(url.hostname); }
      catch { return true; }
    }).length;
    if (!title || !editor || actualTitle !== data.title || actualBody !== expectedBody || images !== data.image_count || unhostedImages)
      return { ok: false, message: unhostedImages ? '公众号正文仍含有未完成平台托管的图片。为避免图片失效，系统没有点击发布。' : '公众号页面中的标题、正文或图片已与确认内容不同。为避免误发，系统没有点击发布，请人工核对后重新发起。', actualTitle, bodyMatches: actualBody === expectedBody, images, expectedImages: data.image_count, unhostedImages };
    const scope = final ? publishDialogs[0] : document;
    const labels = final ? ['确认发表', '确认群发', '确定'] : ['发表', '群发', '发布'];
    const actions = [...scope.querySelectorAll('button,[role="button"],a')].filter(visible)
      .filter(node => !node.matches(':disabled,[aria-disabled="true"]') && labels.includes((node.textContent || '').trim()));
    if (actions.length !== 1) return { ok: false, message: '未找到唯一可用的公众号发布按钮，页面可能已变化，自动发布已暂停。' };
    actions[0].click(); return { ok: true, confirmed: final, action: (actions[0].textContent || '').trim(), url: location.href };
  }})(${JSON.stringify(context)},${Boolean(options.allowTestOrigin)},${wechatEditorFields.toString()},${final})`);
  const clicked = await clickAction(false);
  if (!clicked.ok) return { status: "needs_handoff", message: String(clicked.message), summary: clicked };
  await new Promise(resolve => setTimeout(resolve, 1200));
  const confirmation = await clickAction(true);
  if (!confirmation.ok) return { status: "needs_handoff", message: String(confirmation.message), summary: confirmation };
  await new Promise(resolve => setTimeout(resolve, 3500));
  const result = await run(browser, `(${function (allowTestOrigin: boolean) {
    const official = location.protocol === 'https:' && location.hostname === 'mp.weixin.qq.com';
    if (!official && !allowTestOrigin) return { success: false, unsafeOrigin: true, url: location.href, title: document.title };
    const notices = [...document.querySelectorAll('[role="status"],[role="alert"],.weui-desktop-toast,.weui-desktop-msg,.weui-msg')]
      .filter(node => node instanceof HTMLElement && node.offsetParent !== null).map(node => (node.textContent || '').trim());
    const evidence = notices.find(text => /发表成功|群发成功|发送成功|已发表/.test(text));
    return { success: Boolean(evidence), evidence, url: location.href, title: document.title };
  }})(${Boolean(options.allowTestOrigin)})`);
  return result.success
    ? { status: "published", message: "公众号页面显示发布成功。", summary: result }
    : { status: "needs_handoff", message: result.unsafeOrigin
        ? "发布过程中页面离开了公众号官方域名，已停止自动操作。请人工核对平台状态，系统不会自动重试。"
        : "平台结果暂不明确，已停止自动操作。请在公众号页面核对状态，系统不会自动重试。", summary: result };
}
