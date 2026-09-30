import type { BrowserWindow } from 'electron';

/** Serialized into the platform page; keep this function self-contained. */
export function wechatEditorFields() {
  const visible = (node: Element | null): node is HTMLElement => node instanceof HTMLElement && node.offsetParent !== null;
  const first = (selectors: string[]) => selectors.flatMap(selector => [...document.querySelectorAll(selector)]).find(visible);
  return {
    title: first(['input[aria-label*="标题"]', 'textarea[aria-label*="标题"]', 'input[placeholder*="标题"]', 'textarea[placeholder*="标题"]', '#title', 'textarea.js_title']) as HTMLInputElement | HTMLTextAreaElement | undefined,
    editor: first(['[aria-label*="正文"][contenteditable="true"]', '[role="textbox"][contenteditable="true"]', '.ProseMirror[contenteditable="true"]', '#ueditor_0[contenteditable="true"]']),
  };
}

type NavigationResult = { ok: boolean; message: string; steps: string[] };

/** Bounded semantic navigation only: never guesses platform URLs or clicks publish. */
export async function openWechatEditor(browser: BrowserWindow, options: { allowTestOrigin?: boolean; navigationTimeoutMs?: number } = {}): Promise<NavigationResult> {
  const steps: string[] = [];
  const deadline = Date.now() + Math.min(15_000, Math.max(250, options.navigationTimeoutMs ?? 8000));
  const stop = (message: string): NavigationResult => ({ ok: false, message, steps });
  while (Date.now() < deadline) {
    if (browser.isDestroyed()) return stop('公众号窗口已关闭，自动导航已停止。');
    if (browser.webContents.isLoadingMainFrame()) { await new Promise(resolve => setTimeout(resolve, 100)); continue; }
    let state: { status: string; message?: string; label?: string };
    try {
      state = await browser.webContents.executeJavaScript(`(${function (allowTestOrigin: boolean, clicked: string[], fields: typeof wechatEditorFields) {
        const visible = (node: Element): node is HTMLElement => node instanceof HTMLElement && node.offsetParent !== null;
        const official = location.protocol === 'https:' && location.hostname === 'mp.weixin.qq.com';
        if (!official && !allowTestOrigin) return { status: 'stop', message: '当前页面不是微信公众号官方页面，自动导航已停止。' };
        const dialogs = [...document.querySelectorAll('[role="dialog"],.weui-desktop-dialog')].filter(visible);
        if (dialogs.some(node => /验证码|安全验证|身份验证|二次验证/.test(node.innerText)))
          return { status: 'stop', message: '公众号要求安全验证，请完成验证后重试；系统不会绕过验证。' };
        const { title, editor } = fields();
        if (title && editor) return { status: 'ready' };
        const text = (document.body?.innerText || '').slice(0, 5000);
        if (/扫码登录|登录已过期|登录失效|请先登录/.test(text))
          return { status: 'stop', message: '请在公众号窗口完成登录，再重试自动填写。' };
        const controls = [...document.querySelectorAll('button,a[href],[role="button"],[role="link"]')].filter(visible)
          .filter(node => !node.matches(':disabled,[aria-disabled="true"]'));
        const name = (node: HTMLElement) => (node.getAttribute('aria-label') || node.innerText || '').replace(/\s+/g, '').trim();
        const labels = ['新建图文', '新建文章', '写文章', '图文消息'];
        let candidates = controls.filter(node => labels.includes(name(node)));
        if (!candidates.length) candidates = controls.filter(node => name(node) === '新的创作');
        if (candidates.length > 1) return { status: 'stop', message: '找到多个图文创作入口，无法安全确定目标，自动导航已停止。' };
        if (!candidates.length) return { status: 'wait' };
        const action = candidates[0], label = name(action);
        if (clicked.includes(label)) return { status: 'wait' };
        if (clicked.length >= 3) return { status: 'stop', message: '自动导航达到步骤上限，未进入图文编辑页，已停止。' };
        if (action instanceof HTMLAnchorElement) {
          const url = new URL(action.href, location.href);
          const allowed = (url.protocol === 'https:' && url.hostname === 'mp.weixin.qq.com') ||
            (allowTestOrigin && ['http:', 'https:'].includes(url.protocol) && url.origin === location.origin);
          if (url.username || url.password || !allowed)
            return { status: 'stop', message: '图文入口指向非官方或不安全地址，系统没有打开。' };
          // Keep a normal new-tab link in the account's existing isolated window.
          action.target = '_self';
        }
        action.click();
        return { status: 'clicked', label };
      }})(${Boolean(options.allowTestOrigin)},${JSON.stringify(steps)},${wechatEditorFields.toString()})`, true);
    } catch {
      return stop('公众号页面在自动导航时发生变化，已停止；请检查窗口后重试。');
    }
    if (state.status === 'ready') return { ok: true, message: '已进入图文编辑页。', steps };
    if (state.status === 'stop') return stop(state.message || '自动导航已停止。');
    if (state.status === 'clicked' && state.label) steps.push(state.label);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return stop('未能自动进入图文编辑页：入口未识别或页面未完成加载。已停止，请检查公众号窗口后重试。');
}
