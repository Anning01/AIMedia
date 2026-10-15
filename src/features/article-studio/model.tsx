import {
BarsOutlined,
FileTextOutlined,
LayoutOutlined,
} from "@/components/shared/icons";

export const ACCENT_PRESETS = [
  "#2F54EB",
  "#FF2442",
  "#13C2C2",
  "#722ED1",
  "#FF7A45",
  "#EB2F96",
  "#F5A623",
  "#4A7C59",
  "#B03A2E",
  "#1F2430",
];

export const FLOW_STEPS = [
  { key: "outline", label: "结构提取", icon: <BarsOutlined /> },
  { key: "article", label: "文章", icon: <FileTextOutlined /> },
  { key: "layout", label: "排版", icon: <LayoutOutlined /> },
] as const;

export const HISTORY_STATUS_COLOR: Record<string, string> = {
  待发布: "default",
  已发布: "green",
  已存草稿: "blue",
  发布失败: "red",
};

export const BLOCK_LABELS: Record<string, string> = {
  title: "主标题",
  subtitle: "副标题",
  h2: "小标题",
  p: "正文",
  quote: "金句/引用",
  card: "重点卡片",
  divider: "分割线",
  cta: "引导按钮",
  list: "清单",
  infoGrid: "信息卡",
  badges: "标签组",
  tip: "提示",
  image: "配图",
  follow: "关注引导",
};

export const LAYOUT_LABELS: Record<string, string> = {
  flow: "流式排版",
  cards: "分段卡片",
  steps: "步骤编号",
  journal: "杂志首字下沉",
  banner: "顶部横幅",
  timeline: "时间线",
  faq: "问答卡",
  toc: "目录式",
};

export const DEFAULT_OUTLINE_SYSTEM =
  "你是资深公众号爆款文章策划，深耕自媒体图文流量逻辑。\n" +
  "1.信息清洗：基于用户输入原文，提取核心事实、案例、人物、观点；剔除广告、乱码、译文残留碎片、无效冗余文本，不篡改原文事实与核心立意。\n" +
  "2.标题产出：脱离原文标题限制，原创3组差异化公众号爆款标题；爆款标准：包含冲突/情绪/疑问/痛点，贴合目标读者共情，规避AI腔，拒绝空洞华丽套话，适配公众号信息流点击率。\n" +
  "3.文风约束：全程去AI化，拒绝模板化排比、空洞金句、虚浮书面表达；贴合普通人阅读语感，观点落地，少空泛说教。\n" +
  "4.大纲输出：输出结构化完整文章大纲，划分开篇、主体分论点、案例应用、矛盾探讨、结尾升华、评论区引导模块；每个模块标注核心内容要点，只写大纲，不要完整正文。\n" +
  "5.输出约束：仅输出标题+大纲本体，禁止额外解释、说明、对话、备注。";

export const DEFAULT_OUTLINE_USER = `文章主题/素材：
{topic}

目标字数：{words}

{templateNote}

{tagNote}

请按以下格式输出大纲：
**文章主标题：<在这里写优化后的爆款标题>**
金句：一句话金句
框架：
避雷/要点一：xxx
要点二：xxx
要点三：xxx
核心：一句话核心观点
小段标题：
1.xxx
2.xxx
3.xxx
配图：
1.xxx
2.xxx
3.xxx`;

export type BlockType =
  | "title"
  | "subtitle"
  | "h2"
  | "p"
  | "quote"
  | "card"
  | "divider"
  | "cta"
  | "list"
  | "infoGrid"
  | "badges"
  | "tip"
  | "image"
  | "follow";

export interface Block {
  id: string;
  type: BlockType;
  text?: string;
  items?: string[];
  src?: string;
  cover?: boolean;
  card?: boolean;
}

export function isStickerHeading(text: string): boolean {
  const s = text.trim();
  return s.length > 0 && s.length <= 22 && !/[。！？；：…]$/.test(s);
}

export function buildStickerCards(
  lines: string[],
): Array<{ heading: string; text: string }> {
  const cards: Array<{ heading: string; text: string }> = [];
  for (let i = 0; i < lines.length; i += 1) {
    const cur = lines[i].trim();
    if (!cur) continue;
    if (isStickerHeading(cur)) {
      const nxt = i + 1 < lines.length ? lines[i + 1].trim() : "";
      if (nxt && !isStickerHeading(nxt)) {
        cards.push({ heading: cur, text: nxt });
        i += 1;
      } else {
        cards.push({ heading: cur, text: "" });
      }
    } else {
      cards.push({ heading: "", text: cur });
    }
  }
  return cards;
}

