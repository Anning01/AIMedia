'use strict';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function normalizeCookie(raw = '') {
  const text = String(raw || '').trim();
  if (!text) return '';
  const cleaned = text
    .replace(/^cookie\s*:\s*/i, '')
    .replace(/[\r\n\t]+/g, '; ')
    .replace(/;\s*;+/g, ';')
    .trim();
  if (cleaned.includes(';')) return cleaned;
  if (cleaned.includes(',')) {
    return cleaned
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .join('; ');
  }
  return cleaned;
}

function toForm(data = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(data)) {
    params.set(k, v === undefined || v === null ? '' : String(v));
  }
  return params.toString();
}

function parseJsonp(text) {
  if (!text) return null;
  const trimmed = String(text).trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const m = trimmed.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function getToken(cookie) {
  const cookieStr = normalizeCookie(cookie);
  if (!cookieStr) throw new Error('缺少百家号 cookie');
  const headers = {
    Cookie: cookieStr,
    Referer: 'https://baijiahao.baidu.com/builder/rc/author',
    'User-Agent': UA,
    Accept: 'application/json, text/plain, */*',
    Origin: 'https://baijiahao.baidu.com',
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  const bjhStoken = (cookieStr.match(/bjhStoken=([^;]+)/) || [])[1] || '';
  const devStoken = (cookieStr.match(/devStoken=([^;]+)/) || [])[1] || '';
  if (bjhStoken) headers.bjh = bjhStoken;
  if (devStoken) headers.dev = devStoken;
  const resp = await fetch('https://baijiahao.baidu.com/pcui/home/dealtoken', {
    method: 'POST',
    headers,
    body: '',
    signal: AbortSignal.timeout(20000),
  });
  const headerToken = String(
    resp.headers.get('token') || resp.headers.get('Token') || resp.headers.get('TOKEN') || '',
  ).trim();
  const data = await resp.json().catch(() => null);
  const token = headerToken || data?.data?.token || data?.token || '';
  if (!token) throw new Error('获取百家号 token 失败');
  return token;
}

async function uploadImage(cookie, token, imageUrl) {
  const cookieStr = normalizeCookie(cookie);
  let buf;
  let contentType;
  if (/^data:/i.test(String(imageUrl))) {
    const m = String(imageUrl).match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
    if (!m) throw new Error('非法URL');
    buf = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8');
    contentType = m[1] || 'image/jpeg';
  } else {
    const imgResp = await fetch(imageUrl, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(30000),
    });
    if (!imgResp.ok) throw new Error(`下载图片失败 HTTP ${imgResp.status}`);
    buf = Buffer.from(await imgResp.arrayBuffer());
    contentType = imgResp.headers.get('content-type') || 'image/jpeg';
  }
  const ext = contentType.split('/')[1] || 'jpg';

  const form = new FormData();
  form.append('media', new Blob([buf], { type: contentType }), `image.${ext}`);
  const uploadResp = await fetch('https://baijiahao.baidu.com/materialui/picture/uploadProxy', {
    method: 'POST',
    headers: {
      Cookie: cookieStr,
      token,
      Origin: 'https://baijiahao.baidu.com',
      Referer: 'https://baijiahao.baidu.com/builder/rc/edit?type=news&is_from_cms=1',
      'User-Agent': UA,
      Accept: 'application/json, text/plain, */*',
    },
    body: form,
    signal: AbortSignal.timeout(60000),
  });
  const data = await uploadResp.json().catch(() => null);
  if (Number(data?.errno) !== 0) {
    throw new Error(`图片上传失败: ${data?.errmsg || 'unknown'}`);
  }
  const bosUrl = data?.ret?.bos_url || data?.ret?.url || '';
  if (!bosUrl) throw new Error('图片上传未返回 URL');
  return bosUrl.replace(/^http:\/\//, 'https://');
}

async function publishArticle(cookie, payload = {}, onLog) {
  const log = (msg) => {
    if (typeof onLog === 'function') onLog(msg);
  };
  const cookieStr = normalizeCookie(cookie);
  if (!cookieStr) return { success: false, error: '缺少百家号 cookie' };

  const title = String(payload.title || '').trim();
  const content = String(payload.content || '').trim();
  if (!title || !content) return { success: false, error: '缺少标题或内容' };

  try {
    log('获取 token...');
    let token;
    try {
      token = await getToken(cookieStr);
    } catch (e) {
      return { success: false, error: e.message };
    }

    log('上传正文图片...');
    let safeContent = content;
    const imgTagRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi;
    const imgUrls = [];
    let m;
    while ((m = imgTagRegex.exec(content)) !== null) imgUrls.push(m[1]);
    const imgUrlMap = {};
    for (const imgUrl of imgUrls) {
      try {
        imgUrlMap[imgUrl] = await uploadImage(cookieStr, token, imgUrl);
      } catch (e) {
        log(`图片上传失败保留原链: ${e.message}`);
        imgUrlMap[imgUrl] = imgUrl;
      }
    }
    for (const [origUrl, proxyUrl] of Object.entries(imgUrlMap)) {
      if (proxyUrl !== origUrl) safeContent = safeContent.split(origUrl).join(proxyUrl);
    }

    let coverSrc = '';
    let originalCoverSrc = '';
    if (imgUrls.length > 0) {
      coverSrc = imgUrlMap[imgUrls[0]] || '';
      originalCoverSrc = imgUrls[0];
    }
    if (!coverSrc) {
      const extCover = String(payload.cover_image_url || '').trim();
      if (extCover) {
        originalCoverSrc = extCover;
        try {
          coverSrc = await uploadImage(cookieStr, token, extCover);
        } catch (e) {
          log(`封面上传失败: ${e.message}`);
        }
      }
    }
    if (!originalCoverSrc) originalCoverSrc = coverSrc;

    const coverImageObj = coverSrc
      ? {
          src: coverSrc,
          cropData: {},
          machine_chooseimg: 0,
          isLegal: 0,
          cover_source_tag: 'text',
        }
      : null;
    const coverImages = coverSrc ? JSON.stringify([coverImageObj]) : '[]';
    const coverImagesMap = coverSrc
      ? JSON.stringify([{ src: coverSrc, origin_src: originalCoverSrc }])
      : '[]';

    const contentLen = safeContent.length;
    const autoMountGoods =
      payload.bjh_auto_goods != null
        ? payload.bjh_auto_goods
        : payload.bjh_auto_mount_goods == null
          ? 0
          : payload.bjh_auto_mount_goods;
    const draftPayload = {
      type: 'news',
      title,
      content: safeContent,
      'event_spec[pos]': '',
      'event_spec[time]': '',
      auto_mount_goods: autoMountGoods ? 1 : 0,
      news_mount: '',
      len: contentLen,
      'activity_list[0][id]': 'ttv',
      'activity_list[0][is_checked]': payload.bjh_ttv == null ? 1 : payload.bjh_ttv ? 1 : 0,
      'activity_list[1][id]': 'ai_tts',
      'activity_list[1][is_checked]': payload.bjh_ai_tts == null ? 1 : payload.bjh_ai_tts ? 1 : 0,
      'activity_list[2][id]': 'telphone',
      'activity_list[2][is_checked]': 0,
      'activity_list[3][id]': 'reward',
      'activity_list[3][is_checked]': 1,
      'activity_list[4][id]': 'aigc_bjh_status',
      'activity_list[4][is_checked]': payload.bjh_aigc == null ? 0 : payload.bjh_aigc ? 1 : 0,
      'cover_image_source[wide_cover_image_source]': 'text',
      abstract_from: 1,
      isBeautify: false,
      usingImgFilter: false,
      first_exclusive_publish_v2: 3,
      cover_layout: coverSrc ? 'one' : '',
      cover_images: coverSrc ? coverImages : '[]',
      _cover_images_map: coverSrc ? coverImagesMap : '[]',
      source: 'upload',
      cover_source: coverSrc ? 'upload' : '',
      subtitle: '',
      bjhtopic_id: '',
      bjhtopic_info: '',
    };

    const saveResp = await fetch(
      'https://baijiahao.baidu.com/pcui/article/save?callback=bjhdraft',
      {
        method: 'POST',
        headers: {
          Cookie: cookieStr,
          'Content-Type': 'application/x-www-form-urlencoded',
          Origin: 'https://baijiahao.baidu.com',
          Referer: 'https://baijiahao.baidu.com/builder/rc/edit?type=news&is_from_cms=1',
          'User-Agent': UA,
          Accept: 'application/json, text/plain, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9',
          token,
        },
        body: toForm(draftPayload),
        redirect: 'manual',
        signal: AbortSignal.timeout(30000),
      },
    );
    const saveToken = String(
      saveResp.headers.get('token') || saveResp.headers.get('Token') || '',
    ).trim();
    if (saveToken) token = saveToken;
    const saveData = parseJsonp(await saveResp.text());
    if (Number(saveData?.errno) !== 0) {
      return {
        success: false,
        error: `${saveData?.errmsg || '草稿保存失败'} | errno=${saveData?.errno}`,
      };
    }
    const articleId =
      saveData?.ret?.article_id || saveData?.data?.article_id || saveData?.ret?.id || '';
    log(`草稿保存成功 article_id=${articleId}`);
    if (!articleId) {
      const nid = saveData?.ret?.nid || '';
      if (nid) return { success: true, articleId: nid, method: 'draft' };
      return { success: false, error: '未获取到百家号 article_id' };
    }

    if (payload.save_draft_only === true) {
      return { success: true, articleId, method: 'draft' };
    }

    const bjhFeNounce = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join('');
    const imageEditPoint = JSON.stringify([
      { img_type: 'cover', img_num: { template: 0, font: 0, filter: 0, paster: 0, cut: 0, any: 0 } },
      { img_type: 'body', img_num: { template: 0, font: 0, filter: 0, paster: 0, cut: 0, any: 0 } },
    ]);
    const publishPayload = {
      ...draftPayload,
      'activity_list[3][id]': 'aigc_bjh_status',
      'activity_list[3][is_checked]': payload.bjh_aigc == null ? 0 : payload.bjh_aigc ? 1 : 0,
      'activity_list[4][id]': 'reward',
      'activity_list[4][is_checked]': 1,
      clue: '',
      bjhmt: '',
      order_id: '',
      BJH_FE_NOUNCE: bjhFeNounce,
      aigc_rebuild: '',
      image_edit_point: imageEditPoint,
      article_id: articleId,
      token,
    };

    const ts1 = Date.now();
    const ts2 = ts1 - Math.floor(Math.random() * 1000000);
    const acsToken = `${ts2}_${ts1}_${Buffer.from(String(ts2)).toString('base64').replace(/=/g, '')}`;

    const publishResp = await fetch(
      'https://baijiahao.baidu.com/pcui/article/publish?type=news&callback=bjhpublish',
      {
        method: 'POST',
        headers: {
          Cookie: cookieStr,
          'Content-Type': 'application/x-www-form-urlencoded',
          Origin: 'https://baijiahao.baidu.com',
          Referer: `https://baijiahao.baidu.com/builder/rc/edit?type=news&article_id=${articleId}`,
          'User-Agent': UA,
          Accept: 'application/json, text/plain, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9',
          token,
          'Acs-Token': acsToken,
        },
        body: toForm(publishPayload),
        signal: AbortSignal.timeout(30000),
      },
    );
    const publishData = parseJsonp(await publishResp.text());
    if (Number(publishData?.errno) !== 0) {
      return {
        success: false,
        error: `${publishData?.errmsg || '百家号发布失败'} | errno=${publishData?.errno}`,
      };
    }
    log('发布成功');
    return { success: true, articleId, method: 'publish' };
  } catch (err) {
    return { success: false, error: err.message || '发布失败' };
  }
}

async function verifyLogin(cookie) {
  try {
    await getToken(cookie);
    return { ok: true, valid: true };
  } catch (err) {
    return { ok: true, valid: false, error: err.message };
  }
}

module.exports = { publishArticle, verifyLogin, normalizeCookie, getToken };
