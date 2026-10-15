export interface Tmpl {
  id: string;
  cat: string;
  name: string;
  bg: string;
  title: string;
  subtitle: string;
  textColor: string;
  accent: string;
}

export interface Layer {
  id: string;
  name: string;
  text: string;
  x: number;
  y: number;
  size: number;
  color: string;
  bold: boolean;
}

export const CATEGORIES = [
  { key: "cover", label: "公众号封面", w: 620, h: 264, ratio: "2.35:1" },
  { key: "card", label: "正文卡片", w: 560, h: 373, ratio: "1.5:1" },
  { key: "xhs", label: "小红书 3:4", w: 440, h: 587, ratio: "3:4" },
  { key: "long", label: "公众号长图", w: 400, h: 880, ratio: "1:2.2" },
];

export const TEMPLATES: Tmpl[] = [
  {
    id: "c1",
    cat: "cover",
    name: "商务渐变",
    bg: "linear-gradient(135deg,#2F54EB,#5B8FF9)",
    title: "秋冬养生指南",
    subtitle: "收藏这一篇就够了",
    textColor: "#ffffff",
    accent: "#ffffff",
  },
  {
    id: "c2",
    cat: "cover",
    name: "极简白",
    bg: "#f6f8ff",
    title: "轻断食的正确打开方式",
    subtitle: "营养师 3 个原则讲透",
    textColor: "#1F2430",
    accent: "#2F54EB",
  },
  {
    id: "c3",
    cat: "cover",
    name: "暖橙",
    bg: "linear-gradient(135deg,#FF7A45,#ffc069)",
    title: "秋天第一杯养生茶",
    subtitle: "办公室也能做",
    textColor: "#ffffff",
    accent: "#ffffff",
  },
  {
    id: "k1",
    cat: "card",
    name: "卖点卡片",
    bg: "#ffffff",
    title: "3 大核心卖点",
    subtitle: "0 糖 0 脂 · 冷热双泡 · 30 秒出杯",
    textColor: "#1F2430",
    accent: "#2F54EB",
  },
  {
    id: "k2",
    cat: "card",
    name: "知识卡片",
    bg: "linear-gradient(135deg,#f9f0ff,#ffffff)",
    title: "轻断食小知识",
    subtitle: "16+8 到底怎么吃",
    textColor: "#1F2430",
    accent: "#722ED1",
  },
  {
    id: "k3",
    cat: "card",
    name: "清单卡片",
    bg: "#fff8f0",
    title: "秋冬必囤清单",
    subtitle: "第 3 个真的好用",
    textColor: "#1F2430",
    accent: "#FF7A45",
  },
  {
    id: "x1",
    cat: "xhs",
    name: "种草封面",
    bg: "linear-gradient(160deg,#FF2442,#ff9eb0)",
    title: "通勤咖啡实测",
    subtitle: "0 糖 0 脂还能冷热双泡？",
    textColor: "#ffffff",
    accent: "#ffffff",
  },
  {
    id: "x2",
    cat: "xhs",
    name: "清单封面",
    bg: "#ffffff",
    title: "办公室好物 TOP5",
    subtitle: "打工人幸福感拉满",
    textColor: "#1F2430",
    accent: "#FF2442",
  },
  {
    id: "x3",
    cat: "xhs",
    name: "深色高级",
    bg: "#1F2430",
    title: "成分党看过来",
    subtitle: "0 糖 0 脂是怎么做到的",
    textColor: "#ffffff",
    accent: "#13C2C2",
  },
  {
    id: "l1",
    cat: "long",
    name: "教程长图",
    bg: "#f4f6fb",
    title: "新手轻断食教程",
    subtitle: "从 0 到 1 的 5 个步骤",
    textColor: "#1F2430",
    accent: "#2F54EB",
  },
  {
    id: "l2",
    cat: "long",
    name: "深色长图",
    bg: "#101623",
    title: "一周健康食谱",
    subtitle: "照着吃就行",
    textColor: "#ffffff",
    accent: "#5B8FF9",
  },
];

export const BG_PRESETS = [
  "linear-gradient(135deg,#2F54EB,#5B8FF9)",
  "linear-gradient(135deg,#FF2442,#ff9eb0)",
  "linear-gradient(135deg,#13C2C2,#36cfc9)",
  "linear-gradient(135deg,#722ED1,#9254de)",
  "linear-gradient(135deg,#FF7A45,#ffc069)",
  "#f4f6fb",
  "#1F2430",
  "#ffffff",
];

export const TEXT_COLORS = [
  "#1F2430",
  "#ffffff",
  "#2F54EB",
  "#FF2442",
  "#13C2C2",
  "#722ED1",
  "#FF7A45",
];

export const CAT_LABELS: Record<string, string> = {
  cover: "封面",
  card: "卡片",
  xhs: "小红书",
  long: "长图",
};

export let layerUid = 1;

export function buildLayers(t: Tmpl): Layer[] {
  return [
    {
      id: `l${layerUid++}`,
      name: "主标题",
      text: t.title,
      x: 50,
      y: 30,
      size: 26,
      color: t.textColor,
      bold: true,
    },
    {
      id: `l${layerUid++}`,
      name: "副标题",
      text: t.subtitle,
      x: 50,
      y: 52,
      size: 15,
      color: t.textColor,
      bold: false,
    },
    {
      id: `l${layerUid++}`,
      name: "引导语",
      text: "关注我，解锁更多干货",
      x: 50,
      y: 90,
      size: 12,
      color: t.accent,
      bold: false,
    },
  ];
}
