'use strict';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

let electron = null;
try {
  electron = require('electron');
} catch {
  /* 非 Electron 环境 */
}

function normalizeCookie(cookie = '') {
  let s = String(cookie || '').trim();
  if (!s) return '';
  if (s.toLowerCase().startsWith('cookie:')) s = s.slice(7).trim();
  if (!s.includes(';') && s.includes(',')) s = s.replace(/,\s*/g, '; ');
  return s;
}

function getCookieValue(cookie, key) {
  const m = String(cookie || '').match(new RegExp(`(?:^|;\\s*)${key}=([^;]+)`));
  return m ? m[1] : '';
}

function buildHeaders(cookie, includeCsrf = true) {
  const normalized = normalizeCookie(cookie);
  const headers = {
    'User-Agent': UA,
    Accept: 'application/json, text/plain, */*',
    Origin: 'https://mp.toutiao.com',
    Referer: 'https://mp.toutiao.com/profile_v4/graphic/publish',
    Cookie: normalized,
  };
  if (includeCsrf) {
    const csrf = getCookieValue(normalized, 'passport_csrf_token');
    if (csrf) headers['x-secsdk-csrf-token'] = csrf;
  }
  return headers;
}

function toForm(data = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(data)) {
    params.set(k, v === undefined || v === null ? '' : String(v));
  }
  return params.toString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(minMs, maxMs) {
  return sleep(Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs);
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

async function syncToutiaoCookies(platformSession, cookieString) {
  if (!platformSession || !cookieString) return;
  const map = parseCookieHeader(cookieString);
  const targets = ['https://mp.toutiao.com', 'https://www.toutiao.com'];
  for (const [name, value] of Object.entries(map)) {
    for (const target of targets) {
      try {
        await platformSession.cookies.set({
          url: target,
          name,
          value,
          domain: '.toutiao.com',
          path: '/',
        });
      } catch {
        try {
          await platformSession.cookies.set({ url: target, name, value, path: '/' });
        } catch {
          /* ignore */
        }
      }
    }
  }
  await platformSession.cookies.flushStore().catch(() => {});
}

async function executeFetchInPage(win, payload) {
  const script = `
    (async () => {
      const opts = ${JSON.stringify(payload)};
      const init = {
        method: opts.method || 'GET',
        credentials: 'include',
        headers: opts.headers || {},
      };
      if (opts.body) init.body = opts.body;
      try {
        const resp = await fetch(opts.url, init);
        const text = await resp.text();
        let data = null;
        try { data = JSON.parse(text); } catch (_) { data = { code: -1, message: 'invalid json', raw: text.slice(0, 500) }; }
        return { status: resp.status, data };
      } catch (err) {
        return { status: 0, error: String(err && err.message || err) };
      }
    })();
  `;
  return win.webContents.executeJavaScript(script, true);
}

function getTuwenWttTransFlag(tuwenWttTransfer, contentWordCnt) {
  if (String(tuwenWttTransfer) !== '1') return '0';
  if (contentWordCnt >= 800) return '2';
  if (contentWordCnt <= 100) return '1';
  return '0';
}

function buildPublishBody(options = {}) {
  const {
    save,
    title,
    content,
    coverData,
    claimExclusive,
    declarationType,
    tuwenWttTransfer,
    titleId,
    pgcId,
    contentWordCnt,
  } = options;

  const extra = {
    content_source: 100000000402,
    content_word_cnt: contentWordCnt,
    is_multi_title: 0,
    sub_titles: [],
    gd_ext: {
      entrance: '',
      from_page: 'publisher_mp',
      enter_from: 'PC',
      device_platform: 'mp',
      is_message: 0,
    },
  };
  if (save === 0) {
    extra.tuwen_wtt_transfer_switch = tuwenWttTransfer;
  } else {
    extra.tuwen_wtt_trans_flag = getTuwenWttTransFlag(tuwenWttTransfer, contentWordCnt);
    extra.info_source = {
      source_type: declarationType,
      source_author_uid: '',
      time_format: '',
      position: {},
    };
  }

  let pgcFeedCovers = '[]';
  if (coverData) {
    pgcFeedCovers = JSON.stringify([
      {
        id: '',
        url: coverData.coverUrl,
        uri: coverData.imageUri,
        ic_uri: '',
        thumb_width: coverData.width,
        thumb_height: coverData.height,
        extra: { from_content_uri: '', from_content: '0' },
      },
    ]);
  }

  const body = {
    source: '29',
    extra: JSON.stringify(extra),
    title,
    content,
    save: String(save),
    timer_status: '0',
    timer_time: '',
    entrance: save === 1 ? 'main' : '',
    search_creation_info: JSON.stringify({ searchTopOne: 0, abstract: '', clue_id: '' }),
    title_id: titleId,
    mp_editor_stat: '{}',
    educluecard: '',
    draft_form_data: JSON.stringify({ coverType: 2 }),
    pgc_feed_covers: pgcFeedCovers,
    article_ad_type: '3',
    claim_exclusive: claimExclusive,
    is_fans_article: '0',
    govern_forward: '0',
    praise: '0',
    disable_praise: '0',
    tree_plan_article: '0',
    star_order_id: '',
    star_order_name: '',
    customer_nick_name: '',
    activity_tag: '0',
    trends_writing_tag: '0',
    is_refute_rumor: '0',
  };
  if (save === 1) {
    body.ic_uri_list = '';
    body.appid_list = '';
    body.stock_ids = '';
    body.concern_list = '';
    if (pgcId) body.pgc_id = String(pgcId);
  }
  return body;
}

async function fetchWebsdkToken() {
  try {
    const cb = `_${Math.floor(Math.random() * 10000)}_${Date.now()}`;
    const res = await fetch(`https://xxbg.snssdk.com/websdk/v1/p?callback=${cb}`, {
      headers: {
        'User-Agent': UA,
        Accept: '*/*',
        Origin: 'https://mp.toutiao.com',
        Referer: 'https://mp.toutiao.com/',
      },
      signal: AbortSignal.timeout(10000),
    });
    const body = await res.text();
    const m = body.match(/\("(.+)"\)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function uploadHeaders(cookie) {
  const normalized = normalizeCookie(cookie);
  const csrf = getCookieValue(normalized, 'passport_csrf_token');
  return {
    Cookie: normalized,
    'x-secsdk-csrf-token': csrf || '',
    Origin: 'https://mp.toutiao.com',
    Referer: 'https://mp.toutiao.com/profile_v4/graphic/publish',
    'User-Agent': UA,
  };
}

async function downloadImageBuffer(src) {
  if (/^data:/i.test(String(src))) {
    const m = String(src).match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
    if (!m) throw new Error('非法URL');
    const buf = m[2]
      ? Buffer.from(m[3], 'base64')
      : Buffer.from(decodeURIComponent(m[3]), 'utf8');
    return { buf, contentType: m[1] || 'image/jpeg' };
  }
  const imgResp = await fetch(src, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(30000),
  });
  if (!imgResp.ok) throw new Error(`下载图片失败 HTTP ${imgResp.status}`);
  return {
    buf: Buffer.from(await imgResp.arrayBuffer()),
    contentType: imgResp.headers.get('content-type') || 'image/jpeg',
  };
}

async function uploadToutiaoImage(cookie, src, needCover = false) {
  const { buf, contentType } = await downloadImageBuffer(src);
  const ext = contentType.split('/')[1] || 'jpg';
  const headers = uploadHeaders(cookie);

  const form1 = new FormData();
  form1.append('image', new Blob([buf], { type: contentType }), `img.${ext}`);
  const uploadResp = await fetch(
    'https://mp.toutiao.com/spice/image?upload_source=20020003&aid=1231&device_platform=web',
    { method: 'POST', headers, body: form1, signal: AbortSignal.timeout(60000) },
  );
  const up = await uploadResp.json().catch(() => null);
  if (Number(up?.code) !== 0 || !up?.data?.image_uri) {
    throw new Error(`图片上传失败: ${up?.message || 'no image_uri'}`);
  }
  const imageUrl = up.data.image_url;
  if (!needCover) return { imageUri: up.data.image_uri, imageUrl };

  const form2 = new FormData();
  form2.append('imageUrl', imageUrl);
  const coverResp = await fetch(
    'https://mp.toutiao.com/spice/image?upload_source=20020003&aid=1231&device_platform=web&need_cover_url=1',
    { method: 'POST', headers, body: form2, signal: AbortSignal.timeout(30000) },
  );
  const cv = await coverResp.json().catch(() => null);
  if (Number(cv?.code) !== 0 || !cv?.data?.image_uri) {
    throw new Error(`封面生成失败: ${cv?.message || 'no image_uri'}`);
  }
  return {
    imageUri: cv.data.image_uri,
    imageUrl,
    coverUrl: cv.data.cover_url || cv.data.image_url,
    width: cv.data.image_width || 800,
    height: cv.data.image_height || 600,
  };
}

async function prepareToutiaoContent(cookie, html, coverImageUrl = '') {
  const imgRegex = /<img[^>]+src="([^"]+)"/gi;
  const srcs = [];
  let m;
  while ((m = imgRegex.exec(html)) !== null) srcs.push(m[1]);
  const map = {};
  let coverData = null;
  for (const src of srcs) {
    try {
      if (coverImageUrl && src === coverImageUrl) {
        const c = await uploadToutiaoImage(cookie, src, true);
        coverData = { coverUrl: c.coverUrl, imageUri: c.imageUri, width: c.width, height: c.height };
        map[src] = c.coverUrl;
      } else if (!coverData) {
        const c = await uploadToutiaoImage(cookie, src, true);
        coverData = { coverUrl: c.coverUrl, imageUri: c.imageUri, width: c.width, height: c.height };
        map[src] = c.coverUrl;
      } else {
        const c = await uploadToutiaoImage(cookie, src, false);
        map[src] = c.imageUrl;
      }
    } catch (e) {
      // 上传失败保留原链，让平台自行处理
      map[src] = src;
    }
  }
  let safeContent = html;
  for (const [k, v] of Object.entries(map)) {
    if (v !== k) safeContent = safeContent.split(k).join(v);
  }
  return { content: safeContent, coverData };
}

async function publishArticleWithBrowser(cookie, payload = {}, onLog) {
  const log = (msg) => {
    if (typeof onLog === 'function') onLog(msg);
  };
  if (!electron || !electron.BrowserWindow) {
    return { success: false, error: '浏览器环境不可用', fallback: true };
  }
  const { BrowserWindow, session } = electron;
  const normalized = normalizeCookie(cookie);
  const title = String(payload.title || '').trim();
  const content = String(payload.content || '').trim();
  if (!title || !content) return { success: false, error: '缺少标题或内容' };

  const platformSession = session.fromPartition('persist:pub-toutiao');
  await syncToutiaoCookies(platformSession, normalized);

  const win = new BrowserWindow({
    width: 980,
    height: 760,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      partition: 'persist:pub-toutiao',
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  win.webContents.setUserAgent(UA);

  try {
    await win.loadURL('https://mp.toutiao.com/profile_v4/graphic/publish', {
      extraHeaders: 'Referer: https://mp.toutiao.com/\nOrigin: https://mp.toutiao.com\n',
    });
    await randomDelay(1200, 2000);

    log('验证登录态（浏览器上下文）...');
    const newResp = await executeFetchInPage(win, {
      url: 'https://mp.toutiao.com/mp/agw/article/new?article_type=0&format=json&compat=1&column_no=',
      method: 'GET',
      headers: { Accept: 'application/json, text/plain, */*' },
    });
    const newData = newResp?.data || {};
    if (Number(newData.code ?? -1) !== 0) {
      return {
        success: false,
        error: `头条号登录态失效: ${JSON.stringify({ code: newData.code, message: newData.message })}`,
        fallback: false,
      };
    }
    const mediaId = String(newData?.data?.media_id || '');
    log(`登录态通过 (media_id: ${mediaId})`);
    await randomDelay(2000, 3500);

    log('上传正文/封面图片...');
    const prepared = await prepareToutiaoContent(
      normalized,
      content,
      String(payload.cover_image_url || '').trim(),
    );
    const safeContent = prepared.content;
    const coverData = prepared.coverData;
    await randomDelay(800, 1500);

    const claimExclusive =
      payload.claim_exclusive !== undefined ? (payload.claim_exclusive ? '1' : '0') : '0';
    const declarationStr = String(payload.content_declaration || '个人观点，仅供参考');
    const tuwenWttTransfer =
      payload.tuwen_wtt_transfer !== undefined ? (payload.tuwen_wtt_transfer ? '1' : '0') : '1';
    const declarationTypeMap = {
      无需声明: 0,
      引用站内: 1,
      自行拍摄: 2,
      AI生成: 3,
      取材网络: 4,
      '个人观点，仅供参考': 5,
      '虚构演绎，故事经历': 6,
      '投资观点，仅供参考': 7,
      '健康医疗分享，仅供参考': 8,
    };
    const declarationType = declarationTypeMap[declarationStr] || 5;
    const contentWordCnt = String(safeContent.replace(/<[^>]+>/g, '')).length;
    const titleId = `${Date.now()}_${mediaId}`;
    const buildBody = (save, pgcId) =>
      buildPublishBody({
        save,
        title,
        content: safeContent,
        coverData,
        claimExclusive,
        declarationType,
        tuwenWttTransfer,
        titleId,
        pgcId,
        contentWordCnt,
      });

    await randomDelay(1500, 2500);
    const msToken = await fetchWebsdkToken();
    const query = new URLSearchParams({
      source: 'mp',
      type: 'article',
      aid: '1231',
      mp_publish_ab_val: '0',
    });
    if (msToken) query.set('msToken', msToken);
    const publishUrl = `https://mp.toutiao.com/mp/agw/article/publish?${query}`;
    const postHeaders = {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    };

    log('保存草稿 (save=0)...');
    const saveResp = await executeFetchInPage(win, {
      url: publishUrl,
      method: 'POST',
      headers: postHeaders,
      body: toForm(buildBody(0)),
    });
    const saveData = saveResp?.data || {};
    if (Number(saveData.code ?? -1) !== 0) {
      return {
        success: false,
        error: `草稿保存失败: ${JSON.stringify({ code: saveData.code, message: saveData.message })}`,
        fallback: false,
      };
    }
    const pgcId = String(saveData?.data?.pgc_id || '');
    log(`草稿保存成功 (pgc_id: ${pgcId})`);

    if (payload.save_draft_only === true) {
      return { success: true, articleId: pgcId, method: 'draft' };
    }

    await randomDelay(2000, 3500);
    log('正式发布 (save=1)...');
    const pubResp = await executeFetchInPage(win, {
      url: publishUrl,
      method: 'POST',
      headers: postHeaders,
      body: toForm(buildBody(1, pgcId)),
    });
    const pubData = pubResp?.data || {};
    if (Number(pubData.code ?? -1) !== 0) {
      return {
        success: false,
        error: `发布失败: ${JSON.stringify({ code: pubData.code, message: pubData.message })}`,
        fallback: false,
      };
    }
    log('发布成功');
    return { success: true, articleId: String(pubData?.data?.pgc_id || pgcId), method: 'publish' };
  } finally {
    if (win && !win.isDestroyed()) win.destroy();
  }
}

async function publishArticle(cookie, payload = {}, onLog) {
  const log = (msg) => {
    if (typeof onLog === 'function') onLog(msg);
  };
  const normalized = normalizeCookie(cookie);
  if (!normalized) return { success: false, error: '缺少头条号 cookie' };

  const title = String(payload.title || '').trim();
  const content = String(payload.content || '').trim();
  if (!title || !content) return { success: false, error: '缺少标题或内容' };

  if (electron && electron.BrowserWindow) {
    const browserResult = await publishArticleWithBrowser(cookie, payload, onLog);
    if (browserResult?.success || browserResult?.fallback === false) {
      return browserResult;
    }
  }

  try {
    const getHeaders = buildHeaders(normalized, true);
    const postHeaders = buildHeaders(normalized, false);
    postHeaders['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';

    const msToken = await fetchWebsdkToken();
    const query = new URLSearchParams({
      source: 'mp',
      type: 'article',
      aid: '1231',
      mp_publish_ab_val: '0',
    });
    if (msToken) query.set('msToken', msToken);

    log('验证登录态...');
    const newResp = await fetch(
      `https://mp.toutiao.com/mp/agw/article/new?${new URLSearchParams({
        article_type: 0,
        format: 'json',
        compat: 1,
        column_no: '',
      })}`,
      { headers: getHeaders, signal: AbortSignal.timeout(20000) },
    );
    const newData = await newResp.json().catch(() => null);
    if (Number(newData?.code ?? -1) !== 0) {
      return {
        success: false,
        error: `头条号登录态失效: ${JSON.stringify({ code: newData?.code, message: newData?.message })}`,
      };
    }
    const mediaId = String(newData?.data?.media_id || '');
    log(`登录态通过 (media_id: ${mediaId})`);
    await sleep(2000);

    log('上传正文/封面图片...');
    const prepared = await prepareToutiaoContent(
      normalized,
      content,
      String(payload.cover_image_url || '').trim(),
    );
    const safeContent = prepared.content;
    const coverData = prepared.coverData;

    const claimExclusive =
      payload.claim_exclusive !== undefined ? (payload.claim_exclusive ? '1' : '0') : '0';
    const declarationStr = String(payload.content_declaration || '个人观点，仅供参考');
    const tuwenWttTransfer =
      payload.tuwen_wtt_transfer !== undefined ? (payload.tuwen_wtt_transfer ? '1' : '0') : '1';
    const declarationTypeMap = {
      无需声明: 0,
      引用站内: 1,
      自行拍摄: 2,
      AI生成: 3,
      取材网络: 4,
      '个人观点，仅供参考': 5,
      '虚构演绎，故事经历': 6,
      '投资观点，仅供参考': 7,
      '健康医疗分享，仅供参考': 8,
    };
    const declarationType = declarationTypeMap[declarationStr] || 5;
    const contentWordCnt = String(safeContent.replace(/<[^>]+>/g, '')).length;
    const titleId = `${Date.now()}_${mediaId}`;

    const buildBody = (save, pgcId) =>
      buildPublishBody({
        save,
        title,
        content: safeContent,
        coverData,
        claimExclusive,
        declarationType,
        tuwenWttTransfer,
        titleId,
        pgcId,
        contentWordCnt,
      });

    const saveOnly = payload.save_draft_only === true;

    log(saveOnly ? '保存草稿...' : '保存草稿...');
    await sleep(1500);
    const saveResp = await fetch(`https://mp.toutiao.com/mp/agw/article/publish?${query}`, {
      method: 'POST',
      headers: postHeaders,
      body: toForm(buildBody(0)),
      signal: AbortSignal.timeout(30000),
    });
    const saveData = await saveResp.json().catch(() => null);
    if (Number(saveData?.code ?? -1) !== 0) {
      return {
        success: false,
        error: `草稿保存失败: ${JSON.stringify({ code: saveData?.code, message: saveData?.message })}`,
      };
    }
    const pgcId = String(saveData?.data?.pgc_id || '');
    log(`草稿保存成功 (pgc_id: ${pgcId})`);

    if (saveOnly) {
      return { success: true, articleId: pgcId, method: 'draft' };
    }

    await sleep(2000);
    log('正式发布 (save=1)...');
    const pubResp = await fetch(`https://mp.toutiao.com/mp/agw/article/publish?${query}`, {
      method: 'POST',
      headers: postHeaders,
      body: toForm(buildBody(1, pgcId)),
      signal: AbortSignal.timeout(30000),
    });
    const pubData = await pubResp.json().catch(() => null);
    if (Number(pubData?.code ?? -1) !== 0) {
      return {
        success: false,
        error: `发布失败: ${JSON.stringify({ code: pubData?.code, message: pubData?.message })}`,
      };
    }
    log('发布成功');
    return { success: true, articleId: String(pubData?.data?.pgc_id || pgcId), method: 'publish' };
  } catch (err) {
    return { success: false, error: err.message || '发布失败' };
  }
}

async function verifyLogin(cookie) {
  const normalized = normalizeCookie(cookie);
  if (!normalized) return { ok: false, valid: false, error: '缺少 cookie' };
  try {
    const res = await fetch(
      `https://mp.toutiao.com/mp/agw/article/new?${new URLSearchParams({
        article_type: 0,
        format: 'json',
        compat: 1,
        column_no: '',
      })}`,
      { headers: buildHeaders(normalized, true), signal: AbortSignal.timeout(15000) },
    );
    const data = await res.json().catch(() => null);
    return Number(data?.code ?? -1) === 0
      ? { ok: true, valid: true }
      : { ok: true, valid: false, error: `登录态失效: ${data?.message || data?.code}` };
  } catch (err) {
    return { ok: false, valid: false, error: err.message };
  }
}

module.exports = { publishArticle, verifyLogin, normalizeCookie };
