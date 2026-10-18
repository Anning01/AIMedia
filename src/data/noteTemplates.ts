export interface ProductTemplate {
  id: string;
  name: string;
  desc: string;
  bg: {
    type: 'linear' | 'radial';
    colors: string[];
    angle?: number;
  };
  decoration: 'dots' | 'arc' | 'rings' | 'grid' | 'none';
  productArea: { x: number; y: number; w: number; h: number };
  title?: {
    text: string;
    x: number;
    y: number;
    size: number;
    color: string;
    align?: 'left' | 'center' | 'right';
  };
  subtitle?: {
    text: string;
    x: number;
    y: number;
    size: number;
    color: string;
    align?: 'left' | 'center' | 'right';
  };
}

export const NOTE_TEMPLATES: ProductTemplate[] = [
  {
    id: 'ins-clean',
    name: 'INS 简约',
    desc: '米白底 + 居中大标题，干净高级',
    bg: { type: 'linear', colors: ['#faf8f4', '#f2ede4'], angle: 135 },
    decoration: 'dots',
    productArea: { x: 0.14, y: 0.3, w: 0.72, h: 0.52 },
    title: { text: '{product}', x: 0.5, y: 0.16, size: 54, color: '#262626', align: 'center' },
    subtitle: { text: '{points}', x: 0.5, y: 0.23, size: 28, color: '#8c8578', align: 'center' },
  },
  {
    id: 'magazine',
    name: '杂志大片',
    desc: '深色底 + 大留白，产品右下聚焦',
    bg: { type: 'linear', colors: ['#1d1d1f', '#34343a'], angle: 160 },
    decoration: 'rings',
    productArea: { x: 0.18, y: 0.3, w: 0.6, h: 0.56 },
    title: { text: '{product}', x: 0.1, y: 0.14, size: 44, color: '#f5f5f0', align: 'left' },
    subtitle: { text: '{points}', x: 0.1, y: 0.2, size: 24, color: '#b8b8b0', align: 'left' },
  },
  {
    id: 'vivid-gradient',
    name: '活力渐变',
    desc: '橙粉渐变 + 圆形光斑，年轻有活力',
    bg: { type: 'linear', colors: ['#ff9a8b', '#ff6a88', '#ff99ac'], angle: 45 },
    decoration: 'arc',
    productArea: { x: 0.12, y: 0.32, w: 0.76, h: 0.5 },
    title: { text: '{product}', x: 0.5, y: 0.15, size: 50, color: '#ffffff', align: 'center' },
    subtitle: { text: '{points}', x: 0.5, y: 0.22, size: 26, color: '#fff3ee', align: 'center' },
  },
  {
    id: 'fresh-green',
    name: '清新绿意',
    desc: '浅绿渐变 + 柔和弧线，自然清爽',
    bg: { type: 'linear', colors: ['#e8f5e9', '#c8e6c9', '#a5d6a7'], angle: 180 },
    decoration: 'arc',
    productArea: { x: 0.14, y: 0.34, w: 0.7, h: 0.48 },
    title: { text: '{product}', x: 0.12, y: 0.15, size: 46, color: '#2e5d34', align: 'left' },
    subtitle: { text: '{points}', x: 0.12, y: 0.21, size: 24, color: '#55805c', align: 'left' },
  },
  {
    id: 'gray-minimal',
    name: '高级灰调',
    desc: '灰白 + 几何细线，克制商务感',
    bg: { type: 'linear', colors: ['#f4f4f5', '#e4e4e7'], angle: 90 },
    decoration: 'grid',
    productArea: { x: 0.2, y: 0.3, w: 0.6, h: 0.52 },
    title: { text: '{product}', x: 0.5, y: 0.14, size: 44, color: '#18181b', align: 'center' },
    subtitle: { text: '{points}', x: 0.5, y: 0.2, size: 22, color: '#71717a', align: 'center' },
  },
  {
    id: 'cream-warm',
    name: '暖调奶油',
    desc: '奶油渐变 + 圆点装饰，温馨治愈',
    bg: { type: 'radial', colors: ['#fff8f0', '#f6e3cf', '#efd5b6'] },
    decoration: 'dots',
    productArea: { x: 0.12, y: 0.35, w: 0.76, h: 0.5 },
    title: { text: '{product}', x: 0.5, y: 0.16, size: 48, color: '#6b4f3a', align: 'center' },
    subtitle: { text: '{points}', x: 0.5, y: 0.23, size: 24, color: '#a08060', align: 'center' },
  },
];

export function fillTemplateText(
  tpl: ProductTemplate,
  vars: { product: string; points: string; price: number },
): ProductTemplate {
  const fill = (s?: string) =>
    (s || '')
      .replace(/\{product\}/g, vars.product)
      .replace(/\{points\}/g, vars.points.slice(0, 20))
      .replace(/\{price\}/g, vars.price ? `¥${vars.price}` : '');
  return {
    ...tpl,
    title: tpl.title ? { ...tpl.title, text: fill(tpl.title.text) } : undefined,
    subtitle: tpl.subtitle ? { ...tpl.subtitle, text: fill(tpl.subtitle.text) } : undefined,
  };
}
