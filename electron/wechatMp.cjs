'use strict';

const https = require('https');
const urllib = require('url');
const images = require('./images.cjs');

const BASE_URL = 'https://mp.weixin.qq.com';
const DEFAULT_FINGERPRINT = '35dc47301bd07b69891ae7968e00661d';
const PUBLISH_PARTITION = 'persist:wechat-publish';
let publishSession = null;
let sessionWork = Promise.resolve();

// 切号和写入必须作为整体串行，避免托管、手动操作和保活交错切换身份。
function withSession(work) {
  const result = sessionWork.then(work);
  sessionWork = result.catch(() => {});
  return result;
}

function assertAccount(cookies, username) {
  if (username && getCookieValue(cookies, 'slave_user') !== username) {
    throw new Error('公众号登录身份与目标账号不一致，已停止操作，请在账号中心重新登录');
  }
}

function getPublishSession() {
  if (!publishSession) {
    try {
      // eslint-disable-next-line global-require
      const { session } = require('electron');
      publishSession = session.fromPartition(PUBLISH_PARTITION);
    } catch (err) {
      console.warn(`[wechatMp] publish session 不可用，降级为显式 cookie：${err.message}`);
      publishSession = null;
    }
  }
  return publishSession;
}

function platformUa() {
  return (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  );
}

