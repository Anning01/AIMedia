import type { ProductTemplate } from '../data/noteTemplates';
import { isWghUrl, readImage } from './imageStore';

const FONT_FAMILY = `-apple-system,'PingFang SC','Microsoft YaHei',sans-serif`;
const W = 900;
const H = 1200;

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const ch of Array.from(text)) {
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

function paintBg(ctx: CanvasRenderingContext2D, tpl: ProductTemplate): void {
  const { bg } = tpl;
  if (bg.type === 'radial') {
    const g = ctx.createRadialGradient(W * 0.5, H * 0.42, 80, W * 0.5, H * 0.5, W * 0.75);
    bg.colors.forEach((c, i) => g.addColorStop(i / Math.max(bg.colors.length - 1, 1), c));
    ctx.fillStyle = g;
  } else {
    const angle = ((bg.angle || 135) * Math.PI) / 180;
    const dx = Math.sin(angle);
    const dy = -Math.cos(angle);
    const len = Math.hypot(W, H) / 2;
    const g = ctx.createLinearGradient(
      W / 2 - dx * len,
      H / 2 - dy * len,
      W / 2 + dx * len,
      H / 2 + dy * len,
    );
    bg.colors.forEach((c, i) => g.addColorStop(i / Math.max(bg.colors.length - 1, 1), c));
    ctx.fillStyle = g;
  }
  ctx.fillRect(0, 0, W, H);
}

function paintDecoration(ctx: CanvasRenderingContext2D, tpl: ProductTemplate): void {
  const kind = tpl.decoration;
  if (kind === 'none') return;
  ctx.save();
  if (kind === 'dots') {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 10; i += 1) {
      const x = (i * 137 + 55) % W;
      const y = (i * 97 + 40) % H;
      ctx.beginPath();
      ctx.arc(x, y, 6 + (i % 3) * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === 'arc') {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(W * 0.9, H * 0.12, 210, Math.PI * 0.5, Math.PI * 1.45);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(W * 0.08, H * 0.95, 160, Math.PI * 1.5, Math.PI * 2.35);
    ctx.stroke();
  } else if (kind === 'rings') {
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 2;
    for (let i = 1; i <= 3; i += 1) {
      ctx.beginPath();
      ctx.arc(W * 0.5, H * 0.42, 180 + i * 72, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (kind === 'grid') {
    ctx.strokeStyle = 'rgba(24,24,27,0.08)';
    ctx.lineWidth = 1;
    for (let x = 60; x < W; x += 120) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 60; y < H; y += 120) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const dataUrl = isWghUrl(src) ? await readImage(src) : src;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('产品图片加载失败'));
    img.src = dataUrl;
  });
}

function paintProduct(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  tpl: ProductTemplate,
): void {
  const area = tpl.productArea;
  const ax = W * area.x;
  const ay = H * area.y;
  const aw = W * area.w;
  const ah = H * area.h;
  const scale = Math.min(aw / Math.max(img.width || 1, 1), ah / Math.max(img.height || 1, 1));
  const dw = (img.width || 1) * scale;
  const dh = (img.height || 1) * scale;
  const dx = ax + (aw - dw) / 2;
  const dy = ay + (ah - dh) / 2;

  // 投影
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.22)';
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 18;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
  // 再画一层避免阴影叠加到产品上
  ctx.drawImage(img, dx, dy, dw, dh);
}

function paintTexts(ctx: CanvasRenderingContext2D, tpl: ProductTemplate): void {
  for (const layer of [tpl.title, tpl.subtitle]) {
    if (!layer || !layer.text) continue;
    ctx.fillStyle = layer.color;
    ctx.font = `600 ${layer.size}px ${FONT_FAMILY}`;
    ctx.textAlign = layer.align || 'center';
    ctx.textBaseline = 'middle';
    const maxWidth = W * 0.84;
    const lines = wrapText(ctx, layer.text, maxWidth);
    const lh = layer.size * 1.3;
    const anchorX = layer.x * W;
    const startY = layer.y * H - ((lines.length - 1) * lh) / 2;
    lines.forEach((line, i) => ctx.fillText(line, anchorX, startY + i * lh));
  }
}

export async function renderProductCard(
  tpl: ProductTemplate,
  productDataUrl: string,
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前环境不支持 Canvas 渲染');
  const img = await loadImage(productDataUrl);
  paintBg(ctx, tpl);
  paintDecoration(ctx, tpl);
  paintProduct(ctx, img, tpl);
  paintTexts(ctx, tpl);
  return canvas.toDataURL('image/png');
}

export async function renderComposeCard(
  backgroundDataUrl: string,
  productDataUrl: string,
  area?: { x: number; y: number; w: number; h: number },
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前环境不支持 Canvas 渲染');
  const bg = await loadImage(backgroundDataUrl);
  // 背景铺满 3:4 画布（居中裁切）
  const scale = Math.max(W / Math.max(bg.width || 1, 1), H / Math.max(bg.height || 1, 1));
  const dw = (bg.width || 1) * scale;
  const dh = (bg.height || 1) * scale;
  ctx.drawImage(bg, (W - dw) / 2, (H - dh) / 2, dw, dh);
  const prod = await loadImage(productDataUrl);
  const a = area || { x: 0.16, y: 0.3, w: 0.68, h: 0.5 };
  const ax = W * a.x;
  const ay = H * a.y;
  const aw = W * a.w;
  const ah = H * a.h;
  const pScale = Math.min(aw / Math.max(prod.width || 1, 1), ah / Math.max(prod.height || 1, 1));
  const pw = (prod.width || 1) * pScale;
  const ph = (prod.height || 1) * pScale;
  const px = ax + (aw - pw) / 2;
  const py = ay + (ah - ph) / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 20;
  ctx.drawImage(prod, px, py, pw, ph);
  ctx.restore();
  ctx.drawImage(prod, px, py, pw, ph);
  return canvas.toDataURL('image/png');
}
