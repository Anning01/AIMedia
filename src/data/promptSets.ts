/**
 * 提示词多套管理：
 * - 一套 = 备注名 + 文章大纲(system/user) + 贴图(system/user)
 * - 创作工坊选择套件生成；自动托管任务选择套件
 * - 不绑定账号，一个套件可用于任意账号
 * - 「默认」套件保留，首次使用时自动迁移旧的全局提示词
 */

export interface PromptSet {
  id: string;
  name: string;
  outlineSystem: string;
  outlineUser: string;
  stickerSystem: string;
  stickerUser: string;
  createdAt: string;
}

export const PROMPT_SET_KEY = 'wangaohui:promptSets';
export const LAST_PROMPT_SET_KEY = 'wangaohui:lastPromptSet';

const LEGACY_OUTLINE_KEY = 'wangaohui:outlinePrompt';
const LEGACY_STICKER_KEY = 'wangaohui:stickerPromptV2';

export const LEGACY_DEFAULT_OUTLINE_SYSTEM =
  '你是资深公众号爆款文章策划，根据用户输入的内容，提取有用的信息，去掉无关的广告、清洗不干净遗留信息。需要生成爆款标题：如果用户输入中已有标题，必须在用户原标题基础上优化改写，不要另起无关的新标题。严格按给定格式输出文章大纲，只输出大纲本身，不要输出任何额外说明或解释。';

export const DEFAULT_OUTLINE_SYSTEM =
  '你是资深公众号爆款文章策划，深耕自媒体图文流量逻辑。\n' +
  '1.信息清洗：基于用户输入原文，提取核心事实、案例、人物、观点；剔除广告、乱码、译文残留碎片、无效冗余文本，不篡改原文事实与核心立意。\n' +
  '2.标题产出：脱离原文标题限制，原创3组差异化公众号爆款标题；爆款标准：包含冲突/情绪/疑问/痛点，贴合目标读者共情，规避AI腔，拒绝空洞华丽套话，适配公众号信息流点击率。\n' +
  '3.文风约束：全程去AI化，拒绝模板化排比、空洞金句、虚浮书面表达；贴合普通人阅读语感，观点落地，少空泛说教。\n' +
  '4.大纲输出：输出结构化完整文章大纲，划分开篇、主体分论点、案例应用、矛盾探讨、结尾升华、评论区引导模块；每个模块标注核心内容要点，只写大纲，不要完整正文。\n' +
  '5.输出约束：仅输出标题+大纲本体，禁止额外解释、说明、对话、备注。';

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

export const DEFAULT_STICKER_SYSTEM =
  '你是资深公众号贴图内容策划。根据输入的内容，提取关键信息，去掉无关的广告、清洗不干净遗留信息，生成一条公众号贴图内容，文字将逐段渲染成多张图片卡片。输出要求：第一行是贴图标题（一句有吸引力的短句，不超过25个字）；接着是正文描述（口语化、有画面感，按段落输出，每段60~100字左右，段落之间用空行分隔，每段适合单独做成一张卡片，允许用简短的小标题段引领）；不要任何 Markdown 标记、列表符号或格式符号；再单独输出一行「发布描述：」开头的内容，用一两句话简要概括图片内容并引导读者点赞、评论、互动，不要与正文重复；最后另起一行生成3到5个合适的话题，每个话题以 # 开头、用空格分隔。只输出标题、正文、发布描述和话题，不要任何额外说明。';

export const DEFAULT_STICKER_USER = `贴图主题：{topic}
字数限制：全文（含标题和话题）不超过 {words} 字`;

export function makeDefaultSet(overrides: Partial<PromptSet> = {}): PromptSet {
  return {
    id: 'default',
    name: '默认',
    outlineSystem: DEFAULT_OUTLINE_SYSTEM,
    outlineUser: DEFAULT_OUTLINE_USER,
    stickerSystem: DEFAULT_STICKER_SYSTEM,
    stickerUser: DEFAULT_STICKER_USER,
    createdAt: '',
    ...overrides,
  };
}

function readLegacy(key: string): Record<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

export function loadPromptSets(): PromptSet[] {
  try {
    const raw = JSON.parse(localStorage.getItem(PROMPT_SET_KEY) || '[]');
    if (Array.isArray(raw) && raw.length) {
      // 默认提示词升级：仅当默认套件的 outlineSystem 还是旧默认值时自动跟随，避免覆盖用户自定义
      let changed = false;
      const list = raw as PromptSet[];
      for (const s of list) {
        if (s.id === 'default' && s.outlineSystem === LEGACY_DEFAULT_OUTLINE_SYSTEM) {
          s.outlineSystem = DEFAULT_OUTLINE_SYSTEM;
          changed = true;
        }
      }
      if (changed) {
        try {
          localStorage.setItem(PROMPT_SET_KEY, JSON.stringify(list));
        } catch {
          /* ignore */
        }
      }
      return list;
    }
  } catch {
    /* 重新初始化 */
  }
  // 首次使用：把旧的全局提示词迁移到「默认」套件
  const legacyOutline = readLegacy(LEGACY_OUTLINE_KEY);
  const legacySticker = readLegacy(LEGACY_STICKER_KEY);
  const def = makeDefaultSet({
    outlineSystem: legacyOutline.system || DEFAULT_OUTLINE_SYSTEM,
    outlineUser: legacyOutline.user || DEFAULT_OUTLINE_USER,
    stickerSystem: legacySticker.system || DEFAULT_STICKER_SYSTEM,
    stickerUser: legacySticker.user || DEFAULT_STICKER_USER,
  });
  const list = [def];
  try {
    localStorage.setItem(PROMPT_SET_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  return list;
}

export function savePromptSets(list: PromptSet[]): void {
  localStorage.setItem(PROMPT_SET_KEY, JSON.stringify(list));
}

export function getPromptSet(id?: string): PromptSet {
  const list = loadPromptSets();
  return list.find((s) => s.id === id) || list[0];
}

export function isDefaultPromptSet(s: PromptSet): boolean {
  return (
    s.id === 'default' &&
    s.outlineSystem === DEFAULT_OUTLINE_SYSTEM &&
    s.outlineUser === DEFAULT_OUTLINE_USER &&
    s.stickerSystem === DEFAULT_STICKER_SYSTEM &&
    s.stickerUser === DEFAULT_STICKER_USER
  );
}

export function loadLastPromptSetId(): string {
  try {
    return localStorage.getItem(LAST_PROMPT_SET_KEY) || '';
  } catch {
    return '';
  }
}

export function saveLastPromptSetId(id: string): void {
  try {
    localStorage.setItem(LAST_PROMPT_SET_KEY, id);
  } catch {
    /* ignore */
  }
}
