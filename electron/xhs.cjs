'use strict';

const crypto = require('crypto');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const HOST = 'https://edith.xiaohongshu.com';
const FEED_URI = '/api/sns/web/v1/feed';

let clientModulePromise = null;
function getClientModule() {
  if (!clientModulePromise) {
    clientModulePromise = import('xhshow-js');
  }
  return clientModulePromise;
}

function cookieToDict(cookieStr) {
  const out = {};
  String(cookieStr || '')
    .split(';')
    .forEach((part) => {
      const idx = part.indexOf('=');
      if (idx <= 0) return;
      const key = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      if (key) out[key] = value;
    });
  return out;
}

function parseXhsUrl(raw) {
  const input = String(raw || '').trim();
  if (!input) return null;
  let url;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (!host.includes('xiaohongshu.com') && !host.includes('xhslink.com')) {
    return null;
  }
  const segments = url.pathname.split('/').filter(Boolean);
  let noteId = '';
  if (host.includes('xhslink.com')) {
    noteId = segments[segments.length - 1] || '';
  } else {
    const marks = ['explore', 'item', 'discovery', 'note'];
    const idx = segments.reduce(
      (acc, s, i) => (marks.includes(s) ? i : acc),
      -1,
    );
    noteId = idx >= 0 ? segments[idx + 1] || '' : segments[0] || '';
  }
  if (!/^[0-9a-zA-Z]{6,32}$/.test(noteId)) return null;
  return {
    noteId,
    xsecToken: url.searchParams.get('xsec_token') || '',
    xsecSource: url.searchParams.get('xsec_source') || 'pc_feed',
  };
}

