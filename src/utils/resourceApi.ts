import {
  listAssets,
  nowIso,
  saveAsset,
  uid,
} from '../data/localStore';
import { saveImage } from './imageStore';

const RESOURCE_API = 'http://159.75.139.210:8010';

export interface ResourceArticle {
  id: number;
  title: string;
  category?: string;
  platform?: string;
  source_type?: string;
  summary?: string;
  content_text?: string;
  content_html?: string;
  images?: string[];
  published_at?: string;
  fetched_at?: string;
  stable_url?: string;
  url?: string;
}

export interface ResourceImageItem {
  id: number;
  url: string;
  title?: string;
  platform?: string;
  source_type?: string;
  tags: string[];
  created_at?: string;
  ai_tagged?: number;
}

export interface ImageTagItem {
  tag: string;
  count: number;
}

export interface ImageStats {
  total: number;
  tagged: number;
  untagged: number;
}

interface ApiEnvelope<T> {
  code: number;
  data: T;
  meta?: { total: number; page: number; page_size: number };
}

export function resourceBase(): string {
  return RESOURCE_API;
}

async function apiGet<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<ApiEnvelope<T>> {
  const url = new URL(resourceBase() + path);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    }
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url.toString(), { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as ApiEnvelope<T>;
  } finally {
    clearTimeout(timer);
  }
}

export function fetchArticles(params: {
  category?: string;
  platform?: string;
  source_type?: string;
  classified?: boolean;
  after?: string;
  q?: string;
  page?: number;
  page_size?: number;
}) {
  return apiGet<ResourceArticle[]>('/api/articles', params);
}

export function fetchCategories() {
  return apiGet<Array<{ category: string; count: number }>>('/api/categories');
}

export function fetchImages(params: {
  tag?: string;
  q?: string;
  ai_tagged?: boolean;
  page?: number;
  page_size?: number;
}) {
  return apiGet<ResourceImageItem[]>('/api/images', params);
}

export function fetchImageTags(aiTagged = true) {
  return apiGet<ImageTagItem[]>('/api/image-tags', { ai_tagged: aiTagged });
}

export function fetchImageStats() {
  return apiGet<ImageStats>('/api/image-stats');
}

export function compressImageDataUrl(
  dataUrl: string,
  maxSide = 1280,
  quality = 0.85,
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function saveImageToLibrary(
  image: ResourceImageItem,
): Promise<{ ok: boolean; duplicate?: boolean; error?: string }> {
  const existing = listAssets().find((a) => a.sourceUrl === image.url);
  if (existing) return { ok: true, duplicate: true };

  let dataUrl = '';
  if (window.wangaohui?.downloadImage) {
    const r = await window.wangaohui.downloadImage({ url: image.url });
    if (!r.ok || !r.dataUrl) return { ok: false, error: r.error || '图片下载失败' };
    dataUrl = r.dataUrl;
  } else {
    try {
      const res = await fetch(image.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('读取图片失败'));
        reader.readAsDataURL(blob);
      });
    } catch {
      return { ok: false, error: '浏览器预览模式无法跨域下载，请在桌面应用中使用' };
    }
  }

  const compressed = await compressImageDataUrl(dataUrl);
  // 图片落盘：优先存到本地磁盘（wgh-image://），失败时退回 base64 避免丢失
  let stored = compressed;
  try {
    stored = await saveImage(compressed, 'library');
  } catch {
    /* 落盘失败保留原图 */
  }
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const name = `素材图-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate(),
  )}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  saveAsset({
    id: uid('asset'),
    kind: '图片',
    name: name.slice(0, 80),
    dataUrl: stored,
    sourceUrl: image.url,
    tags: (image.tags || []).slice(0, 10),
    createdAt: nowIso(),
  });
  return { ok: true };
}
