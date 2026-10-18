'use strict';

const crypto = require('crypto');

const ENDPOINT = 'https://visual.volcengineapi.com';
const SERVICE = 'cv';
const REGION = 'cn-north-1';
const VERSION = '2022-08-31';
const ACTION = 'CVProcess';

function sha256Hex(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

function hmac(key, s) {
  return crypto.createHmac('sha256', key).update(s, 'utf8').digest();
}

function uriEscape(str) {
  return encodeURIComponent(str)
    .replace(/[^A-Za-z0-9_.~\-%]+/g, (ch) =>
      Buffer.from(ch, 'utf8')
        .toString('hex')
        .replace(/../g, '%$&'),
    )
    .replace(/\*/g, '%2A');
}

function getDateTimeNow() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

function queryParamsToString(params) {
  return Object.keys(params)
    .sort()
    .map((key) => {
      const val = params[key];
      if (val === undefined || val === null) return '';
      const k = uriEscape(key);
      if (Array.isArray(val)) {
        return val
          .map(uriEscape)
          .sort()
          .map((v) => `${k}=${v}`)
          .join('&');
      }
      return `${k}=${uriEscape(val)}`;
    })
    .filter(Boolean)
    .join('&');
}

function signRequest({ method, query, body, accessKeyId, secretAccessKey, service, region }) {
  const datetime = getDateTimeNow();
  const date = datetime.substring(0, 8);
  const host = ENDPOINT.replace(/^https?:\/\//, '');
  const bodySha = sha256Hex(body || '');
  const headers = {
    host,
    'x-date': datetime,
    'x-content-sha256': bodySha,
    'content-type': 'application/json',
  };
  const signedHeaderKeys = Object.keys(headers)
    .map((k) => k.toLowerCase())
    .sort()
    .join(';');
  const canonicalHeaders =
    Object.keys(headers)
      .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))
      .map((k) => `${k.toLowerCase()}:${String(headers[k]).trim().replace(/\s+/g, ' ')}`)
      .join('\n') + '\n';
  const canonicalRequest = [
    method.toUpperCase(),
    '/',
    queryParamsToString(query),
    canonicalHeaders,
    signedHeaderKeys,
    bodySha,
  ].join('\n');
  const credentialScope = [date, region, service, 'request'].join('/');
  const stringToSign = ['HMAC-SHA256', datetime, credentialScope, sha256Hex(canonicalRequest)].join('\n');
  const kDate = hmac(secretAccessKey, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'request');
  const signature = hmac(kSigning, stringToSign).toString('hex');
  return `HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaderKeys}, Signature=${signature}`;
}

async function cutoutProduct(dataUrl, cfg = {}) {
  const ak = String(cfg.VOLC_ACCESS_KEY || '').trim();
  const sk = String(cfg.VOLC_SECRET_KEY || '').trim();
  if (!ak || !sk) {
    throw new Error(
      '未配置火山引擎 AK/SK，无法抠图：请到「设置 → 小红书配图」填写火山引擎访问密钥，或在 config/ai.env 配置 VOLC_ACCESS_KEY / VOLC_SECRET_KEY',
    );
  }
  const base64 = String(dataUrl || '').split(',')[1] || '';
  if (!base64) throw new Error('图片数据无效');
  const body = JSON.stringify({
    req_key: String(cfg.VOLC_SEG_REQ_KEY || 'saliency_seg').trim(),
    binary_data_base64: [base64],
  });
  const query = {
    Action: ACTION,
    Version: VERSION,
  };
  const authorization = signRequest({
    method: 'POST',
    query,
    body,
    accessKeyId: ak,
    secretAccessKey: sk,
    service: SERVICE,
    region: REGION,
  });
  const datetime = getDateTimeNow();
  const host = ENDPOINT.replace(/^https?:\/\//, '');
  const bodySha = sha256Hex(body);
  const res = await fetch(`${ENDPOINT}?${queryParamsToString(query)}`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
      Host: host,
      'X-Date': datetime,
      'X-Content-Sha256': bodySha,
    },
    body,
    signal: AbortSignal.timeout(60000),
  });
  const text = await res.text().catch(() => '');
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* keep null */
  }
  if (!res.ok) {
    throw new Error(`火山抠图接口返回 HTTP ${res.status}：${text.slice(0, 400)}`);
  }
  return parseCutoutResponse(data, text);
}

function parseCutoutResponse(data, rawText) {
  if (!data) {
    throw new Error('火山抠图接口返回空响应');
  }
  const code = data.code ?? data.status ?? data.StatusCode;
  const hasCode = code !== undefined && code !== null;
  const msgOk = data.message === 'Success' || data.msg === 'Success';
  const metaOk = data.ResponseMetadata ? !data.ResponseMetadata.Error : false;
  const isOk = hasCode ? code === 0 || code === '0' || msgOk : msgOk || metaOk;
  if (!isOk) {
    throw new Error(
      `火山抠图失败：${(data && (data.message || data.msg)) || (rawText || '').slice(0, 300)}`,
    );
  }
  const d = data.data || data;
  const raw = Array.isArray(d.binary_data_base64)
    ? d.binary_data_base64[0]
    : d.image_base64 || d.result_base64 || d.base64 || '';
  if (!raw) throw new Error('火山抠图接口没有返回图片数据');
  return `data:image/png;base64,${String(raw).replace(/^data:image\/\w+;base64,/, '')}`;
}

module.exports = { cutoutProduct, parseCutoutResponse, signRequest, getDateTimeNow };
