/**
 * 图片磁盘存储：
 * - 图片统一保存到 {userData}/images/{library|generated|history}/ 目录
 * - 页面通过 wgh-image:// 协议读取（带 CORS 头，支持 canvas/html-to-image）
 * - 提供 IPC：保存图片、读取图片、打开图片目录（供用户清理）
 */
const { app, protocol, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;

const SCHEME = 'wgh-image';
const KINDS = ['library', 'generated', 'history'];

let imagesDir = '';

function getImagesDir() {
  if (!imagesDir) imagesDir = path.join(app.getPath('userData'), 'images');
  return imagesDir;
}

async function ensureDirs() {
  const base = getImagesDir();
  await Promise.all(KINDS.map((k) => fsp.mkdir(path.join(base, k), { recursive: true })));
}

function kindDir(kind) {
  return path.join(getImagesDir(), KINDS.includes(kind) ? kind : 'library');
}

function dataUrlToBuffer(dataUrl) {
  const m = String(dataUrl || '').match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!m) throw new Error('无法解析 data URL 图片');
  const contentType = m[1] || 'image/jpeg';
  const buf = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8');
  if (!buf.length) throw new Error('图片内容为空');
  return { buf, contentType };
}

function extOf(contentType) {
  const t = String(contentType || '').split(';')[0].trim();
  if (t === 'image/png') return '.png';
  if (t === 'image/webp') return '.webp';
  if (t === 'image/gif') return '.gif';
  return '.jpg';
}

function contentTypeOf(abs) {
  const ext = path.extname(abs).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/jpeg';
}

function resolveWghFile(urlOrPath) {
  const base = path.resolve(getImagesDir());
  let rel = '';
  if (String(urlOrPath).startsWith(`${SCHEME}://`)) {
    const u = new URL(urlOrPath);
    // wgh-image://library/a.png → host=library, path=/a.png
    const host = u.hostname || '';
    rel = decodeURIComponent(`${host}/${u.pathname.replace(/^\/+/, '')}`).replace(/^\/+/, '');
  } else {
    rel = String(urlOrPath || '').replace(/^[/\\]+/, '');
  }
  const abs = path.resolve(base, rel);
  if (!abs.startsWith(base + path.sep)) throw new Error('非法图片路径');
  return abs;
}

async function saveImageFromDataUrl(dataUrl, kind) {
  const { buf, contentType } = dataUrlToBuffer(dataUrl);
  const name = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extOf(contentType)}`;
  const dir = kindDir(kind);
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(path.join(dir, name), buf);
  return { url: `${SCHEME}://${kind}/${name}`, path: `${kind}/${name}` };
}

async function readImageBuffer(urlOrPath) {
  const abs = resolveWghFile(urlOrPath);
  const buf = await fsp.readFile(abs);
  if (!buf.length) throw new Error('图片内容为空');
  return { buf, contentType: contentTypeOf(abs) };
}

function registerImageIpc() {
  ipcMain.handle('image-save', async (_e, payload = {}) => {
    try {
      const r = await saveImageFromDataUrl(payload.dataUrl, payload.kind);
      return { ok: true, url: r.url, path: r.path };
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  });

  ipcMain.handle('image-read', async (_e, payload = {}) => {
    try {
      const { buf, contentType } = await readImageBuffer(payload.src || payload.path);
      return { ok: true, dataUrl: `data:${contentType};base64,${buf.toString('base64')}` };
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  });

  ipcMain.handle('image-open-dir', async () => {
    try {
      await ensureDirs();
      const err = await shell.openPath(getImagesDir());
      return { ok: !err, error: err || '' };
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  });
}

function init() {
  protocol.handle(SCHEME, async (request) => {
    try {
      const abs = resolveWghFile(request.url);
      const data = await fsp.readFile(abs);
      return new Response(data, {
        headers: {
          'Content-Type': contentTypeOf(abs),
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
        },
      });
    } catch {
      return new Response('not found', { status: 404 });
    }
  });
  registerImageIpc();
  void ensureDirs();
}

// 必须在 app ready 之前注册协议特权
protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

module.exports = {
  init,
  SCHEME,
  KINDS,
  getImagesDir,
  resolveWghFile,
  readImageBuffer,
  saveImageFromDataUrl,
};
