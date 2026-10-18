/**
 * 把首图模板 DOM 节点按比例渲染成高清 PNG。
 * 保留 CSS 装饰（卡片、集中线、波点、圆环、页码等），
 * 输出默认 900x1200（3:4），可直接作为贴图第一张主图。
 */
import { toPng } from 'html-to-image';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSize(node: HTMLElement, attempts = 12, step = 250): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    const w = node.offsetWidth;
    const h = node.offsetHeight;
    if (w > 0 && h > 0) return;
    await sleep(step);
  }
  const w = node.offsetWidth || 0;
  const h = node.offsetHeight || 0;
  throw new Error(`贴图渲染区域未就绪（尺寸 ${w}×${h}），请稍后重试`);
}

function hasContent(dataUrl: string): boolean {
  const m = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!m) return false;
  const payload = m[3] || '';
  if (!payload) return false;
  try {
    if (m[2]) return atob(payload).length > 0;
    return decodeURIComponent(payload).length > 0;
  } catch {
    return false;
  }
}

export async function renderCoverNodeToPng(
  node: HTMLElement,
  targetWidth = 900,
  targetHeight = 1200,
): Promise<string> {
  // 应用刚启动时隐藏渲染区可能还没完成布局（offsetWidth/Height 为 0），
  // 等待字体与尺寸就绪，避免 html-to-image 生成 0×0 空图。
  try {
    await document.fonts.ready;
  } catch {
    /* ignore */
  }
  await waitForSize(node);
  // 用节点实际尺寸计算放大倍率：html-to-image 会把 SVG 按原尺寸放进画布，
  // 直接传 width/height 会导致内容不缩放、只占画布左上角一小块。
  const w = node.offsetWidth || 168;
  const h = node.offsetHeight || 224;
  const pixelRatio = Math.max(targetWidth / w, targetHeight / h);
  const dataUrl = await toPng(node, {
    pixelRatio,
    cacheBust: true,
    backgroundColor: 'transparent',
  });
  if (!hasContent(dataUrl)) {
    throw new Error('贴图渲染结果为空，请重试');
  }
  return dataUrl;
}
