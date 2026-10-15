'use strict';

const path = require('path');
const QRCode = require('qrcode');
const { buildSignedHeaders } = require('./xhs.cjs');
const { getPublicAccounts, DEFAULT_FINGERPRINT } = require('./wechatMp.cjs');
const { hardenLoginWebContents } = require('./fingerprint.cjs');

let BrowserWindow = null;
let electronSession = null;
try {
  const electron = require('electron');
  BrowserWindow = electron.BrowserWindow;
  electronSession = electron.session;
} catch {
  /* 非 Electron 环境（测试）时跳过 */
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const WECHAT_BASE_HEADERS = {
  'user-agent': UA,
  origin: 'https://mp.weixin.qq.com',
  referer: 'https://mp.weixin.qq.com/',
};

function normalizeMime(mime) {
  const m = String(mime || '').split(';')[0].trim().toLowerCase();
  if (m === 'image/jpg' || m === 'image/jpeg') return 'image/jpeg';
  return m || 'image/jpeg';
}

const SESSIONS = new Map();

const WEB_LOGIN_CONFIG = {
  wechat: {
    label: '公众号',
    url: 'https://mp.weixin.qq.com/',
    successRe: /\/cgi-bin\/home\?.*token=/,
    partition: 'persist:pub-wechat',
    cookieDomains: ['mp.weixin.qq.com', 'weixin.qq.com'],
    authCookieKeys: ['slave_sid', 'rand_info', 'data_ticket', 'token'],
  },
  toutiao: {
    label: '头条号',
    url: 'https://mp.toutiao.com/auth/page/login',
    successRe: /mp\.toutiao\.com\/(profile_v4|creator)/,
    partition: 'persist:pub-toutiao',
    extraHeaders: 'Referer: https://mp.toutiao.com/\nOrigin: https://mp.toutiao.com\n',
    cookieDomains: ['mp.toutiao.com', '.toutiao.com', 'toutiao.com', '.bytedance.com', 'bytedance.com', '.snssdk.com', 'snssdk.com'],
    authCookieKeys: ['sessionid', 'sessionid_ss', 'uid_tt', 'uid_tt_ss', 'sid_tt', 'passport_csrf_token', 'ttwid'],
  },
  baijiahao: {
    label: '百家号',
    url: 'https://baijiahao.baidu.com/builder/theme/bjh/login',
    successRe: /baijiahao\.baidu\.com\/(builder\/rc|author|dashboard)/,
    partition: 'persist:pub-baijiahao',
    extraHeaders: 'Referer: https://baijiahao.baidu.com/\nOrigin: https://baijiahao.baidu.com\n',
    cookieDomains: ['baijiahao.baidu.com', '.baidu.com', 'baidu.com'],
    authCookieKeys: ['BDUSS', 'BDUSS_BFESS', 'STOKEN', 'PTOKEN'],
  },
  xhs: {
    label: '小红书',
    url: 'https://creator.xiaohongshu.com/login',
    successRe: /creator\.xiaohongshu\.com\/(new\/home|home|publish|web_api|api\/galaxy)/,
    partition: 'persist:pub-xhs',
    extraHeaders: 'Referer: https://creator.xiaohongshu.com/\nOrigin: https://creator.xiaohongshu.com\n',
    cookieDomains: ['.xiaohongshu.com', 'xiaohongshu.com', '.xhscdn.com', 'xhscdn.com'],
    authCookieKeys: ['web_session', 'a1', 'webId', 'customerClientId', 'x-user-id-creator.xiaohongshu.com', 'galaxy_creator_session_id'],
  },
};

function newSessionId(platform) {
  const id = `login-${platform}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  return id;
}

function getSetCookieHeaders(res) {
  if (typeof res.headers.getSetCookie === 'function') {
    return res.headers.getSetCookie();
  }
  const raw = res.headers.get('set-cookie');
  return raw ? [raw] : [];
}

class CookieJar {
  constructor() {
    this.cookies = [];
  }

  set(name, value, domain, path = '/') {
    this.cookies = this.cookies.filter(
      (c) => !(c.name === name && c.domain === domain && c.path === path),
    );
    this.cookies.push({ name, value, domain, path, expires: 0 });
  }

  setFromResponse(res, url) {
    let host = '';
    try {
      host = new URL(url).hostname;
    } catch {
      host = '';
    }
    for (const header of getSetCookieHeaders(res)) {
      const parts = String(header).split(';');
      const first = parts[0] || '';
      const eq = first.indexOf('=');
      if (eq <= 0) continue;
      const name = first.slice(0, eq).trim();
      const value = first.slice(eq + 1).trim();
      let domain = '';
      let path = '/';
      let expires = 0;
      for (const p of parts.slice(1)) {
        const idx = p.indexOf('=');
        const key = (idx >= 0 ? p.slice(0, idx) : p).trim().toLowerCase();
        const val = idx >= 0 ? p.slice(idx + 1).trim() : '';
        if (key === 'domain') domain = val.replace(/^\./, '');
        if (key === 'path') path = val || '/';
        if (key === 'expires') expires = Date.parse(val) || 0;
        if (key === 'max-age') expires = Date.now() + Number(val) * 1000;
      }
      if (!domain) domain = host;
      this.cookies = this.cookies.filter(
        (c) => !(c.name === name && c.domain === domain && c.path === path),
      );
      this.cookies.push({ name, value, domain, path, expires });
    }
  }

  get(name) {
    const now = Date.now();
    const hit = this.cookies.find(
      (c) => c.name === name && (!c.expires || c.expires > now),
    );
    return hit ? hit.value : '';
  }

  getCookieString(url) {
    let host = '';
    try {
      host = new URL(url).hostname;
    } catch {
      host = '';
    }
    const now = Date.now();
    return this.cookies
      .filter(
        (c) =>
          (!c.expires || c.expires > now) &&
          (!c.domain || host === c.domain || host.endsWith('.' + c.domain)),
      )
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');
  }

  allString() {
    return this.cookies
      .filter((c) => !c.expires || c.expires > Date.now())
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');
  }
}

function storeSession(sessionObj) {
  SESSIONS.set(sessionObj.id, sessionObj);
  return sessionObj;
}

function reloadAndWait(webContents, timeoutMs = 20000) {
  return new Promise((resolve) => {
    if (!webContents || webContents.isDestroyed()) return resolve(false);
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      webContents.removeListener('did-finish-load', onFinish);
      webContents.removeListener('did-fail-load', onFail);
      resolve(true);
    };
    const timer = setTimeout(finish, timeoutMs);
    const onFinish = () => finish();
    const onFail = (_e, code, desc) => {
      if (String(code || '').includes('ERR_ABORTED') || String(desc || '').includes('(-3)')) return;
      finish();
    };
    webContents.once('did-finish-load', onFinish);
    webContents.once('did-fail-load', onFail);
    try {
      webContents.reload();
    } catch {
      finish();
    }
  });
}

function getSession(id) {
  const s = SESSIONS.get(id);
  if (!s) return null;
  return s;
}

function sanitizeSession(s) {
  return {
    id: s.id,
    platform: s.platform,
    mode: s.mode || 'qr',
    qrDataUrl: s.qrDataUrl || '',
    expiresAt: s.expiresAt || 0,
    status: s.status || 'pending',
    message: s.message || '',
    loginUrl: s.loginUrl || '',
    partition: s.partition || '',
    accountName: s.accountName || '',
  };
}

async function jsonOrThrow(res, label) {
  const text = await res.text().catch(() => '');
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error(`${label} 返回 HTTP ${res.status}：${text.slice(0, 300)}`);
  }
  return { data, text };
}

/* ---------------- 公众号 ---------------- */

async function createWechatSession() {
  const jar = new CookieJar();
  const form = new URLSearchParams({
    userlang: 'zh_CN',
    redirect_url: '',
    login_type: '3',
    sessionid: `${Date.now()}89`,
    token: '',
    lang: 'zh_CN',
    f: 'json',
    ajax: '1',
  });
  const res = await fetch(
    'https://mp.weixin.qq.com/cgi-bin/bizlogin?action=startlogin',
    {
      method: 'POST',
      headers: {
        ...WECHAT_BASE_HEADERS,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    },
  );
  if (!res.ok) {
    throw new Error(`公众号登录初始化失败：HTTP ${res.status}`);
  }
  jar.setFromResponse(res, 'https://mp.weixin.qq.com/');
  const uuid = jar.get('uuid');
  if (!uuid) {
    throw new Error('公众号登录初始化失败：没有拿到 uuid，请稍后重试');
  }

  const qrRes = await fetch(
    `https://mp.weixin.qq.com/cgi-bin/scanloginqrcode?action=getqrcode&random=${Date.now()}60`,
    {
      headers: {
        ...WECHAT_BASE_HEADERS,
        cookie: `uuid=${uuid}`,
      },
    },
  );
  if (!qrRes.ok) {
    throw new Error(`获取公众号二维码失败：HTTP ${qrRes.status}`);
  }
  const buf = Buffer.from(await qrRes.arrayBuffer());
  const mime = normalizeMime(qrRes.headers.get('content-type'));
  const sessionObj = storeSession({
    id: newSessionId('wechat'),
    platform: 'wechat',
    mode: 'qr',
    jar,
    uuid,
    qrDataUrl: `data:${mime};base64,${buf.toString('base64')}`,
    status: 'pending',
    message: '请用微信扫码',
    createdAt: Date.now(),
    expiresAt: Date.now() + 180000,
  });
  return sanitizeSession(sessionObj);
}