// 对齐参考项目：同一 cookie name 只保留最后一个值，避免 session/数据库中出现重复 key 导致 invalid csrf
function dedupeCookies(cookieStr = '') {
  const map = new Map();
  for (const part of String(cookieStr || '').split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const name = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      if (name) map.set(name, value);
    }
  }
  return Array.from(map.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

function getCookieValue(cookieStr, key) {
  const m = String(cookieStr || '').match(new RegExp(`(?:^|;\\s*)${key}=([^;]+)`));
  return m ? m[1] : '';
}

function parseCookieHeader(cookieString = '') {
  const map = {};
  String(cookieString || '')
    .split(';')
    .forEach((part) => {
      const idx = part.indexOf('=');
      if (idx > 0) {
        const key = part.slice(0, idx).trim();
        const val = part.slice(idx + 1).trim();
        if (key) map[key] = val;
      }
    });
  return map;
}

// 对齐参考项目 main.js：解析 set-cookie 为 Electron cookies.set 格式（保留 domain/path）
function parseCookieString(str) {
  const parts = String(str)
    .split(';')
    .map((s) => s.trim());
  const [nameVal, ...attrs] = parts;
  const eqIdx = nameVal.indexOf('=');
  if (eqIdx <= 0) return null;
  const name = nameVal.slice(0, eqIdx);
  const value = nameVal.slice(eqIdx + 1);
  const result = { name, value };
  for (const attr of attrs) {
    const lower = attr.toLowerCase();
    if (lower.startsWith('domain=')) result.domain = attr.slice(7);
    else if (lower.startsWith('path=')) result.path = attr.slice(5);
    else if (lower === 'secure') result.secure = true;
    else if (lower === 'httponly') result.httpOnly = true;
    else if (lower.startsWith('expires=')) {
      const ts = new Date(attr.slice(8)).getTime();
      if (!Number.isNaN(ts)) result.expirationDate = Math.floor(ts / 1000);
    } else if (lower.startsWith('max-age=')) {
      const sec = parseInt(attr.slice(8), 10);
      if (Number.isFinite(sec)) result.expirationDate = Math.floor(Date.now() / 1000) + sec;
    }
  }
  return result;
}

async function clearPublishSessionState(fullClear = false) {
  const ses = getPublishSession();
  if (!ses) return 0;
  try {
    const all = await ses.cookies.get({});
    const targets = all.filter((c) => {
      const d = (c.domain || '').toLowerCase();
      if (!d.includes('weixin.qq.com') && !d.endsWith('.qq.com') && d !== 'qq.com') return false;
      if (!fullClear) return /^slave_/i.test(c.name);
      return true;
    });
    for (const c of targets) {
      const domain = (c.domain || '').replace(/^\./, '');
      const url = `${c.secure ? 'https' : 'http'}://${domain}${c.path || '/'}`;
      try {
        await ses.cookies.remove(url, c.name);
      } catch {
        /* ignore */
      }
    }
    await ses.cookies.flushStore();
    return targets.length;
  } catch (err) {
    console.warn(`[wechatMp] 清理发布会话失败：${err.message}`);
    return 0;
  }
}

// 对齐参考项目 loadCookiesToPublishSession：把账号 cookie 写入持久会话
async function loadCookiesToSession(cookieString = '', options = {}) {
  if (!cookieString) return;
  const ses = getPublishSession();
  if (!ses) return;
  try {
    await clearPublishSessionState(!!options.reset);
    const cookieMap = parseCookieHeader(cookieString);
    for (const [name, value] of Object.entries(cookieMap)) {
      try {
        await ses.cookies.set({
          url: 'https://mp.weixin.qq.com',
          name,
          value,
          domain: '.mp.weixin.qq.com',
          path: '/',
        });
      } catch {
        try {
          await ses.cookies.set({ url: 'https://mp.weixin.qq.com', name, value, path: '/' });
        } catch {
          /* ignore */
        }
      }
    }
    await ses.cookies.flushStore();
  } catch (err) {
    console.warn(`[wechatMp] 加载发布会话 cookie 失败：${err.message}`);
  }
}

async function getSessionCookies() {
  const ses = getPublishSession();
  if (!ses) return '';
  try {
    const cookies = await ses.cookies.get({ url: 'https://mp.weixin.qq.com' });
    // 同名 cookie 可能同时存在多个 path/domain 版本，取 path 最长（最精确）且过期最晚的值
    const best = new Map();
    for (const c of cookies) {
      const cur = best.get(c.name);
      if (!cur) {
        best.set(c.name, c);
        continue;
      }
      const pathLen = (c.path || '/').length;
      const curPathLen = (cur.path || '/').length;
      const exp = c.expirationDate || Infinity;
      const curExp = cur.expirationDate || Infinity;
      if (pathLen > curPathLen || (pathLen === curPathLen && exp > curExp)) best.set(c.name, c);
    }
    return Array.from(best.values())
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');
  } catch (err) {
    console.warn(`[wechatMp] 读取发布会话 cookie 失败：${err.message}`);
    return '';
  }
}

// 对齐参考项目：同一微信登录身份内增量保留会话 cookie（只清 slave_*），
// 切换了微信登录身份才全量重置，避免每次操作把积累的 path/domain cookie 冲掉
async function seedSession(cookieString) {
  if (!cookieString) return;
  try {
    const current = await getSessionCookies();
    const curUser = getCookieValue(current, 'slave_user');
    const nextUser = getCookieValue(cookieString, 'slave_user');
    const curBiz = getCookieValue(current, 'bizuin');
    const nextBiz = getCookieValue(cookieString, 'bizuin');
    const sameAccount = !!curUser && !!nextUser && curUser === nextUser && curBiz === nextBiz;
    await loadCookiesToSession(cookieString, { reset: !sameAccount });
  } catch (err) {
    console.warn(`[wechatMp] seedSession 失败：${err.message}`);
  }
}

async function persistSetCookiesToSession(res) {
  try {
    const ses = getPublishSession();
    if (!ses) return;
    const list =
      typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    if (!list.length) {
      const raw = res.headers.get('set-cookie');
      if (raw) list.push(raw);
    }
    for (const sc of list) {
      const parsed = parseCookieString(sc);
      if (!parsed) continue;
      try {
        await ses.cookies.set({ url: 'https://mp.weixin.qq.com', ...parsed });
      } catch {
        /* ignore */
      }
    }
    await ses.cookies.flushStore();
  } catch (err) {
    console.warn(`[wechatMp] persist set-cookie failed: ${err.message}`);
  }
}

// 发布/上传链路里每一步都可能刷新 cookie，用同一个 state 传递最新 cookie，
// 避免后续请求继续用旧 cookie 导致微信判定会话异常（掉线）
function createReqState(initialCookie = '') {
  const state = { value: initialCookie, seeded: false };
  state.req = async (url, opts = {}) => {
    if (!state.seeded) {
      await seedSession(state.value);
      state.seeded = true;
    }
    const r = await requestJson(url, { ...opts, cookies: state.value });
    const sc = r.headers?.['set-cookie'];
    const rawList = Array.isArray(sc) ? sc : sc ? [sc] : [];
    const hasLiveSetCookie =
      rawList.length === 0 || rawList.some((x) => !/expired/i.test(String(x)));
    // 失败响应常返回“全部 EXPIRED”的 set-cookie，合并会清空当前账号 cookie，必须跳过
    if (hasLiveSetCookie) {
      state.value = setCookiesFromResponse(state.value, r.headers);
    }
    return r;
  };
  return state;
}


function buildHeaders(cookies, token, extra = {}) {
  return {
    'User-Agent': platformUa(),
    Cookie: dedupeCookies(cookies),
    Referer: `${BASE_URL}/cgi-bin/home?t=home/index&token=${token || ''}&lang=zh_CN`,
    Origin: BASE_URL,
    'X-Requested-With': 'XMLHttpRequest',
    Accept: '*/*',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'sec-ch-ua': '"Chromium";v="131", "Not_A Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-site': 'same-origin',
    'sec-fetch-mode': 'cors',
    'sec-fetch-dest': 'empty',
    priority: 'u=1, i',
    ...extra,
  };
}

// 对齐参考项目 main.js makeWechatNetRequest：
// 使用 Node https.request + 发布会话（按 domain/path 保存 set-cookie），手工跟随重定向
function makeWechatNetRequest(url, method = 'GET', postData = null, headers = {}, options = {}) {
  const { persistSetCookies = true, timeoutMs = 30000, cookieString = '' } = options;
  const parsed = urllib.parse(url);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: parsed.hostname,
        port: 443,
        path: parsed.pathname + (parsed.search || ''),
        method,
        headers,
      },
      (resp) => {
        let responseData = '';
        resp.on('data', (chunk) => {
          responseData += chunk;
        });
        resp.on('end', async () => {
          let data;
          try {
            data = JSON.parse(responseData);
          } catch {
            data = responseData;
          }
          const shouldPersist =
            typeof persistSetCookies === 'function'
              ? persistSetCookies(data, resp.statusCode)
              : persistSetCookies !== false;
          const setCookies = resp.headers['set-cookie'];
          if (setCookies && shouldPersist) {
            try {
              const ses = getPublishSession();
              if (ses) {
                for (const sc of setCookies) {
                  const parsedCookie = parseCookieString(sc);
                  if (!parsedCookie) continue;
                  try {
                    await ses.cookies.set({ url: 'https://mp.weixin.qq.com', ...parsedCookie });
                  } catch {
                    /* ignore */
                  }
                }
                await ses.cookies.flushStore();
              }
            } catch (err) {
              console.warn(`[wechatMp] set-cookie 写入会话失败：${err.message}`);
            }
          }
          if ([301, 302, 303, 307, 308].includes(resp.statusCode) && resp.headers.location) {
            let redirectUrl = resp.headers.location;
            if (redirectUrl.startsWith('/')) {
              redirectUrl = `${BASE_URL}${redirectUrl}`;
            }
            const redirectHeaders = { ...headers };
            delete redirectHeaders['Content-Length'];
            delete redirectHeaders['Content-Type'];
            return makeWechatNetRequest(redirectUrl, 'GET', null, redirectHeaders, {
              ...options,
              cookieString,
            })
              .then(resolve)
              .catch(reject);
          }
          resolve({
            status: resp.statusCode,
            data,
            headers: resp.headers,
            finalUrl: url,
          });
        });
      },
    );
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`wechat request timeout after ${timeoutMs}ms: ${method} ${url.slice(0, 120)}`));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function requestJson(
  url,
  {
    method = 'GET',
    cookies,
    token,
    form,
    rawBody,
    extraHeaders = {},
    timeoutMs = 30000,
    persistSetCookies = true,
  } = {},
) {
  const headers = buildHeaders(cookies || '', token, extraHeaders);
  if (method === 'POST' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
  }
  let body;
  if (method === 'POST') {
    if (rawBody !== undefined) body = rawBody;
    else if (form) body = new URLSearchParams(form).toString();
  }
  if (method === 'POST' && body !== undefined) {
    headers['Content-Length'] = String(Buffer.byteLength(body));
  }
  const res = await makeWechatNetRequest(url, method, body, headers, {
    method,
    persistSetCookies,
    timeoutMs,
    cookieString: cookies || '',
  });
  return {
    status: res.status,
    data: res.data,
    text: typeof res.data === 'string' ? res.data : '',
    headers: res.headers,
    finalUrl: res.finalUrl,
  };
}