export const TOOLBAR: {
  label: string;
  type: BlockType;
  sample?: string;
  items?: string[];
}[] = [
  { label: "标题", type: "title", sample: "这里是一级标题" },
  { label: "小标题", type: "h2", sample: "小标题：一句话概括本节重点" },
  {
    label: "正文",
    type: "p",
    sample:
      "这里是一段正文内容，支持直接修改文案。好的正文要有画面感，让读者在读的时候能代入自己的场景。",
  },
  {
    label: "引用",
    type: "quote",
    sample: "金句引用：你不需要很厉害才能开始，但你需要开始才能很厉害。",
  },
  {
    label: "卡片",
    type: "card",
    sample: "重点卡片：记住三个关键词——方法、节奏、坚持。",
  },
  {
    label: "清单",
    type: "list",
    items: [
      "第一点：先做什么，再做什么",
      "第二点：容易踩的坑和避坑方法",
      "第三点：今天就行动的最小一步",
    ],
  },
  {
    label: "提示",
    type: "tip",
    sample: "重点提示：这里是需要读者特别留意的信息。",
  },
  {
    label: "信息卡",
    type: "infoGrid",
    items: ["适合人群", "职场新人", "学习周期", "4 周", "核心能力", "目标拆解"],
  },
  {
    label: "标签组",
    type: "badges",
    items: ["效率工具", "AI 写作", "公众号运营"],
  },
  { label: "图片", type: "image", sample: "图片说明（替换为你的图片）" },
  {
    label: "引导关注",
    type: "follow",
    sample: "喜欢本文，记得点赞、在看，关注不迷路",
  },
  { label: "分割线", type: "divider" },
];

export const VARIANT_OPTIONS: Record<
  string,
  { label: string; value: string }[]
> = {
  layout: [
    { label: "流式（默认）", value: "flow" },
    { label: "分段卡片", value: "cards" },
    { label: "步骤编号", value: "steps" },
    { label: "杂志首字下沉", value: "journal" },
    { label: "顶部横幅", value: "banner" },
    { label: "时间线", value: "timeline" },
    { label: "问答卡", value: "faq" },
    { label: "目录式", value: "toc" },
  ],
  title: [
    { label: "左侧竖条", value: "bar-left" },
    { label: "居中装饰线", value: "center-deco" },
    { label: "色块徽标", value: "badge" },
    { label: "底部下划线", value: "underline" },
  ],
  h2: [
    { label: "编号", value: "number" },
    { label: "左侧竖条", value: "bar-left" },
    { label: "胶囊底色", value: "pill" },
    { label: "居中圆点", value: "center-dot" },
    { label: "底部下划线", value: "underline" },
  ],
  quote: [
    { label: "左侧竖条", value: "left-bar" },
    { label: "大引号", value: "big-quote" },
    { label: "气泡卡片", value: "bubble" },
    { label: "边框括号", value: "bracket" },
  ],
  card: [
    { label: "扁平", value: "flat" },
    { label: "左侧边条", value: "side-bar" },
    { label: "顶部边条", value: "top-bar" },
    { label: "虚线边框", value: "dashed" },
    { label: "玻璃质感", value: "glass" },
  ],
  divider: [
    { label: "圆点", value: "dot" },
    { label: "细线", value: "line" },
    { label: "虚线", value: "dashed" },
    { label: "渐变", value: "gradient" },
    { label: "星标", value: "icon" },
  ],
  ctaStyle: [
    { label: "渐变", value: "gradient" },
    { label: "胶囊", value: "pill" },
    { label: "深色", value: "dark" },
    { label: "描边", value: "outline" },
  ],
  list: [
    { label: "圆点", value: "dot" },
    { label: "数字", value: "number" },
    { label: "对勾", value: "check" },
  ],
};

export type VariantKey =
  | "layout"
  | "title"
  | "h2"
  | "quote"
  | "card"
  | "divider"
  | "ctaStyle"
  | "list";

export const VARIANT_KEYS: VariantKey[] = [
  "layout",
  "title",
  "h2",
  "quote",
  "card",
  "divider",
  "ctaStyle",
  "list",
];

export let parseUid = 500;