async function pollWechatSession(id) {
  const s = getSession(id);
  if (!s) return { status: 'error', message: '登录会话不存在' };
  if (s.status === 'done') {
    return {
      status: 'done',
      cookie: s.cookie,
      accountName: s.accountName || '',
      message: '登录成功',
    };
  }
  if (Date.now() > s.expiresAt) {
    s.status = 'expired';
    return { status: 'expired', message: '二维码已过期，请重新获取' };
  }
  try {
    const url = `https://mp.weixin.qq.com/cgi-bin/scanloginqrcode?action=ask&fingerprint=${DEFAULT_FINGERPRINT}&token=&lang=zh_CN&f=json&ajax=1`;
    const res = await fetch(url, {
      headers: { ...WECHAT_BASE_HEADERS, cookie: `uuid=${s.uuid}` },
    });
    const { data } = await jsonOrThrow(res, '公众号扫码状态');
    const status = Number(data?.status);
    if (status === 0) {
      return { status: 'waiting', message: '请用微信扫描二维码' };
    }
    if (status === 4) {
      s.status = 'scanned';
      return { status: 'scanned', message: '已扫码，请在手机上确认登录' };
    }
    if (status === 1) {
      const loginForm = new URLSearchParams({
        userlang: 'zh_CN',
        redirect_url: '',
        cookie_forbidden: '0',
        cookie_cleaned: '0',
        plugin_used: '0',
        login_type: '3',
        token: '',
        lang: 'zh_CN',
        f: 'json',
        ajax: '1',
      });
      const loginRes = await fetch(
        'https://mp.weixin.qq.com/cgi-bin/bizlogin?action=login',
        {
          method: 'POST',
          headers: {
            ...WECHAT_BASE_HEADERS,
            cookie: `uuid=${s.uuid}`,
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: loginForm.toString(),
        },
      );
      const login = await jsonOrThrow(loginRes, '公众号登录确认');
      s.jar.setFromResponse(loginRes, 'https://mp.weixin.qq.com/');
      let cookie = s.jar.allString();
      const redirectUrl = String(login.data?.redirect_url || '');
      const m = redirectUrl.match(/[?&]token=([^&]+)/);
      if (!m || !m[1]) {
        return {
          status: 'error',
          message: '微信已确认登录，但没有拿到 token，请重新登录',
        };
      }
      cookie += (cookie.endsWith(';') ? '' : ';') + `token=${m[1]}`;
      if (!cookie.trim()) {
        return { status: 'error', message: '登录成功但没有拿到 Cookie，请重试' };
      }
      s.cookie = cookie;
      s.token = m[1];
      s.accountName = login.data?.nickname || login.data?.user_name || '';
      s.status = 'done';
      let wechatAccounts = [];
      try {
        const acc = await getPublicAccounts(m[1], cookie);
        if (acc.success) wechatAccounts = acc.accounts;
      } catch {
        /* 账号列表同步失败不阻塞登录 */
      }
      return {
        status: 'done',
        cookie,
        token: s.token,
        accountName: s.accountName,
        wechatAccounts,
        message: '登录成功',
      };
    }
    return { status: 'waiting', message: '等待扫码' };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}

/* ---------------- 小红书 ---------------- */

async function createXhsSession() {
  const mod = await import('xhshow-js');
  const client = new mod.Client();
  const jar = new CookieJar();
  const a1 = mod.generateA1();
  jar.set('a1', a1, 'xiaohongshu.com');
  jar.set('webId', mod.registerId(), 'xiaohongshu.com');

  const uri = '/api/sns/web/v1/login/qrcode/create';
  const cookieStr = jar.getCookieString('https://www.xiaohongshu.com');
  const headers = await buildSignedHeaders('POST', uri, {}, cookieStr);
  const res = await fetch('https://edith.xiaohongshu.com' + uri, {
    method: 'POST',
    headers,
    body: '{}',
  });
  const { data } = await jsonOrThrow(res, '小红书二维码');
  if (!data || data.success !== true) {
    throw new Error(
      `小红书二维码创建失败：${data?.msg || data?.message || '未知错误'}`,
    );
  }
  const d = data.data || data;
  jar.setFromResponse(res, 'https://www.xiaohongshu.com');
  if (!d?.qr_id || !d?.code || !d?.url) {
    throw new Error('小红书二维码创建失败：接口返回缺少必要字段');
  }
  const qrDataUrl = await QRCode.toDataURL(String(d.url), {
    width: 280,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
  const sessionObj = storeSession({
    id: newSessionId('xhs'),
    platform: 'xhs',
    mode: 'qr',
    jar,
    a1,
    qrId: String(d.qr_id),
    code: String(d.code),
    qrDataUrl,
    status: 'pending',
    message: '请用小红书 App 扫码',
    createdAt: Date.now(),
    expiresAt: Date.now() + 240000,
  });
  return sanitizeSession(sessionObj);
}

async function pollXhsSession(id) {
  const s = getSession(id);
  if (!s) return { status: 'error', message: '登录会话不存在' };
  if (s.status === 'done') {
    return {
      status: 'done',
      cookie: s.cookie,
      accountName: s.accountName || '',
      message: '登录成功',
    };
  }
  if (Date.now() > s.expiresAt) {
    s.status = 'expired';
    return { status: 'expired', message: '二维码已过期，请重新获取' };
  }
  try {
    const uri = '/api/sns/web/v1/login/qrcode/status';
    const params = { qr_id: s.qrId, code: s.code };
    const cookieStr = s.jar.getCookieString('https://www.xiaohongshu.com');
    const headers = await buildSignedHeaders('GET', uri, params, cookieStr);
    const query = new URLSearchParams(params).toString();
    const res = await fetch(
      `https://edith.xiaohongshu.com${uri}?${query}`,
      { headers },
    );
    const { data } = await jsonOrThrow(res, '小红书扫码状态');
    s.jar.setFromResponse(res, 'https://www.xiaohongshu.com');
    if (!data || data.success !== true) {
      return {
        status: 'error',
        message: `小红书扫码状态失败：${data?.msg || data?.message || '未知错误'}`,
      };
    }
    const d = data.data || data;
    const codeStatus = Number(d?.code_status);
    if (codeStatus === 0) {
      return { status: 'waiting', message: '请用小红书 App 扫描二维码' };
    }
    if (codeStatus === 1) {
      s.status = 'scanned';
      return { status: 'scanned', message: '已扫码，请在手机上确认登录' };
    }
    if (codeStatus === 2) {
      const activateUri = '/api/sns/web/v1/login/activate';
      const activateHeaders = await buildSignedHeaders(
        'POST',
        activateUri,
        {},
        s.jar.getCookieString('https://www.xiaohongshu.com'),
      );
      try {
        await fetch('https://edith.xiaohongshu.com' + activateUri, {
          method: 'POST',
          headers: activateHeaders,
          body: '{}',
        });
      } catch {
        /* activate 失败不阻塞，Cookie 已带上 */
      }
      s.cookie = s.jar.getCookieString('https://www.xiaohongshu.com');
      s.accountName =
        d?.login_info?.nickname || d?.login_info?.user_name || '';
      s.status = 'done';
      return {
        status: 'done',
        cookie: s.cookie,
        accountName: s.accountName,
        message: '登录成功',
      };
    }
    return { status: 'waiting', message: '等待扫码' };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}

function cancelSession(id) {
  const s = getSession(id);
  if (!s) return;
  SESSIONS.delete(id);
}

/* ---------------- 头条号 / 百家号 网页登录 ---------------- */

function firstNonEmpty(...values) {
  return (
    values.find((v) => v !== undefined && v !== null && String(v).trim() !== '') ||
    ''
  );
}

async function fetchToutiaoProfile(cookie) {
  const cookieMap = {};
  String(cookie || '')
    .split(';')
    .forEach((part) => {
      const idx = part.indexOf('=');
      if (idx > 0) cookieMap[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
    });
  const csrf = cookieMap.passport_csrf_token || '';
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    Origin: 'https://mp.toutiao.com',
    Referer: 'https://mp.toutiao.com/profile_v4/graphic/publish',
    Cookie: cookie,
    ...(csrf ? { 'x-secsdk-csrf-token': csrf } : {}),
  };
  try {
    const res = await fetch(
      'https://mp.toutiao.com/mp/agw/creator_center/user_info?app_id=1231',
      { headers, signal: AbortSignal.timeout(15000) },
    );
    const data = await res.json().catch(() => null);
    if (Number(data?.code) === 0) {
      const d = data || {};
      return {
        userId: firstNonEmpty(d.media_id, d.user_id, d.user_id_str, cookieMap.uid_tt, cookieMap.uid_tt_ss),
        nickname: firstNonEmpty(d.name, d.screen_name, d.nickname),
        avatar: firstNonEmpty(d.avatar_url, d.avatar),
      };
    }
  } catch {
    /* ignore */
  }
  return {
    userId: firstNonEmpty(cookieMap.uid_tt, cookieMap.uid_tt_ss),
    nickname: '',
    avatar: '',
  };
}

async function fetchBaijiahaoProfile(cookie) {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    Origin: 'https://baijiahao.baidu.com',
    Referer: 'https://baijiahao.baidu.com/builder/rc/home',
    Cookie: cookie,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  let token = '';
  try {
    const tk = await fetch('https://baijiahao.baidu.com/pcui/home/dealtoken', {
      method: 'POST',
      headers,
      body: '',
      signal: AbortSignal.timeout(15000),
    });
    token = String(tk.headers.get('token') || '').trim();
  } catch {
    /* ignore */
  }
  try {
    const res = await fetch(
      'https://baijiahao.baidu.com/userb/user/loginInfo?uc_login=0',
      {
        headers: { ...headers, ...(token ? { token } : {}) },
        signal: AbortSignal.timeout(15000),
      },
    );
    const data = await res.json().catch(() => null);
    if (Number(data?.errno) === 0) {
      const d = data?.data || {};
      return {
        userId: firstNonEmpty(d.app_id, d.uk),
        nickname: firstNonEmpty(d.name, d.nickname),
        avatar: firstNonEmpty(d.avatar, d.avatar_url),
      };
    }
  } catch {
    /* ignore */
  }
  return { userId: '', nickname: '', avatar: '' };
}

async function fetchXhsProfile(cookie) {
  const attempts = [
    {
      path: '/api/galaxy/user/info',
      parse: (d) => ({
        userId: String(d.redId || d.red_id || d.userId || d.user_id || ''),
        nickname: String(d.userName || d.name || ''),
        avatar: String(d.userAvatar || d.avatar || ''),
      }),
    },
    {
      path: '/api/galaxy/creator/home/personal_info',
      parse: (d) => ({
        userId: String(d.red_num || d.redNum || d.red_id || d.redId || d.userId || d.user_id || ''),
        nickname: String(d.name || d.userName || ''),
        avatar: String(d.avatar || d.userAvatar || ''),
      }),
    },
  ];
  for (const attempt of attempts) {
    try {
      const headers = {
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Content-Type': 'application/json',
        Cookie: cookie,
        'User-Agent': UA,
        Referer: 'https://creator.xiaohongshu.com/',
        Origin: 'https://creator.xiaohongshu.com',
      };
      const res = await fetch('https://creator.xiaohongshu.com' + attempt.path, {
        headers,
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json().catch(() => null);
      const ok = data && (data.success === true || Number(data.code) === 0 || Number(data.result) === 0);
      if (ok && data?.data && typeof data.data === 'object') {
        const d =
          data.data.user_info && typeof data.data.user_info === 'object'
            ? data.data.user_info
            : data.data;
        const profile = attempt.parse(d);
        if (profile.nickname || profile.userId || profile.avatar) {
          console.log(`[xhs-login] profile ok via ${attempt.path}: ${JSON.stringify(profile)}`);
          return profile;
        }
      } else {
        console.warn(`[xhs-login] profile ${attempt.path} response: HTTP ${res.status} ${JSON.stringify(data).slice(0, 120)}`);
      }
    } catch (e) {
      console.warn(`[xhs-login] profile ${attempt.path} error: ${e.message}`);
    }
  }
  return { userId: '', nickname: '', avatar: '' };
}

function parseCookieHeader(cookieString = '') {
  const map = {};
  String(cookieString || '')
    .split(';')
    .forEach((part) => {
      const idx = part.indexOf('=');
      if (idx > 0) map[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
    });
  return map;
}

function isCookieDomainMatched(domain = '', accepted = []) {
  const d = String(domain || '').toLowerCase();
  if (!d) return false;
  return (accepted || []).some((item) => {
    const t = String(item || '').toLowerCase();
    if (!t) return false;
    const normalized = t.replace(/^\./, '');
    return d === t || d === normalized || d.endsWith(`.${normalized}`) || d.endsWith(normalized);
  });
}

function serializeCookies(cookies = []) {
  return (cookies || [])
    .filter((c) => c && c.name)
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}

function hasAuthCookies(cookies = [], keys = []) {
  if (!keys.length) return cookies.length > 0;
  const names = new Set((cookies || []).map((c) => String(c.name || '').toLowerCase()));
  return keys.some((k) => names.has(String(k).toLowerCase()));
}

async function validatePlatformCookieByApi(platform, cookieString) {
  const cookie = String(cookieString || '').trim();
  if (!cookie) return false;
  const headers = {
    'User-Agent': UA,
    Accept: 'application/json, text/plain, */*',
    Cookie: cookie,
  };
  try {
    if (platform === 'xhs') {
      const profile = await fetchXhsProfile(cookie);
      return !!(profile.userId || profile.nickname);
    }
    if (platform === 'baijiahao') {
      const res = await fetch('https://baijiahao.baidu.com/userb/user/loginInfo?uc_login=0', {
        headers: {
          ...headers,
          Origin: 'https://baijiahao.baidu.com',
          Referer: 'https://baijiahao.baidu.com/builder/rc/home',
        },
        signal: AbortSignal.timeout(12000),
      });
      const data = await res.json().catch(() => null);
      if (Number(data?.errno) === 0) {
        const body = data?.data && typeof data.data === 'object' ? data.data : {};
        return !!(body?.app_id || body?.uk);
      }
      return false;
    }
    if (platform !== 'toutiao') return false;
    const csrf = parseCookieHeader(cookie).passport_csrf_token || '';
    const res = await fetch(
      'https://mp.toutiao.com/mp/agw/article/new?article_type=0&format=json&compat=1&column_no=',
      {
        headers: {
          ...headers,
          Origin: 'https://mp.toutiao.com',
          Referer: 'https://mp.toutiao.com/profile_v4/graphic/publish',
          ...(csrf ? { 'x-secsdk-csrf-token': csrf } : {}),
        },
        signal: AbortSignal.timeout(12000),
      },
    );
    const data = await res.json().catch(() => null);
    const code = data?.code;
    return code === 0 || code === null || code === undefined;
  } catch {
    return false;
  }
}

async function collectPlatformCookies(ses, cfg, retry = 20, intervalMs = 500) {
  const broadHints =
    cfg.platform === 'baijiahao'
      ? ['baidu.com', 'baijiahao.baidu.com']
      : cfg.platform === 'xhs'
        ? ['xiaohongshu.com', 'xhscdn.com']
        : ['toutiao.com', 'mp.toutiao.com', 'bytedance.com', 'snssdk.com'];
  for (let i = 0; i < retry; i += 1) {
    const cookies = await ses.cookies.get({});
    let matched = cookies.filter((c) => isCookieDomainMatched(c.domain, cfg.cookieDomains || []));
    if (!matched.length) {
      matched = cookies.filter((c) => {
        const d = String(c.domain || '').toLowerCase();
        return broadHints.some((k) => d.includes(k));
      });
    }
    if (!matched.length && cfg.platform === 'toutiao') {
      const keySet = new Set(['sessionid', 'sessionid_ss', 'uid_tt', 'uid_tt_ss', 'sid_tt', 'passport_csrf_token', 'ttwid']);
      matched = cookies.filter((c) => keySet.has(String(c.name || '').toLowerCase()));
    }
    if (!matched.length && cookies.length) matched = cookies;
    const cookieString = serializeCookies(matched);
    if (cookieString) {
      if (hasAuthCookies(matched, cfg.authCookieKeys || []) && cfg.platform !== 'xhs') return cookieString;
      const validated = await validatePlatformCookieByApi(cfg.platform, cookieString);
      if (validated) return cookieString;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return '';
}

async function createWebLoginSession(platform) {
  const cfg = WEB_LOGIN_CONFIG[platform];
  if (!cfg || !BrowserWindow) {
    return { ok: false, error: `不支持的平台：${platform}` };
  }
  const id = newSessionId(platform);
  const ses = electronSession.fromPartition(cfg.partition);
  await ses.clearStorageData({ storages: ['cookies'] }).catch(() => {});
  const parentWin = BrowserWindow.getFocusedWindow();
  const win = new BrowserWindow({
    width: 860,
    height: 760,
    show: false,
    icon: path.join(__dirname, 'icon.png'),
    parent: parentWin || undefined,
    modal: false,
    title: `${cfg.label}登录`,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      partition: cfg.partition,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.once('ready-to-show', () => {
    try {
      if (!win.isDestroyed()) win.show();
    } catch {}
  });
  if (typeof ses.setUserAgent === 'function') ses.setUserAgent(UA);
  win.webContents.setUserAgent(UA);
  win.webContents.on('did-fail-load', (_e, _code, desc, url) => {
    // 页面跳转中断（ERR_ABORTED）属正常，仅记录其它加载失败
    if (!String(desc || '').includes('ERR_ABORTED')) {
      s.status = s.status === 'done' ? s.status : 'error';
      if (s.status === 'error' && !s.message) s.message = `页面加载失败：${desc} (${url})`;
    }
  });
  const s = storeSession({
    id,
    platform,
    mode: 'web',
    win,
    ses,
    status: 'pending',
    message: '请在打开的登录窗口完成登录',
    loginUrl: cfg.url,
    createdAt: Date.now(),
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  const openedAt = Date.now();
  const minDetectMs = 2000;
  let handled = false;
  let cookieProbeRetries = 0;
  const maxCookieProbeRetries = 8;

  const handleNav = async (url) => {
    if (handled) return;
    if (!cfg.successRe.test(url)) return;
    if (Date.now() - openedAt < minDetectMs) return;
    handled = true;
    s.status = 'processing';
    try {
      // 微信：参考项目直接采集会话里的全部 cookie（不过滤域名），保证 slave_sid/data_ticket 等完整
      const cookieStr =
        platform === 'wechat'
          ? serializeCookies(await ses.cookies.get({}))
          : await collectPlatformCookies(ses, cfg);
      if (!cookieStr) {
        if (cookieProbeRetries < maxCookieProbeRetries) {
          cookieProbeRetries += 1;
          handled = false;
          setTimeout(() => {
            try {
              if (!win.isDestroyed()) handleNav(win.webContents.getURL());
            } catch {
              /* ignore */
            }
          }, 1000);
          return;
        }
        throw new Error('未获取到有效 Cookie，请确认已完成平台登录');
      }
      if (platform === 'wechat') {
        const tokenMatch = url.match(/[?&]token=(\d+)/);
        const token = tokenMatch ? tokenMatch[1] : '';
        if (!token) throw new Error('未获取到微信 token');
        s.token = token;
        s.userId = token;
        // 参考项目：登录成功与账号同步解耦，同步失败不阻塞登录成功
        try {
          const acc = await getPublicAccounts(token, cookieStr);
          if (acc.success && acc.accounts.length) {
            const first = acc.accounts.find((x) => x.kind !== 'wxa') || acc.accounts[0];
            s.wechatAccounts = acc.accounts;
            s.accountName = first?.nickname || '';
            s.avatar = first?.headImg || '';
            console.log(
              `[wechat-login] sync ok: accounts=${acc.accounts.length} first=${first?.nickname || ''}`,
            );
          } else {
            console.warn(
              `[wechat-login] sync failed (login ok): ${acc.error || 'empty accounts'}`,
            );
          }
        } catch (err) {
          console.warn(`[wechat-login] sync exception (login ok): ${err.message}`);
        }
      } else {
        const profile =
          platform === 'toutiao'
            ? await fetchToutiaoProfile(cookieStr)
            : platform === 'xhs'
              ? await fetchXhsProfile(cookieStr)
              : await fetchBaijiahaoProfile(cookieStr);
        const userId = String(
          profile.userId ||
            parseCookieHeader(cookieStr).uid_tt ||
            parseCookieHeader(cookieStr).BDUSS ||
            parseCookieHeader(cookieStr)['x-user-id-creator.xiaohongshu.com'] ||
            '',
        ).trim();
        const cookieMap = parseCookieHeader(cookieStr);
        console.log(
          `[xhs-login] collect done: cookieLen=${cookieStr.length} a1=${!!cookieMap.a1} userId=${userId} nickname=${profile.nickname} avatar=${profile.avatar ? '有' : '空'}`,
        );
        if (!userId || userId === '0' || !profile.nickname) {
          throw new Error(
            `账号信息解析不完整（userId=${userId || '空'}，昵称=${profile.nickname || '空'}，头像=${profile.avatar ? '有' : '空'}），请重新扫码登录`,
          );
        }
        s.token = platform === 'baijiahao' ? profile.token || '' : '';
        s.userId = userId;
        s.accountName = profile.nickname || '';
        s.avatar = profile.avatar || '';
      }
      s.cookie = cookieStr;
      s.status = 'done';
      s.message = '登录成功';
    } catch (err) {
      handled = false;
      s.status = 'error';
      s.message = err.message || '登录处理失败';
    }
    if (s.status === 'done') {
      setTimeout(() => {
        try {
          if (!win.isDestroyed()) win.close();
        } catch {
          /* ignore */
        }
      }, 1200);
    }
  };
  win.webContents.on('did-finish-load', () => handleNav(win.webContents.getURL()));
  win.webContents.on('did-navigate', (_e, url) => handleNav(url));
  win.webContents.on('did-navigate-in-page', (_e, url) => handleNav(url));
  win.on('closed', () => {
    s.win = null;
    if (s.status === 'pending' || s.status === 'processing') s.status = 'closed';
  });
  try {
    await win.loadURL(cfg.url, { extraHeaders: cfg.extraHeaders || undefined });
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    if (!msg.includes('ERR_ABORTED')) {
      s.status = 'error';
      s.message = `登录页加载失败：${msg}`;
    }
  }
  // 页面先加载完成，再注入指纹并刷新（先 attach 再导航在部分 Electron 版本会阻塞窗口显示）
  const hardened = await hardenLoginWebContents(win.webContents, UA);
  if (hardened) {
    console.log(`[login] ${platform} fingerprint hardened`);
    await reloadAndWait(win.webContents);
  }
  try {
    if (!win.isDestroyed() && !win.isVisible()) win.show();
  } catch {}
  return { ok: true, session: sanitizeSession(s) };
}

async function pollWebSession(id) {
  const s = getSession(id);
  if (!s) return { status: 'error', message: '登录会话不存在' };
  if (s.status === 'done') {
    return {
      status: 'done',
      cookie: s.cookie,
      token: s.token,
      accountName: s.accountName,
      userId: s.userId,
      avatar: s.avatar,
      wechatAccounts: s.wechatAccounts || [],
      message: '登录成功',
    };
  }
  if (s.status === 'error') return { status: 'error', message: s.message };
  if (s.status === 'closed') return { status: 'closed', message: '登录窗口已关闭' };
  return { status: 'waiting', message: s.message || '请在打开的登录窗口完成登录' };
}

async function createLoginSession(platform) {
  if (platform === '公众号') platform = 'wechat';
  if (platform === '小红书') platform = 'xhs';
  if (platform === '头条号') platform = 'toutiao';
  if (platform === '百家号') platform = 'baijiahao';
  if (platform === 'xiaohongshu') platform = 'xhs';
  if (platform === 'wechat') {
    return await createWebLoginSession('wechat');
  }
  if (platform === 'xhs') {
    return await createWebLoginSession('xhs');
  }
  if (platform === 'toutiao' || platform === 'baijiahao') {
    return await createWebLoginSession(platform);
  }
  return { ok: false, error: `不支持的平台：${platform}` };
}

async function pollLoginSession(id) {
  const s = getSession(id);
  if (!s) return { status: 'error', message: '登录会话不存在' };
  if (s.platform === 'wechat') return pollWebSession(id);
  if (s.platform === 'xhs' || s.platform === 'toutiao' || s.platform === 'baijiahao') {
    return pollWebSession(id);
  }
  return { status: 'error', message: `不支持的平台：${s.platform}` };
}

module.exports = {
  createLoginSession,
  pollLoginSession,
  cancelSession,
  getSession,
  sanitizeSession,
};