function setCookiesFromResponse(current, resHeaders) {
  const map = {};
  String(current || '')
    .split(';')
    .forEach((part) => {
      const idx = part.indexOf('=');
      if (idx > 0) map[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
    });
  const list = typeof resHeaders.getSetCookie === 'function' ? resHeaders.getSetCookie() : [];
  if (!list.length) {
    const raw = typeof resHeaders.get === 'function' ? resHeaders.get('set-cookie') : resHeaders['set-cookie'];
    if (raw) {
      if (Array.isArray(raw)) list.push(...raw);
      else list.push(raw);
    }
  }
  for (const sc of list) {
    const first = String(sc).split(';')[0];
    const idx = first.indexOf('=');
    if (idx <= 0) continue;
    const key = first.slice(0, idx).trim();
    const val = first.slice(idx + 1).trim();
    if (val === 'EXPIRED' || val === '') delete map[key];
    else map[key] = val;
  }
  return Object.entries(map)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

async function getWxaList(token, cookies) {
  const params = new URLSearchParams({
    token,
    lang: 'zh_CN',
    random: String(Math.random()),
  });
  const r = await requestJson(`${BASE_URL}/wxamp/cgi/getWxaList?${params}`, {
    cookies,
    token,
    extraHeaders: {
      Referer: `${BASE_URL}/wxamp/index/index?lang=zh_CN&token=${token}`,
    },
  });
  const data = r.data;
  const list = data?.wax_list || data?.wxa_list || data?.wxaList || [];
  const map = {};
  for (const it of list) {
    const key = it.username || it.user_name || '';
    if (key && it.appid) map[key] = it.appid;
  }
  console.log(
    `[wechatMp] getWxaList: list=${list.length} map=${Object.keys(map).length} sample=${JSON.stringify(
      list.slice(0, 3).map((x) => ({
        username: x.username || x.user_name || '',
        appid: x.appid || '',
        type: x.type,
      })),
    )}`,
  );
  return map;
}

async function getPublicAccounts(token, cookies, fingerprint = DEFAULT_FINGERPRINT) {
  const params = new URLSearchParams({
    action: 'get_acct_list',
    fingerprint,
    token,
    lang: 'zh_CN',
    f: 'json',
    ajax: '1',
  });
  const r = await requestJson(`${BASE_URL}/cgi-bin/switchacct?${params}`, {
    cookies,
    token,
  });
  const data = r.data;
  if (!data || !data.base_resp || data.base_resp.ret !== 0) {
    return {
      success: false,
      error: data?.base_resp?.err_msg || `API错误 ret=${data?.base_resp?.ret}`,
      accounts: [],
    };
  }
  const accounts = [];
  const push = (list) => {
    for (const acc of list || []) {
      accounts.push({
        username: acc.username,
        nickname: acc.nickname,
        bizuin: String(acc.bizuin || acc.user_name || ''),
        headImg: acc.headimgurl || acc.head_img || '',
        appid: acc.appid || '',
        acctType: acc.acct_type,
        enabled: acc.enabled !== false,
      });
    }
  };
  push(data.biz_list?.list);
  push(data.service_biz_list?.list);
  // 小程序列表（wxa_list）- acct_type=2，结构与 biz_list 相同：{ list: [...] }
  const wxaList = data.wxa_list?.list || data.wxamp_list?.list || [];
  for (const acc of wxaList) {
    if (!accounts.find((a) => a.username === acc.username)) {
      accounts.push({
        username: acc.username,
        nickname: acc.nickname,
        bizuin: String(acc.bizuin || acc.user_name || ''),
        headImg: acc.headimgurl || acc.head_img || '',
        appid: acc.appid || '',
        acctType: 2,
        enabled: acc.enabled !== false,
      });
    }
  }
  let wxaMap = {};
  try {
    wxaMap = await getWxaList(token, cookies);
  } catch (err) {
    /* 小程序列表失败不影响公众号 */
    console.warn(`[wechatMp] getWxaList failed: ${err.message}`);
  }
  for (const acc of accounts) {
    const acctType = Number(acc.acctType || 1);
    if (acctType === 2 && !acc.appid) acc.appid = wxaMap[acc.username] || '';
    acc.kind = acctType === 2 ? 'wxa' : 'mp';
  }
  const filtered = accounts.filter((acc) => {
    if ((acc.nickname || '').includes('测试')) return false;
    return true;
  });
  console.log(
    `[wechatMp] sync accounts: total=${accounts.length} mp=${filtered.filter((x) => x.kind === 'mp').length} wxa=${filtered.filter((x) => x.kind === 'wxa').length}`,
  );
  return { success: true, accounts: filtered };
}

async function extractLatestToken(baseToken, cookies, { quiet = false } = {}) {
  // 对齐参考项目：请求根路径而非 cgi-bin/home，从 finalUrl 或页面 HTML 提取最新 token
  try {
    const r = await requestJson(`${BASE_URL}/`, {
      cookies,
      token: baseToken,
      extraHeaders: {
        Referer: `${BASE_URL}/cgi-bin/home?t=home/index&token=${baseToken}&lang=zh_CN`,
      },
    });
    let token = baseToken;
    let found = false;
    if (r.finalUrl) {
      const m = String(r.finalUrl).match(/token=(\d+)/);
      if (m) {
        token = m[1];
        found = true;
      }
    }
    if (!found && typeof r.text === 'string') {
      const patterns = [
        /window\.wx\.commonData\s*=\s*\{[^}]*?token\s*[:=]\s*["']?(\d{6,})["']?/,
        /\btoken\s*[:=]\s*["']?(\d{6,})["']?/,
        /[&?]token=(\d{6,})/,
      ];
      for (const pat of patterns) {
        const m = r.text.match(pat);
        if (m) {
          token = m[1];
          found = true;
          break;
        }
      }
    }
    if (!quiet && token !== baseToken) {
      console.log(`[wechatMp] extractLatestToken: rotated ${baseToken} -> ${token}`);
    }
    // 实测：发布成功的那次用的正是“根路径 set-cookie 合并后的 cookie 串”，
    // 不合并反而导致保存草稿 200003。仅在确认登录态（found）时合并，避免登录页污染
    const mergedCookies = setCookiesFromResponse(cookies, r.headers);
    return { token: token || baseToken, cookies: found ? mergedCookies : cookies, found };
  } catch (err) {
    console.warn(`[wechatMp] extractLatestToken failed: ${err.message}`);
    return { token: baseToken, cookies };
  }
}

async function switchAccount(token, cookies, username, fingerprint = DEFAULT_FINGERPRINT) {
  const getCookie = (ck, key) => {
    const m = String(ck || '').match(new RegExp(`(?:^|;\\s*)${key}=([^;]+)`));
    return m ? m[1] : '';
  };

  // 对齐参考项目：先用 DB cookies 请求根路径预热（提取最新 token + 合并 set-cookie）
  await seedSession(cookies);
  const preheated = await extractLatestToken(token, cookies);
  let switchToken = preheated.token;
  let switchCookies = preheated.cookies;
  console.log(
    `[wechatMp] switch preheat: token=${switchToken} cookiesLen=${String(switchCookies).length} username=${username}`,
  );

  const slaveUser = getCookie(switchCookies, 'slave_user');
  const alreadyOnTarget =
    slaveUser === username &&
    !!getCookie(switchCookies, 'master_sid') &&
    !!getCookie(switchCookies, 'slave_sid');
  if (alreadyOnTarget) {
    return {
      success: true,
      cookies: switchCookies,
      token: switchToken,
      username,
      currentUsername: username,
    };
  }

  const trySwitch = async (tk, ck) => {
    const r = await requestJson(`${BASE_URL}/cgi-bin/switchacct?action=switch`, {
      method: 'POST',
      cookies: ck,
      token: tk,
      form: {
        f: 'json',
        username,
        fingerprint,
        token: tk,
        lang: 'zh_CN',
        ajax: '1',
      },
      extraHeaders: {
        Referer: `${BASE_URL}/cgi-bin/home?t=home/index&token=${tk}&lang=zh_CN`,
        'X-Requested-With': 'XMLHttpRequest',
      },
      // 对齐参考项目：switch 失败时丢弃其 set-cookie，避免污染身份 cookie
      persistSetCookies: (data) => Number(data?.base_resp?.ret) === 0,
    });
    const sc = r.headers?.['set-cookie'] || [];
    if (Array.isArray(sc) && sc.length) {
      console.log(
        `[wechatMp] switch set-cookie[${sc.length}]: ${sc.map((x) => String(x).split(';')[0]).join(', ')}`,
      );
    }
    return r;
  };

  let resp = await trySwitch(switchToken, switchCookies);
  let data = resp.data || {};
  let ret = data?.base_resp?.ret;
  let errMsg = data?.base_resp?.err_msg;
  // 对齐参考项目：switch 失败时丢弃其 set-cookie，避免污染身份 cookie
  if (ret === 0) switchCookies = setCookiesFromResponse(switchCookies, resp.headers);
  console.log(
    `[wechatMp] switch try#1 ${username}: ret=${ret} err=${errMsg} cookiesLen=${String(switchCookies).length}`,
  );

  // invalid csrf / 200040：对齐参考项目，先从根路径刷新 token，token 变化后再重试一次
  if (ret === 200040 || errMsg === 'invalid csrf token') {
    const refreshed = await extractLatestToken(switchToken, switchCookies);
    if (refreshed.token && refreshed.token !== switchToken) {
      switchToken = refreshed.token;
      switchCookies = refreshed.cookies;
      console.log(`[wechatMp] switch csrf retry with token=${switchToken}`);
      resp = await trySwitch(switchToken, switchCookies);
      data = resp.data || {};
      ret = data?.base_resp?.ret;
      errMsg = data?.base_resp?.err_msg;
      if (ret === 0) switchCookies = setCookiesFromResponse(switchCookies, resp.headers);
      console.log(
        `[wechatMp] switch try#2 ${username}: ret=${ret} err=${errMsg} cookiesLen=${String(switchCookies).length}`,
      );
    }
  }

  // system error / 200003：预热会话后重试一次
  if (ret === -1 || errMsg === 'system error' || ret === 200003) {
    const refreshed = await extractLatestToken(switchToken, switchCookies);
    switchToken = refreshed.token || switchToken;
    switchCookies = refreshed.cookies || switchCookies;
    console.log(`[wechatMp] switch system/200003 retry with token=${switchToken}`);
    resp = await trySwitch(switchToken, switchCookies);
    data = resp.data || {};
    ret = data?.base_resp?.ret;
    errMsg = data?.base_resp?.err_msg;
    if (ret === 0) switchCookies = setCookiesFromResponse(switchCookies, resp.headers);
    console.log(
      `[wechatMp] switch try#3 ${username}: ret=${ret} err=${errMsg} cookiesLen=${String(switchCookies).length}`,
    );
  }

  // 重复切换时微信可能返回 201501，以 cookie 确认真实账号
  if (ret === 201501) {
    const confirm = await extractLatestToken(switchToken, switchCookies);
    if (getCookie(confirm.cookies, 'slave_user') === username) {
      console.log(`[wechatMp] switch ret=201501 but session is already on target: ${username}`);
      switchCookies = confirm.cookies;
      ret = 0;
    }
  }

  if (ret !== 0) {
    console.log(`[wechatMp] switch failed: ${username} ret=${ret} err=${errMsg}`);
    return { success: false, error: errMsg || `切换失败 ret=${ret}` };
  }

  // 成功后：必须用目标身份的新 cookies 再提取最新 token（对齐参考项目，不能沿用切换前 token）
  const latest = await extractLatestToken(switchToken, switchCookies);
  const newToken = latest.token || switchToken;
  const newCookies = latest.cookies || switchCookies;
  console.log(
    `[wechatMp] switch success: ${username} token=${newToken} cookiesLen=${String(newCookies).length}`,
  );
  return {
    success: true,
    cookies: newCookies,
    token: newToken,
    username,
    currentUsername: username,
  };
}

function buildDraftFields(opts) {
  const {
    token,
    fingerprint,
    random,
    mode = 'create',
    appmsgid,
    dataSeq = '0',
    multiItemCount = 1,
    title,
    author = '',
    digest = '',
    content,
    sourceUrl = '',
    cover = '',
    cover235 = '',
    cover169 = '',
    cover34 = '',
    cover11 = '',
    cropList = '',
    showCoverPic = 0,
    copyrightType = 0,
    claimSourceType = 0,
    isUserNoClaim = 0,
    needOpenComment = 0,
    onlyFansCanComment = 0,
    allowFastReprint = 1,
    allowReprint = 0,
    allowReprintModify = 0,
    composeInfo = '{"list":""}',
    stickerInfo = '{"is_stickers":0,"common_stickers_num":0,"union_stickers_num":0,"sticker_id_list":[],"has_invalid_sticker":0}',
    sections = '',
    styleType = 0,
    newPicProcess = 0,
    multiPictureCover = 0,
    sharePageType = 0,
    shareImageInfo = '{"list":[]}',
    guideWords = '',
    autoGenDigest = '0',
    isUserTitle = '',
  } = opts;
  const isUpdate = mode === 'update';
  const reqField = JSON.stringify({
    idx_infos: [
      {
        save_old: 0,
        cps_info: { cps_import: 0 },
        red_packet_cover_list: isUpdate ? { list: [] } : {},
        podcast_task_info: null,
        claim_source: isUpdate ? { is_user_no_claim_source: 0 } : {},
        line_info: isUpdate ? { scene: 2 } : { is_appmsg_flag: 0, scene: 2 },
        window_product: {},
        link_info: {},
        appmsg_link: {},
        weapp_link: {},
        yqj_info: {},
        ai_pic_info: { cover_source: 0, ai_pic_id: [], cover_pic_id: '' },
        single_video_snap_card: {},
        product_activity: {},
        footer_gift_activity: {},
        footer_common_shops: [],
        ...(isUpdate ? { footer_product_card: {} } : {}),
        location: {},
      },
    ],
    appmsg_id: Number(appmsgid || 0),
    is_use_flag: 0,
    template_version: '06082702',
  });
  const fields = [
    ['token', token],
    ['lang', 'zh_CN'],
    ['f', 'json'],
    ['ajax', '1'],
    ['fingerprint', fingerprint],
    ['random', String(random)],
    ['AppMsgId', appmsgid ? String(appmsgid) : ''],
    ['count', String(multiItemCount)],
    ['data_seq', dataSeq],
    ['operate_from', 'Chrome'],
    ['isnew', '0'],
    ['articlenum', String(multiItemCount)],
    ['pre_timesend_set', '0'],
    ['is_finder_video0', '0'],
    ['finder_draft_id0', '0'],
    ['applyori0', '0'],
    ['ad_video_transition0', ''],
    ['can_reward0', '0'],
    ['pay_gifts_count0', '0'],
    ['reward_reply_id0', ''],
    ['related_video0', ''],
    ['is_video_recommend0', '0'],
    ['title0', title],
    ['is_user_title0', isUserTitle],
    ['author0', author],
    ['writerid0', '0'],
    ['fileid0', '0'],
    ['digest0', digest],
    ['auto_gen_digest0', autoGenDigest],
    ['content0', content],
    ['sourceurl0', sourceUrl],
    ['last_choose_cover_from0', '0'],
    ['need_open_comment0', String(needOpenComment)],
    ['only_fans_can_comment0', String(onlyFansCanComment)],
    ['only_fans_days_can_comment0', '0'],
    ['reply_flag0', '2'],
    ['not_pay_can_comment0', '0'],
    ['auto_elect_comment0', '1'],
    ['auto_elect_reply0', '1'],
    ['option_version0', '5'],
    ['open_fansmsg0', '0'],
    ['cdn_url0', cover],
    ['cdn_235_1_url0', cover235],
    ['cdn_16_9_url0', cover169 || cover235],
    ['cdn_3_4_url0', cover34],
    ['cdn_1_1_url0', cover11],
    ['cdn_finder_url0', ''],
    ['cdn_video_url0', ''],
    ['cdn_url_back0', ''],
    ['crop_list0', cropList],
    ['app_cover_auto0', '0'],
    ['music_id0', ''],
    ['video_id0', ''],
    ['voteid0', ''],
    ['voteismlt0', ''],
    ['supervoteid0', ''],
    ['super_vote_id0', ''],
    ['vid_type0', ''],
    ['show_cover_pic0', String(showCoverPic)],
    ['copyright_type0', String(copyrightType)],
    ['is_cartoon_copyright0', '0'],
    ['copyright_img_list0', '{"max_width":586,"img_list":[]}'],
    ['releasefirst0', ''],
    ['platform0', ''],
    ['reprint_permit_type0', ''],
    ['allow_fast_reprint0', String(allowFastReprint)],
    ['allow_reprint0', String(allowReprint)],
    ['allow_reprint_modify0', String(allowReprintModify)],
    ['original_article_type0', ''],
    ['ori_white_list0', '{"white_list":[]}'],
    ['video_ori_status0', ''],
    ['hit_nickname0', ''],
    ['free_content0', ''],
    ['fee0', '0'],
    ['ad_id0', ''],
    ['guide_words0', guideWords],
    ['is_share_copyright0', '0'],
    ['share_copyright_url0', ''],
    ['source_article_type0', ''],
    ['reprint_recommend_title0', ''],
    ['reprint_recommend_content0', ''],
    ['share_page_type0', String(sharePageType)],
    ['share_imageinfo0', shareImageInfo],
    ['share_video_id0', ''],
    ['dot0', '{}'],
    ['share_voice_id0', ''],
    ['share_finder_audio_username0', ''],
    ['share_finder_audio_exportid0', ''],
    ['mmlistenitem_json_buf0', ''],
    ['insert_ad_mode0', '2'],
    ['categories_list0', '[]'],
    ...(sections ? [['sections0', sections]] : []),
    ...(composeInfo ? [['compose_info0', composeInfo]] : []),
    ['is_pay_subscribe0', '0'],
    ['pay_fee0', ''],
    ['pay_preview_percent0', ''],
    ['pay_desc0', ''],
    ['pay_album_info0', ''],
    ['appmsg_album_info0', '{"appmsg_album_infos":[]}'],
    ['can_insert_ad0', '1'],
    ['open_keyword_ad0', '1'],
    ['open_comment_ad0', '1'],
    ['audio_info0', '{"audio_infos":[]}'],
    ['danmu_pub_type0', '0'],
    ['mp_video_info0', '{"list":[]}'],
    ['appmsg_danmu_pub_type0', ''],
    ['is_set_sync_to_finder0', '0'],
    ['sync_to_finder_cover0', ''],
    ['sync_to_finder_cover_source0', ''],
    ['import_to_finder0', '0'],
    ['import_from_finder_export_id0', ''],
    ['style_type0', String(styleType)],
    ['sticker_info0', stickerInfo],
    ['new_pic_process0', String(newPicProcess)],
    ['disable_recommend0', '0'],
    ['claim_source_type0', String(claimSourceType)],
    ['is_user_no_claim_source0', String(isUserNoClaim)],
    ['msg_index_id0', isUpdate ? `0_${appmsgid}_0` : ''],
    ['convert_to_image_share_page0', ''],
    ['convert_from_image_share_page0', ''],
    ['incontent_ad_count0', '2'],
    ['multi_picture_cover0', String(multiPictureCover)],
    ['title_gen_type0', '0'],
    ['req', reqField],
    ['remind_flag', 'null'],
    ['is_auto_type_setting', '3'],
    ['save_type', '0'],
    ['isneedsave', '0'],
  ];
  return fields;
}

function buildMultipart(fields) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).slice(2, 18).padEnd(16, 'x');
  const CRLF = '\r\n';
  let body = '';
  for (const [name, value] of fields) {
    body += `--${boundary}${CRLF}`;
    body += `Content-Disposition: form-data; name="${name}"${CRLF}`;
    body += CRLF;
    body += `${value}${CRLF}`;
  }
  body += `--${boundary}--${CRLF}`;
  return { body, boundary };
}

function buildMultipartWithFile(fields, fileField, fileName, contentType, buffer) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).slice(2, 18).padEnd(16, 'x');
  const CRLF = '\r\n';
  let head = '';
  for (const [name, value] of fields) {
    head += `--${boundary}${CRLF}`;
    head += `Content-Disposition: form-data; name="${name}"${CRLF}`;
    head += CRLF;
    head += `${value}${CRLF}`;
  }
  head += `--${boundary}${CRLF}`;
  head += `Content-Disposition: form-data; name="${fileField}"; filename="${fileName}"${CRLF}`;
  head += `Content-Type: ${contentType}${CRLF}`;
  head += CRLF;
  const tail = `${CRLF}--${boundary}--${CRLF}`;
  return { body: Buffer.concat([Buffer.from(head, 'utf8'), buffer, Buffer.from(tail, 'utf8')]), boundary };
}