export function parseArticle(text: string): Block[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const blocks: Block[] = [];
  let hasTitle = false;
  let hasSubtitle = false;
  const ctaPattern = /(在看|点赞|关注|转发|收藏)/;
  const flushList = (items: string[]) => {
    if (items.length > 0)
      blocks.push({ id: `b${parseUid++}`, type: "list", items });
  };
  let listItems: string[] = [];
  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s*/);
    if (heading) {
      flushList(listItems);
      listItems = [];
      const isTitle = heading[1].length === 1 && !hasTitle;
      blocks.push({
        id: `b${parseUid++}`,
        type: isTitle ? "title" : "h2",
        text: line.slice(heading[0].length),
      });
      if (isTitle) hasTitle = true;
    } else if (/^>\s?/.test(line)) {
      flushList(listItems);
      listItems = [];
      blocks.push({
        id: `b${parseUid++}`,
        type: "quote",
        text: line.replace(/^>\s?/, ""),
      });
    } else if (/^!\[([^\]]*)\]\([^)]*\)/.test(line)) {
      flushList(listItems);
      listItems = [];
      const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
      blocks.push({
        id: `b${parseUid++}`,
        type: "image",
        text: imgMatch?.[1] || "图片",
        src: imgMatch?.[2] || undefined,
      });
    } else if (/^[-*•]\s+/.test(line)) {
      listItems.push(line.replace(/^[-*•]\s+/, ""));
    } else if (/^---+$/.test(line)) {
      flushList(listItems);
      listItems = [];
      blocks.push({ id: `b${parseUid++}`, type: "divider" });
    } else if (line.length <= 40 && ctaPattern.test(line)) {
      flushList(listItems);
      listItems = [];
      blocks.push({ id: `b${parseUid++}`, type: "cta", text: line });
    } else if (!hasTitle && line.length <= 30 && !/[。！？!?]$/.test(line)) {
      flushList(listItems);
      listItems = [];
      blocks.push({ id: `b${parseUid++}`, type: "title", text: line });
      hasTitle = true;
    } else if (
      hasTitle &&
      !hasSubtitle &&
      blocks.length === 1 &&
      line.length <= 24 &&
      !/[。！？!?]$/.test(line)
    ) {
      flushList(listItems);
      listItems = [];
      blocks.push({ id: `b${parseUid++}`, type: "subtitle", text: line });
      hasSubtitle = true;
    } else if (
      hasTitle &&
      hasSubtitle &&
      line.length <= 30 &&
      !/[。！？!?]$/.test(line)
    ) {
      flushList(listItems);
      listItems = [];
      blocks.push({ id: `b${parseUid++}`, type: "h2", text: line });
    } else {
      flushList(listItems);
      listItems = [];
      blocks.push({ id: `b${parseUid++}`, type: "p", text: line });
    }
  }
  flushList(listItems);
  return blocks;
}

export function normalizeTitleText(s: string): string {
  let t = String(s || "").trim();
  t = t
    .replace(/^\s*[*#>]+\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/^>+\s?/, "")
    .trim();
  t = t.replace(/^(?:文章主标题|主标题|标题)\s*[：:]\s*/, "").trim();
  return t;
}

export function cleanStickerText(s: string): string {
  return String(s || "")
    .replace(/\*\*/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*•]\s+/gm, "")
    .replace(/`/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n\n");
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function isTitleDuplicate(text: string, title: string): boolean {
  const t = normalizeTitleText(text || "");
  const tt = normalizeTitleText(title || "");
  if (!t || !tt) return false;
  if (t === tt) return true;
  return t.startsWith(tt) && t.length - tt.length <= 20;
}

export function promoteFirstTitle(blocks: Block[]): Block[] {
  const idx = blocks.findIndex((b) => b.type === "p");
  if (idx < 0) return blocks;
  const first = normalizeTitleText(blocks[idx].text || "");
  if (!first || first.length > 60 || /[。！？!?]$/.test(first)) return blocks;
  const tIdx = blocks.findIndex((b) => b.type === "title");
  const cur = tIdx >= 0 ? normalizeTitleText(blocks[tIdx].text || "") : "";
  const useAsTitle = first !== cur;
  let next: Block[] = blocks;
  if (useAsTitle) {
    const titleBlock: Block =
      tIdx >= 0
        ? { ...blocks[tIdx], text: first }
        : { id: `b${uid++}`, type: "title", text: first };
    next =
      tIdx >= 0
        ? blocks.map((b, i) => (i === tIdx ? titleBlock : b))
        : [titleBlock, ...blocks];
  }
  const tt = useAsTitle ? first : cur;
  return tt
    ? next.filter(
        (b) => b.type === "title" || !isTitleDuplicate(b.text || "", tt),
      )
    : next;
}

export function cleanLabelPrefix(s: string): string {
  return String(s || "")
    .replace(/^\s*[*#>]+\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/^>+\s?/, "")
    .replace(/^(?:文章主标题|主标题|标题)\s*[：:]\s*/, "")
    .trim();
}

export let uid = 100;

export function buildLayoutGroups(
  blocks: Block[],
  layout: string,
): { lead: Block[]; groups: Block[][] } {
  if (layout !== "cards") return { lead: blocks, groups: [] };
  const lead: Block[] = [];
  const groups: Block[][] = [];
  let current: Block[] = [];
  let seenH2 = false;
  for (const b of blocks) {
    if (b.type === "h2") {
      if (seenH2 && current.length) {
        groups.push(current);
        current = [];
      }
      seenH2 = true;
      current.push(b);
    } else if (seenH2) {
      current.push(b);
    } else {
      lead.push(b);
    }
  }
  if (current.length) groups.push(current);
  return { lead, groups };
}

export function nextBlockUid() {
  return uid++;
}
export function nextParseUid() {
  return parseUid++;
}
