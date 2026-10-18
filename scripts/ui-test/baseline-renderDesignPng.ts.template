/**
 * 把贴图设计（背景 + 文字图层）真实渲染成 PNG。
 * 支持纯色 / linear-gradient / url(图片) 背景。
 */
import { isWghUrl, readImage } from './imageStore';

export interface RenderLayer {
  text: string;
  x: number; // %
  y: number; // %
  size: number;
  color: string;
  bold: boolean;
}

export interface RenderDesign {
  width: number;
  height: number;
  bg: string;
  layers: RenderLayer[];
}

const FONT_FAMILY = `-apple-system,'PingFang SC','Microsoft YaHei',sans-serif`;

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  const chars = Array.from(text);
  let line = '';
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function parseAngle(token: string): number {
  const deg = token.match(/([\d.]+)deg/);
  const rad = deg ? (Number(deg[1]) * Math.PI) / 180 : 0;
  return rad;
}

async function paintBackground(
  ctx: CanvasRenderingContext2D,
  bg: string,
  w: number,
  h: number,
): Promise<void> {
  if (bg.startsWith('url(')) {
    const rawUrl = bg.slice(4, -1).replace(/["']/g, '');
    const url = isWghUrl(rawUrl) ? await readImage(rawUrl) : rawUrl;
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      /* 图片加载失败时保留白底 */
    }
    const scale = Math.max(w / Math.max(img.width || 1, 1), h / Math.max(img.height || 1, 1));
    const dw = (img.width || w) * scale;
    const dh = (img.height || h) * scale;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    return;
  }

  const grad = bg.match(/linear-gradient\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\)/s);
  if (grad) {
    const rad = parseAngle(grad[1].trim());
    const dx = Math.sin(rad);
    const dy = -Math.cos(rad);
    const len = Math.hypot(w, h) / 2;
    const cx = w / 2;
    const cy = h / 2;
    const g = ctx.createLinearGradient(cx - dx * len, cy - dy * len, cx + dx * len, cy + dy * len);
    g.addColorStop(0, grad[2].trim());
    g.addColorStop(1, grad[3].trim());
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    return;
  }

  ctx.fillStyle = bg || '#ffffff';
  ctx.fillRect(0, 0, w, h);
}

export async function renderDesignPng(d: RenderDesign): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = d.width;
  canvas.height = d.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前环境不支持 Canvas 渲染');

  await paintBackground(ctx, d.bg, d.width, d.height);

  for (const layer of d.layers) {
    ctx.fillStyle = layer.color;
    ctx.font = `${layer.bold ? 700 : 400} ${layer.size}px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = wrapText(ctx, layer.text, d.width * 0.86);
    const lh = layer.size * 1.35;
    const startY = (d.height * layer.y) / 100 - ((lines.length - 1) * lh) / 2;
    lines.forEach((line, i) => {
      ctx.fillText(line, (d.width * layer.x) / 100, startY + i * lh);
    });
  }

  return canvas.toDataURL('image/png');
}