async function resolveImageSource(src) {
  const s = String(src || '').trim();
  if (/^data:/i.test(s)) {
    const m = s.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
    if (!m) throw new Error('无法解析 data URL 图片');
    const contentType = m[1] || 'image/jpeg';
    const buf = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8');
    if (!buf.length) throw new Error('图片内容为空');
    return { buf, contentType };
  }
  if (/^wgh-image:\/\//i.test(s)) {
    // 本地磁盘图片（图片落盘改造后）直接读文件，无需走网络
    const { buf, contentType } = await images.readImageBuffer(s);
    if (!buf.length) throw new Error('图片内容为空');
    return { buf, contentType };
  }
  const res = await fetch(s, {
    headers: {
      'User-Agent': platformUa(),
      Accept: 'image/*,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`图片下载失败 HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  if (!buf.length) throw new Error('图片内容为空');
  return { buf, contentType };
}

async function uploadImageToCdn(token, state, src, referer, retried = false) {
  const { buf, contentType } = await resolveImageSource(src);
  const ext = (contentType.split('/')[1] || 'jpg').replace('jpeg', 'jpg').replace('png', 'png');
  const name = `image_${Date.now()}.${ext}`;
  const now = Date.now();
  const fields = [
    ['id', `p${now}`],
    ['name', name],
    ['type', contentType],
    ['lastModifiedDate', new Date().toString()],
    ['size', String(buf.length)],
  ];
  const { body, boundary } = buildMultipartWithFile(fields, 'upfile', name, contentType, buf);
  const url = `${BASE_URL}/cgi-bin/uploadimg2cdn?lang=zh_CN&token=${token}&t=${Math.random()}`;
  const r = await state.req(url, {
    method: 'POST',
    token,
    extraHeaders: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      Referer:
        referer ||
        `${BASE_URL}/cgi-bin/appmsg?t=media/appmsg_edit_v2&action=edit&isNew=1&type=77&createType=0&token=${token}&lang=zh_CN`,
    },
    rawBody: body,
    timeoutMs: 90000,
  });
  const result = r.data;
  const urlValue = result?.url || result?.cdn_url || result?.data?.url || '';
  if (result?.base_resp?.ret !== 0 || !urlValue) {
    const isSessionError =
      result?.base_resp?.ret === 200003 ||
      /invalid session/i.test(result?.base_resp?.err_msg || '');
    if (isSessionError && !retried) {
      // 会话过期：刷新 token/cookie 后重试一次（对齐真实编辑器先进入编辑器页面）
      try {
        const auth = await refreshAuth(token, state.value);
        if (auth.token) token = auth.token;
        if (auth.cookies) state.value = auth.cookies;
        await state.req(
          `${BASE_URL}/cgi-bin/appmsg?t=media/appmsg_edit_v2&action=edit&isNew=1&type=77&createType=0&token=${token}&lang=zh_CN`,
          { token },
        );
      } catch (err) {
        console.warn(`[wechatMp] 上传前会话刷新失败：${err.message}`);
      }
      return uploadImageToCdn(token, state, src, referer, true);
    }
    console.log('[wechatMp] uploadImageToCdn failed:', JSON.stringify(result || r.text || '').slice(0, 400));
    console.log(
      `[wechatMp] uploadImageToCdn failed context: token=${token} cookiesLen=${String(state.value).length}`,
    );
    const detail = JSON.stringify(result || {}).slice(0, 120);
    throw new Error(
      `${result?.base_resp?.err_msg || result?.msg || '图片上传失败'}${detail ? `：${detail}` : ''}`,
    );
  }
  return { url: urlValue, fileId: String(result?.file_id || result?.fileId || '') };
}

async function uploadContentImages(token, state, html, referer) {
  const srcs = [];
  for (const m of String(html || '').matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
    if (!srcs.includes(m[1])) srcs.push(m[1]);
  }
  const map = new Map();
  for (const src of srcs) {
    if (/mmbiz\.(qpic|qlogo)\.(cn|com)/i.test(src)) {
      map.set(src, src);
      continue;
    }
    try {
      const up = await uploadImageToCdn(token, state, src, referer);
      map.set(src, up.url);
    } catch (err) {
      if (/^data:/i.test(src)) throw err;
      console.warn(`[wechatMp] content image upload failed, keep original: ${err.message}`);
    }
  }
  return String(html || '').replace(/<img([^>]+)src=["']([^"']+)["']/gi, (all, attrs, src) => {
    const next = map.get(src) || src;
    return `<img${attrs}src="${next}"`;
  });
}

function buildCoverCropList(fileId) {
  const fid = Number(fileId || 0);
  const ratios = ['2.35_1', '1_1', '3_4', '16_9', 'video', 'finder'];
  return JSON.stringify({
    crop_list: ratios.map((ratio) => ({
      ratio,
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 0,
      file_id: ratio === '1_1' ? fid : 0,
    })),
    crop_list_percent: ratios.map((ratio) => ({
      ratio,
      x1: ratio === '1_1' ? 0 : 0,
      y1: ratio === '1_1' ? 0 : 0,
      x2: ratio === '1_1' ? 1 : 0,
      y2: ratio === '1_1' ? 1 : 0,
      file_id: ratio === '1_1' ? fid : 0,
    })),
  });
}

function buildStickerCropList(fileId) {
  const fid = Number(fileId || 0);
  const ratios = ['3_4', '1_1', 'image_share_4_3_edit'];
  return JSON.stringify({
    crop_list: ratios.map((ratio) => ({
      ratio,
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 0,
      file_id: fid,
    })),
    crop_list_percent: ratios.map((ratio) => ({
      ratio,
      x1: 0,
      y1: 0,
      x2: 1,
      y2: 1,
      file_id: fid,
    })),
  });
}

async function saveDraft(token, state, fingerprint, fields, options = {}) {
  assertAccount(state.value, options.username);
  const { mode = 'update', appmsgid = '' } = options;
  const sub = mode === 'create' ? 'create' : 'update';
  const { body, boundary } = buildMultipart(fields);
  const url = `${BASE_URL}/cgi-bin/operate_appmsg?t=ajax-response&sub=${sub}&type=77&token=${token}&lang=zh_CN`;
  const referer =
    mode === 'create'
      ? `${BASE_URL}/cgi-bin/appmsg?t=media/appmsg_edit_v2&action=edit&isNew=1&type=77&createType=0&token=${token}&lang=zh_CN&timestamp=${Date.now()}`
      : `${BASE_URL}/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&type=77&appmsgid=${appmsgid}&isMul=1&replaceScene=0&isSend=0&isFreePublish=0&token=${token}&lang=zh_CN&timestamp=${Date.now()}`;
  const r = await state.req(url, {
    method: 'POST',
    token,
    extraHeaders: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      Referer: referer,
    },
    rawBody: body,
  });
  const result = r.data;
  if (result && (result.base_resp?.ret === 0 || result.ret === '0')) {
    return {
      success: true,
      appmsgid: String(result.appMsgId || result.appmsgid || result.appmsg_id || ''),
      dataSeq: String(result.data_seq || ''),
      cookies: state.value,
    };
  }
  console.log('[wechatMp] saveDraft failed:', JSON.stringify(result || r.text || '').slice(0, 500));
  console.log(
    `[wechatMp] saveDraft failed context: token=${token} cookiesLen=${String(state.value).length}`,
  );
  return {
    success: false,
    error: result?.base_resp?.err_msg || result?.msg || '保存草稿失败',
    errorCode: Number(result?.base_resp?.ret ?? result?.ret),
  };
}

async function createDraft(token, cookies, fingerprint, opts) {
  const state = createReqState(cookies);
  const referer = `${BASE_URL}/cgi-bin/appmsg?t=media/appmsg_edit_v2&action=edit&isNew=1&type=77&createType=0&token=${token}&lang=zh_CN&timestamp=${Date.now()}`;
  const isSticker = opts.postType === 'sticker';
  let html = opts.content || '';
  let cover = opts.cover || '';
  let fileId = '';
  let shareImageInfo = '{"list":[]}';
  let styleType = 0;
  let newPicProcess = 0;
  let sharePageType = 0;
  let multiPictureCover = 0;
  let composeInfo = opts.composeInfo || '';
  let sections = opts.sections || '';
  let cropList = '';
  let guideWords = '';
  let autoGenDigest = '0';
  let isUserTitle = '';
  // 对齐真实编辑器：先进入编辑器页面建立会话上下文，再上传图片
  try {
    const auth = await refreshAuth(token, state.value);
    if (auth.token) token = auth.token;
    if (auth.cookies) state.value = auth.cookies;
    await state.req(
      `${BASE_URL}/cgi-bin/appmsg?t=media/appmsg_edit_v2&action=edit&isNew=1&type=77&createType=0&token=${token}&lang=zh_CN`,
      { token },
    );
  } catch (err) {
    console.warn(`[wechatMp] 编辑器预热失败：${err.message}`);
  }
  if (isSticker) {
    // 贴图（图片消息）：正文为空，标题不传，1~9 张图按抓包组装 share_imageinfo0
    const images = Array.isArray(opts.images) ? opts.images.filter(Boolean) : [];
    const uploaded = [];
    for (const img of images) {
      try {
        const up = await uploadImageToCdn(token, state, img, referer);
        if (up.url) uploaded.push({ url: up.url, fileId: up.fileId || '' });
      } catch (err) {
        console.warn(`[wechatMp] 贴图图片上传失败：${err.message}`);
      }
    }
    if (!uploaded.length) {
      console.warn('[wechatMp] 贴图图片上传全部失败，中止创建草稿，避免生成空壳图文');
      return { success: false, error: '贴图图片上传失败，已中止发布（未生成有效图片）' };
    }
    cover = uploaded[0].url;
    fileId = uploaded[0].fileId;
    // 图片消息：图片走 share_imageinfo0；content0 是纯文本，
    // 第一行标题，其余每段一行，段间用 \r\n 分隔（对齐抓包，无空行、无 HTML）。
    const topicAnchors = [];
    html = String(opts.content || '')
      .replace(/<a class="wx_topic_link"[\s\S]*?<\/a>/gi, (m) => {
        const token = `\u0000TOPIC${topicAnchors.length}\u0000`;
        topicAnchors.push(m);
        return token;
      })
      .replace(/<p[^>]*>/gi, '\n')
      .replace(/<\/p>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<img[^>]*>/gi, '')
      .replace(/<[^>]+>/g, '')
      .split('\n')
      .map((s) => s.replace(/\r/g, '').trim())
      .join('\r\n')
      .replace(/\r\n(\r\n)+/g, '\r\n\r\n')
      .replace(/^\r\n+/, '')
      .replace(/\r\n+$/, '')
      .replace(/\u0000TOPIC(\d+)\u0000/g, (_, i) => topicAnchors[Number(i)] || '');
    console.log(
      `[wechatMp] 贴图 content0 len=${html.length} lines=${html.split('\r\n').length} head=${html
        .slice(0, 120)
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n')}`,
    );
    cropList = buildStickerCropList(fileId);
    shareImageInfo = JSON.stringify({
      list: uploaded.map((u) => ({
        url: u.url,
        file_id: Number(u.fileId) || 0,
        height: 0,
        width: 0,
        theme_color: 'rgb(255,255,255)',
        disable_theme: 1,
        disable_live: 0,
        cdn_url: u.url,
        cover_info: null,
        share_cover: { cdn_url: u.url },
      })),
    });
    styleType = 3;
    newPicProcess = 1;
    sharePageType = 8;
    multiPictureCover = 0;
    composeInfo = '{"list":""}';
    sections = '';
    guideWords = html;
    autoGenDigest = '1';
    isUserTitle = '1';
  } else {
    try {
      html = await uploadContentImages(token, state, html, referer);
    } catch (err) {
      console.warn(`[wechatMp] 正文图片上传失败，继续使用原图：${err.message}`);
    }
  }
  if (cover) {
    if (!/mmbiz\.(qpic|qlogo)\.(cn|com)/i.test(cover)) {
      try {
        const up = await uploadImageToCdn(token, state, cover, referer);
        cover = up.url;
        fileId = up.fileId;
      } catch (err) {
        console.warn(`[wechatMp] 封面上传失败，回退原地址：${err.message}`);
        if (/^data:/i.test(cover)) cover = '';
      }
    }
  }
  const fields = buildDraftFields({
    token,
    fingerprint,
    random: Math.random(),
    mode: 'create',
    appmsgid: '',
    dataSeq: '0',
    title: opts.title || '',
    author: opts.author || '',
    digest: opts.digest || '',
    content: html,
    sourceUrl: opts.sourceUrl || '',
    cover,
    cover235: isSticker ? cover : opts.cover235 || '',
    cover169: opts.cover169 || '',
    cover34: isSticker ? cover : opts.cover34 || '',
    cover11: isSticker ? cover : opts.cover11 || '',
    cropList: opts.cropList || (isSticker ? cropList : fileId ? buildCoverCropList(fileId) : ''),
    showCoverPic: isSticker ? 0 : cover ? 1 : 0,
    copyrightType: opts.copyrightType || 0,
    claimSourceType: opts.claimSourceType || 0,
    isUserNoClaim: opts.isUserNoClaim || 0,

    sections,
    composeInfo,
    styleType,
    newPicProcess,
    multiPictureCover,
    sharePageType,
    shareImageInfo,
    guideWords,
    autoGenDigest,
    isUserTitle,
  });
  return saveDraft(token, state, fingerprint, fields, {
    mode: 'create',
    username: opts.username,
  });
}

async function updateDraft(token, cookies, fingerprint, appmsgid, dataSeq, opts = {}) {
  const state = createReqState(cookies);
  const referer = `${BASE_URL}/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&type=77&appmsgid=${appmsgid}&isMul=1&replaceScene=0&isSend=0&isFreePublish=0&token=${token}&lang=zh_CN&timestamp=${Date.now()}`;
  let html = opts.content || '';
  let cover = opts.cover || '';
  let fileId = '';
  // 对齐真实编辑器：先进入编辑器页面建立会话上下文，再上传图片
  try {
    const auth = await refreshAuth(token, state.value);
    if (auth.token) token = auth.token;
    if (auth.cookies) state.value = auth.cookies;
    await state.req(
      `${BASE_URL}/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&type=77&appmsgid=${appmsgid}&isMul=1&replaceScene=0&isSend=0&isFreePublish=0&token=${token}&lang=zh_CN`,
      { token },
    );
  } catch (err) {
    console.warn(`[wechatMp] 编辑器预热失败：${err.message}`);
  }
  try {
    html = await uploadContentImages(token, state, html, referer);
  } catch (err) {
    console.warn(`[wechatMp] 正文图片上传失败，继续使用原图：${err.message}`);
  }
  if (cover && !/mmbiz\.(qpic|qlogo)\.(cn|com)/i.test(cover)) {
    try {
      const up = await uploadImageToCdn(token, state, cover, referer);
      cover = up.url;
      fileId = up.fileId;
    } catch (err) {
      console.warn(`[wechatMp] 封面上传失败，回退原地址：${err.message}`);
      if (/^data:/i.test(cover)) cover = '';
    }
  }
  const fields = buildDraftFields({
    token,
    fingerprint,
    random: Math.random(),
    mode: 'update',
    appmsgid,
    dataSeq,
    title: opts.title || '',
    author: opts.author || '',
    digest: opts.digest || '',
    content: html,
    sourceUrl: opts.sourceUrl || '',
    cover,
    cover235: opts.cover235 || '',
    cover169: opts.cover169 || '',
    cover34: opts.cover34 || '',
    cover11: opts.cover11 || '',
    cropList: opts.cropList || (fileId ? buildCoverCropList(fileId) : ''),
    showCoverPic: cover ? 1 : 0,
    copyrightType: opts.copyrightType || 0,
    claimSourceType: opts.claimSourceType || 0,
    isUserNoClaim: opts.isUserNoClaim || 0,

    sections: opts.sections || '',
    composeInfo: opts.composeInfo || '',
  });
  return saveDraft(token, state, fingerprint, fields, {
    mode: 'update',
    appmsgid,
    username: opts.username,
  });
}

async function refreshSession(
  token,
  cookies,
  username,
  fingerprint = DEFAULT_FINGERPRINT,
  appid,
  accounts = [],
  currentUsername = '',
) {
  if (username) {
    // 对齐参考项目：切换接口看的是当前会话上下文，而不是目标账号类型。
    // 当前在小程序后台时必须用 wxamp/switchAccount + appid，否则 switchacct 会返回 invalid args。
    const cookieUser = getCookieValue(cookies, 'slave_user');
    const cur = cookieUser || currentUsername || '';
    const curAcc = (accounts || []).find((x) => x.username === cur);
    const currentIsWxa = !!curAcc && (Number(curAcc.acctType) === 2 || curAcc.kind === 'wxa');
    if (currentIsWxa) {
      const targetAcc = (accounts || []).find((x) => x.username === username);
      let resolvedAppid = appid || targetAcc?.appid || '';
      // 对齐参考项目：账号记录里没有 appid 时，从小程序后台的账号列表（getWxaList）按 username 反查
      if (!resolvedAppid) {
        try {
          const wxaMap = await getWxaList(token, cookies);
          resolvedAppid = wxaMap[username] || '';
          console.log(
            `[wechatMp] wxa fallback: target=${username} resolvedAppid=${resolvedAppid || '(none)'}`,
          );
        } catch (err) {
          console.warn(`[wechatMp] getWxaList fallback failed: ${err.message}`);
        }
      }
      if (!resolvedAppid) {
        return {
          success: false,
          error: `目标账号 ${username} 缺少 appid，无法从小程序后台切换`,
        };
      }
      const r = await switchWxaAccount(token, cookies, resolvedAppid);
      if (!r.success) return { success: false, error: r.error };
      return {
        success: true,
        token: r.token,
        cookies: r.cookies,
        lastRefresh: new Date().toISOString(),
        currentUsername: username,
        appid: resolvedAppid,
      };
    }
    const r = await switchAccount(token, cookies, username, fingerprint);
    if (!r.success) return { success: false, error: r.error };
    return {
      success: true,
      token: r.token || token,
      cookies: r.cookies,
      lastRefresh: new Date().toISOString(),
      currentUsername: username,
    };
  }
  await seedSession(cookies);
  const latest = await extractLatestToken(token, cookies);
  const probe = await getPublicAccounts(latest.token, latest.cookies, fingerprint);
  return probe.success
    ? {
        success: true,
        token: latest.token,
        cookies: latest.cookies,
        lastRefresh: new Date().toISOString(),
      }
    : { success: false, error: probe.error };
}

// 对齐参考项目 _refreshCurrentSessionAuth：只从根路径提取最新 token + cookie，不做探测
async function refreshAuth(token, cookies) {
  await seedSession(cookies);
  const latest = await extractLatestToken(token, cookies);
  if (!latest.found) {
    console.warn('[wechatMp] refreshAuth: 根路径未确认登录态，保留原 token/cookie');
  }
  return {
    success: true,
    token: latest.token,
    cookies: latest.cookies,
    lastRefresh: new Date().toISOString(),
    found: latest.found,
  };
}

async function switchWxaAccount(token, cookies, appid) {
  await seedSession(cookies);
  const url = `${BASE_URL}/wxamp/cgi/switchAccount?token=${token}&lang=zh_CN&random=${Math.random()}`;
  const r = await requestJson(url, {
    method: 'POST',
    cookies,
    token,
    form: { appid },
    extraHeaders: {
      Referer: `${BASE_URL}/wxamp/index/index?lang=zh_CN&token=${token}`,
    },
    persistSetCookies: (data) => Number(data?.ret) === 0,
  });
  const data = r.data || {};
  if (Number(data?.ret) !== 0) {
    return {
      success: false,
      error: data?.err_msg || data?.errmsg || `切换失败 ret=${data?.ret}`,
    };
  }
  const mergedCookies = setCookiesFromResponse(cookies, r.headers);
  // 对齐参考项目：切换成功后用新 cookies 提取最新 token
  const latest = await extractLatestToken(data?.token || token, mergedCookies);
  const finalCookies = latest.cookies || mergedCookies;
  return {
    success: true,
    token: latest.token || data?.token || token,
    cookies: finalCookies,
  };
}

async function verifySession(token, cookies) {
  const probe = await getPublicAccounts(token, cookies);
  return probe.success ? { ok: true, valid: true } : { ok: true, valid: false, error: probe.error };
}

module.exports = {
  withSession,
  assertAccount,
  BASE_URL,
  DEFAULT_FINGERPRINT,
  platformUa,
  buildHeaders,
  requestJson,
  getPublicAccounts,
  switchAccount,
  setCookiesFromResponse,
  createDraft,
  updateDraft,
  saveDraft,
  refreshSession,
  refreshAuth,
  verifySession,
};