function extractUrlFromText(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  // 完整链接：https://www.xiaohongshu.com/explore/xxx?xsec_token=...
  const longMatch = text.match(/https?:\/\/[^\s，。！？、；：,;!（()）【】"']+/i);
  if (longMatch) {
    return longMatch[0].replace(/[，。！？、；：,;!（()）【】"']+$/g, '');
  }
  // 分享短链：可能不带协议，如 xhslink.com/a/xxx
  const shortMatch = text.match(/(?:https?:\/\/)?xhslink\.com\/[^\s，。！？、；：,;!（()）【】"']+/i);
  if (shortMatch) {
    const rawLink = shortMatch[0].replace(/[，。！？、；：,;!（()）【】"']+$/g, '');
    return /^https?:\/\//i.test(rawLink) ? rawLink : `https://${rawLink}`;
  }
  return text;
}

function cleanImageUrl(raw) {
  if (!raw) return '';
  let url = String(raw).trim();
  if (url.startsWith('//')) url = 'https:' + url;
  return url;
}

function extractImageUrls(note) {
  const images = note?.image_list || [];
  const out = [];
  const seen = new Set();
  const sceneOrder = [
    'FD_WM_WEBP',
    'FD_PRV_WEBP',
    'FD_WM_JPG',
    'FD_PRV_JPG',
    'FD_WM_AVIF',
    'FD_PRV_AVIF',
  ];
  for (const img of images) {
    let raw =
      img?.urlOrigin ||
      img?.originalUrl ||
      img?.urlDefault ||
      img?.urlPre ||
      img?.url ||
      '';
    if (!raw && img?.trace_id) {
      raw = `https://sns-img-qc.xhscdn.com/${img.trace_id}`;
    } else if (!raw && img?.traceId) {
      raw = `https://sns-img-qc.xhscdn.com/${img.traceId}`;
    }
    const infoList = Array.isArray(img?.info_list) ? img.info_list : [];
    if (infoList.length) {
      for (const scene of sceneOrder) {
        const hit = infoList.find(
          (it) => String(it?.image_scene || '').toUpperCase() === scene,
        );
        if (hit?.url) {
          raw = hit.url;
          break;
        }
      }
      if (!raw) {
        const first = infoList.find((it) => it?.url);
        if (first) raw = first.url;
      }
    }
    const cleaned = cleanImageUrl(raw);
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      out.push(cleaned);
    }
  }
  return out;
}

function normalizeTags(tagList) {
  if (!Array.isArray(tagList)) return [];
  return tagList
    .map((t) => {
      if (typeof t === 'string') return t;
      return t?.name || t?.title || t?.type || '';
    })
    .map(sanitizeText)
    .filter(Boolean);
}

function sanitizeText(value) {
  return String(value ?? '')
    .replace(
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/gu,
      '',
    )
    .replace(/\u0000/g, '')
    .trim();
}

function normalizeNote(card, parsed) {
  const user = card?.user || {};
  const interact = card?.interact_info || {};
  const link = `https://www.xiaohongshu.com/explore/${parsed.noteId}`;
  const query = [];
  if (parsed.xsecToken) query.push(`xsec_token=${encodeURIComponent(parsed.xsecToken)}`);
  if (parsed.xsecSource) query.push(`xsec_source=${encodeURIComponent(parsed.xsecSource)}`);
  return {
    noteId: card?.note_id || parsed.noteId,
    type: card?.type || 'normal',
    title: sanitizeText(card?.title),
    desc: sanitizeText(card?.desc),
    tags: normalizeTags(card?.tag_list),
    images: extractImageUrls(card),
    author: {
      userId: user?.user_id || user?.userId || '',
      nickname: sanitizeText(user?.nickname),
      avatar: user?.avatar || '',
    },
    interact: {
      likedCount: interact?.liked_count || interact?.likedCount || '',
      collectedCount: interact?.collected_count || interact?.collectedCount || '',
      commentCount: interact?.comment_count || interact?.commentCount || '',
      shareCount: interact?.share_count || interact?.shareCount || '',
    },
    link: link + (query.length ? '?' + query.join('&') : ''),
  };
}

async function buildSignedHeaders(method, uri, body, cookieStr, opts = {}) {
  const cookies = cookieToDict(cookieStr);
  const a1 = cookies.a1 || cookies.A1 || '';
  if (!a1) {
    throw new Error(
      '当前 Cookie 缺少 a1 字段，请重新从已登录的小红书网页复制完整 Cookie',
    );
  }
  const mod = await getClientModule();
  const client = new mod.Client();
  const xT = client.getXT();
  return {
    'x-s': client.signXS(method, uri, a1, 'xhs-pc-web', body),
    'x-t': String(xT),
    'x-s-common': client.signXSCommon(cookies),
    'x-b3-traceid': client.getB3TraceId(),
    'x-xray-traceid': client.getXrayTraceId(),
    'user-agent': UA,
    cookie: String(cookieStr || ''),
    'content-type': 'application/json;charset=UTF-8',
    origin: opts.origin || 'https://www.xiaohongshu.com',
    referer: opts.referer || 'https://www.xiaohongshu.com/',
  };
}

/* ---------------- 小红书笔记发布 ---------------- */

function sha1(data) {
  return crypto.createHash('sha1').update(data).digest();
}

function hmacSha1(key, data) {
  return crypto.createHmac('sha1', key).update(data).digest();
}

function xhsCosAuthorization(method, url, headers = {}) {
  const parsed = new URL(url);
  const start = Math.floor(Date.now() / 1000);
  const keyTime = `${start};${start + 86400}`;
  const params = [...parsed.searchParams.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeURIComponent(key.toLowerCase())}=${encodeURIComponent(value)}`)
    .join('&');
  const signedHeaders = Object.entries(headers)
    .map(([key, value]) => [key.toLowerCase(), String(value)])
    .sort(([a], [b]) => a.localeCompare(b));
  const headerNames = signedHeaders.map(([key]) => key).join(';');
  const headerValues = signedHeaders.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
  const httpString = `${method.toLowerCase()}\n${parsed.pathname}\n${params}\n${headerValues}\n`;
  const stringToSign = `sha1\n${keyTime}\n${sha1(httpString).toString('base64')}\n`;
  const signature = hmacSha1(hmacSha1('null', keyTime), stringToSign).toString('base64');
  return `q-sign-algorithm=sha1&q-ak=null&q-sign-time=${keyTime}&q-key-time=${keyTime}&q-header-list=${headerNames}&q-url-param-list=${[...parsed.searchParams.keys()].map((k) => k.toLowerCase()).sort().join(';')}&q-signature=${signature}`;
}

function parsePngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(12) !== 0x49484452) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function parseJpegSize(buf) {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    const len = buf.readUInt16BE(i + 2);
    i += 2 + len;
  }
  return null;
}

function imageSize(buf) {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50) return parsePngSize(buf);
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8) return parseJpegSize(buf);
  return { width: 900, height: 1200 };
}

function dataUrlToBuffer(dataUrl) {
  const m = String(dataUrl || '').match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!m) throw new Error('图片不是有效的 dataURL');
  const buf = Buffer.from(m[3], m[2] ? 'base64' : 'utf8');
  const mime = (m[1] || 'image/png').split('/')[1] || 'png';
  return { buf, mime };
}

async function xhsFetchJson(label, url, options = {}, cookieStr, site) {
  const uri = new URL(url);
  const method = String(options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.stringify(options.body) : null;
  const headers = await buildSignedHeaders(method, uri.pathname + uri.search, body ? JSON.parse(body) : undefined, cookieStr, {
    origin: site === 'creator' ? 'https://creator.xiaohongshu.com' : 'https://www.xiaohongshu.com',
    referer: site === 'creator' ? 'https://creator.xiaohongshu.com/' : 'https://www.xiaohongshu.com/',
  });
  const res = await fetch(url, {
    method,
    headers,
    body: body || undefined,
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text().catch(() => '');
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* keep null */
  }
  if (!res.ok) {
    throw new Error(`${label} 返回 HTTP ${res.status}：${text.slice(0, 300)}`);
  }
  if (!data || data.success !== true) {
    throw new Error(`${label} 失败：${data?.msg || data?.message || text.slice(0, 300)}`);
  }
  return data;
}

async function searchXhsTopic(cookieStr, keyword, desc) {
  try {
    const data = await xhsFetchJson(
      '小红书话题搜索',
      'https://edith.xiaohongshu.com/web_api/sns/v1/search/topic',
      {
        method: 'POST',
        body: {
          keyword,
          suggest_topic_request: { title: '', desc: desc || '' },
          page: { page_size: 20, page: 1 },
        },
      },
      cookieStr,
      'creator',
    );
    const list = data?.data?.topic_info_dtos || [];
    const exact = list.find((t) => String(t.name || '').toLowerCase() === String(keyword).toLowerCase());
    const picked = exact || list.find((t) => t.id && t.name);
    return picked ? { id: String(picked.id), name: String(picked.name), type: 'topic' } : null;
  } catch {
    return null;
  }
}

async function recommendXhsTopics(cookieStr, desc, fileIds) {
  const data = await xhsFetchJson(
    '小红书话题推荐',
    'https://creator.xiaohongshu.com/api/galaxy/v2/creator/recommend/overt/topics',
    {
      method: 'POST',
      body: {
        title: '',
        desc: desc || '',
        file_ids: (fileIds || []).join(','),
        source: 2,
        topic_round_start_time: Date.now(),
      },
    },
    cookieStr,
    'creator',
  );
  return (data?.data?.topics || []).filter((t) => t && t.id && t.name);
}

function mapXhsContentDeclaration(value) {
  const map = {
    '虚构演绎，仅供娱乐': 'FICTIONAL_DEDUCTION',
    '笔记含AI合成内容': 'AI_GENERATED_CONTENT',
    '内容包含营销广告': 'MARKETING_AD',
  };
  return map[String(value || '').trim()] || '';
}

async function uploadXhsImages(cookieStr, images) {
  const fileCount = images.length;
  const permit = await xhsFetchJson(
    '小红书图片上传凭证',
    `https://creator.xiaohongshu.com/api/media/v1/upload/creator/permit?biz_name=spectrum&scene=image&file_count=${fileCount}&version=1&source=web`,
    { method: 'GET' },
    cookieStr,
    'creator',
  );
  const permits = permit?.data?.uploadTempPermits || [];
  const p0 = permits.find((p) => p.uploadAddr && p.fileIds?.length && p.token) || permits[0] || {};
  const host = p0.uploadAddr;
  const fileIds = p0.fileIds || [];
  const token = p0.token || '';
  if (!host || !fileIds.length || !token) {
    throw new Error('小红书图片上传凭证不完整');
  }
  const uploaded = [];
  for (let i = 0; i < images.length; i += 1) {
    const { buf, mime } = dataUrlToBuffer(images[i]);
    const fileId = fileIds[i];
    if (!fileId) throw new Error('图片上传凭证数量不足');
    const size = imageSize(buf);
    const baseUrl = `https://${host}/${fileId}`;
    const signHeaders = { 'content-length': buf.length, host };
    const res = await fetch(baseUrl, {
      method: 'PUT',
      headers: {
        'user-agent': UA,
        'content-type': `image/${mime}`,
        'x-cos-security-token': token,
        authorization: xhsCosAuthorization('PUT', baseUrl, signHeaders),
        origin: 'https://creator.xiaohongshu.com',
      },
      body: buf,
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`小红书图片上传失败 HTTP ${res.status}：${t.slice(0, 200)}`);
    }
    uploaded.push({
      file_id: fileId,
      width: size.width,
      height: size.height,
      mime: `image/${mime}`,
    });
  }
  return uploaded;
}

async function publishXhsNote({ cookie, title, desc, images, topics = [], original, contentDeclaration }) {
  if (!cookie || !String(cookie).trim()) throw new Error('小红书 Cookie 缺失，请先在账号中心登录小红书');
  if (!Array.isArray(images) || !images.length) throw new Error('小红书笔记发布需要至少 1 张图片');
  const uploaded = await uploadXhsImages(cookie, images);
  const hashTag = [];
  const recommended = await recommendXhsTopics(cookie, desc, uploaded.map((u) => u.file_id)).catch(() => []);
  const wants = topics.map((tag) => String(tag).replace(/^#/, '').trim()).filter(Boolean);
  for (const t of wants) {
    const hit =
      recommended.find((r) => String(r.name).trim() === t) ||
      recommended.find((r) => String(r.name).includes(t) || t.includes(String(r.name)));
    if (hit) {
      hashTag.push({ id: String(hit.id), name: String(hit.name), type: 'topic' });
    } else {
      const found = await searchXhsTopic(cookie, t, desc);
      if (found) hashTag.push(found);
    }
  }
  // 官方正文里命中话题要写成 #名称[话题]#，才能渲染成话题
  let finalDesc = String(desc || '');
  finalDesc = finalDesc.replace(/#([^\s#]+)/g, (all, name) => {
    const hit = hashTag.find((h) => h.name === name || h.name.includes(name) || name.includes(h.name));
    return hit ? `#${hit.name}[话题]#` : all;
  });
  const creatorId =
    (String(cookie).match(/x-user-id-creator\.xiaohongshu\.com=([^;\s]+)/) || [])[1] || '';
  const isOriginal = original === 'original' || original === true;
  const optionRelationList = [];
  if (isOriginal && creatorId) {
    optionRelationList.push({
      type: 'ORIGINAL_STATEMENT',
      relationList: [
        {
          bizType: 'ORIGINAL_STATEMENT',
          bizId: creatorId,
          extraInfo: '{}',
        },
      ],
    });
  }
  const contentCode = mapXhsContentDeclaration(contentDeclaration);
  if (contentCode) {
    optionRelationList.push({ type: contentCode, relationList: [] });
  }
  const body = {
    common: {
      type: 'normal',
      note_id: '',
      source: JSON.stringify({ type: 'web', ids: '', extraInfo: JSON.stringify({ systemId: 'web' }) }),
      title: String(title || '').slice(0, 20),
      desc: finalDesc,
      ats: [],
      hash_tag: hashTag,
      business_binds: JSON.stringify({
        version: 1,
        noteId: 0,
        bizType: 0,
        noteOrderBind: {},
        notePostTiming: {},
        noteCollectionBind: { id: '' },
        noteSketchCollectionBind: { id: '' },
        userDeclarationBind: { origin: isOriginal ? 1 : 2 },
        coProduceBind: { enable: isOriginal },
        noteCopyBind: { copyable: isOriginal },
        interactionPermissionBind: { commentPermission: 0 },
        optionRelationList,
      }),
      privacy_info: { op_type: 1, type: 0, user_ids: [] },
      goods_info: {},
      biz_relations: [],
      capa_trace_info: {
        contextJson: JSON.stringify({
          recommend_title: { recommend_title_id: '', is_use: 3, used_index: -1 },
          recommendTitle: [],
          recommend_topics: {
            used: hashTag.map((t) => ({ id: t.id, name: t.name, topic_source: 'recommend_exposed_display' })),
          },
        }),
      },
    },
    image_info: {
      images: uploaded.map((u) => ({
        file_id: u.file_id,
        width: u.width,
        height: u.height,
        metadata: { source: -1 },
        stickers: { version: 2, floating: [] },
        extra_info_json: JSON.stringify({
          mimeType: u.mime,
          image_metadata: { bg_color: '', origin_size: u.width * u.height * 4 },
        }),
      })),
    },
    video_info: null,
  };
  const data = await xhsFetchJson(
    '小红书笔记发布',
    'https://edith.xiaohongshu.com/web_api/sns/v2/note',
    { method: 'POST', body },
    cookie,
    'creator',
  );
  const noteId = String(data?.data?.id || '').trim();
  if (!noteId) throw new Error('小红书发布未返回笔记 ID');
  return {
    noteId,
    shareLink: data.share_link || `https://www.xiaohongshu.com/explore/${noteId}`,
  };
}

async function resolveShortUrl(rawUrl) {
  try {
    const res = await fetch(rawUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'user-agent': UA },
      signal: AbortSignal.timeout(15000),
    });
    return res.url || rawUrl;
  } catch {
    return rawUrl;
  }
}

async function fetchXhsNote(url, cookieStr) {
  if (!cookieStr || !String(cookieStr).trim()) {
    throw new Error('请先填写小红书登录 Cookie，才能读取笔记');
  }
  const extracted = extractUrlFromText(url);
  const target = /xhslink\.com/i.test(extracted)
    ? await resolveShortUrl(extracted)
    : extracted;
  const parsed = parseXhsUrl(target);
  if (!parsed || !parsed.noteId) {
    throw new Error(
      '无法识别小红书笔记链接，请粘贴 xiaohongshu.com/explore/... 完整地址，或小红书 App 里的整段分享文本（会同时带 xsec_token）',
    );
  }
  if (!parsed.xsecToken) {
    throw new Error(
      '该链接缺少 xsec_token，小红书现在要求笔记链接带授权参数。请用浏览器打开笔记后复制带 xsec_token 的完整地址，或使用「分享 → 复制链接」。',
    );
  }

  const body = {
    source_note_id: parsed.noteId,
    image_formats: ['jpg', 'webp', 'avif'],
    extra: { need_body_topic: 1 },
    xsec_source: parsed.xsecSource || 'pc_feed',
    xsec_token: parsed.xsecToken,
  };
  const headers = await buildSignedHeaders('POST', FEED_URI, body, cookieStr);
  let res;
  try {
    res = await fetch(HOST + FEED_URI, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    throw new Error(`无法连接小红书接口：${err.message}`);
  }
  if (res.status === 461 || res.status === 471) {
    const verifyType = res.headers.get('verifytype') || '';
    const verifyUuid = res.headers.get('verifyuuid') || '';
    throw new Error(
      `小红书触发验证（HTTP ${res.status}）${verifyType ? `，Verifytype: ${verifyType}` : ''}${verifyUuid ? `，Verifyuuid: ${verifyUuid}` : ''}。建议稍后重试或更换 Cookie。`,
    );
  }
  const text = await res.text().catch(() => '');
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* keep null */
  }
  if (!res.ok) {
    throw new Error(`小红书接口返回 HTTP ${res.status}：${text.slice(0, 300)}`);
  }
  if (!data || data.success !== true) {
    const msg = data?.msg || data?.message || text.slice(0, 300) || '未知错误';
    const code = data?.code;
    if (code === -510000 || code === -510001) {
      throw new Error('笔记不存在、已删除或状态异常（可能链接已失效）。');
    }
    throw new Error(`小红书返回失败（${code ?? 'no code'}）：${msg}`);
  }
  const items = data?.data?.items || data?.items || [];
  const card = items?.[0]?.note_card;
  if (!card) {
    throw new Error('接口没有返回笔记内容，可能是 Cookie 失效或触发风控，请重新登录后复制 Cookie。');
  }
  return normalizeNote(card, parsed);
}

async function downloadNoteImages(urls, cookieStr, referer) {
  const list = Array.isArray(urls) ? urls : [];
  const ref = referer || 'https://www.xiaohongshu.com/';
  const out = new Array(list.length);
  let cursor = 0;
  const CDN_HOSTS = [
    'https://sns-img-hw.xhscdn.com',
    'https://sns-img-qc.xhscdn.com',
    'https://sns-img-bd.xhscdn.com',
    'https://sns-img-qn.xhscdn.com',
  ];
  function candidateUrls(url) {
    const candidates = [url];
    const bang = url.indexOf('!');
    if (bang > 0) candidates.push(url.slice(0, bang));
    const pathMatch = url.match(/^https?:\/\/[^/]+\/(.+)$/);
    if (pathMatch) {
      const trace = pathMatch[1].split('!')[0].split('?')[0];
      for (const host of CDN_HOSTS) {
        candidates.push(`${host}/${trace}?imageView2/2/w/1080/format/jpg`);
        candidates.push(`${host}/${trace}?imageView2/2/w/750/format/jpg`);
        candidates.push(`${host}/${trace}?imageView2/2/w/0/format/jpg/v3`);
        candidates.push(`${host}/${trace}`);
      }
    }
    return Array.from(new Set(candidates));
  }
  async function tryDownload(candidate, withCookie) {
    try {
      const res = await fetch(candidate, {
        headers: {
          'user-agent': UA,
          accept:
            'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          referer: ref,
          origin: 'https://www.xiaohongshu.com',
          'sec-fetch-dest': 'image',
          'sec-fetch-mode': 'no-cors',
          'sec-fetch-site': 'cross-site',
          ...(withCookie && cookieStr ? { cookie: String(cookieStr) } : {}),
        },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) return { error: `HTTP ${res.status}` };
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 15 * 1024 * 1024) {
        return { error: '图片超过 15MB，未导入' };
      }
      let mime =
        (res.headers.get('content-type') || 'image/jpeg').split(';')[0] ||
        'image/jpeg';
      if (mime === 'image/jpg') mime = 'image/jpeg';
      return {
        dataUrl: `data:${mime};base64,${buf.toString('base64')}`,
      };
    } catch (err) {
      return { error: err.message || String(err) };
    }
  }
  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= list.length) return;
      const url = list[index];
      let lastError = '';
      let downloaded = false;
      for (const candidate of candidateUrls(url)) {
        const r = await tryDownload(candidate, true);
        if (r.dataUrl) {
          out[index] = { url, ok: true, dataUrl: r.dataUrl };
          downloaded = true;
          break;
        }
        lastError = r.error || lastError;
      }
      if (!downloaded) {
        // 部分 CDN 拒绝带 Cookie 的请求，去掉 Cookie 再兜底一次
        for (const candidate of candidateUrls(url).slice(0, 4)) {
          const r = await tryDownload(candidate, false);
          if (r.dataUrl) {
            out[index] = { url, ok: true, dataUrl: r.dataUrl };
            downloaded = true;
            break;
          }
          lastError = r.error || lastError;
        }
      }
      if (!downloaded) out[index] = { url, ok: false, error: lastError || '下载失败' };
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(2, list.length) }, () => worker()),
  );
  return out;
}

module.exports = {
  fetchXhsNote,
  downloadNoteImages,
  parseXhsUrl,
  extractUrlFromText,
  buildSignedHeaders,
  publishXhsNote,
};
