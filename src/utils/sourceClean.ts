/**
 * 生成前清洗源文本中的网页残留噪音：
 * - 孤立 JS 布尔值（false/true）紧贴 [【（( 的情况，如 "false[日语听力]..."）
 * - 翻译/学习类标注 "句意："
 * - 多余空行
 */
export function sanitizeSourceText(text: string): string {
  return String(text || '')
    .replace(/\b(?:true|false)\b(?=\s*[\[【（(])/gi, '')
    .replace(/句意\s*[：:]\s*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const PROMPT_PATTERNS: RegExp[] = [
  /你是[^，。\n]{0,30}(?:资深|专业|行业|策划|博主|运营|编辑|从业者)/,
  /请扮演|扮演/,
  /只输出(?:文章|大纲|标题|内容|贴图|卡片)/,
  /输出格式|输出要求|严格遵守|严格按(?:照|照)?/,
  /不要(?:输出|写|加)(?:任何)?(?:额外|多余|解释|说明|开场白)/,
  /字数限制|目标字数|IP人设|系统提示词|提示词/,
];

/** 判断输入是否更像“提示词/指令”，而不是文章素材或主题 */
export function looksLikePrompt(text: string): boolean {
  const s = String(text || '').trim();
  if (!s || s.length > 4000) return false;
  let hits = 0;
  for (const re of PROMPT_PATTERNS) {
    if (re.test(s)) hits += 1;
  }
  return hits >= 2;
}

/** 剥离大纲里的配图建议，只留标题/金句/框架/小段标题等正文结构 */
export function stripOutlineImages(text: string): string {
  const lines = String(text || '').split('\n');
  const out: string[] = [];
  let inImageSection = false;
  for (const line of lines) {
    const t = line.trim();
    if (/^\s*配图(?:建议)?\s*[：:]/.test(line)) {
      inImageSection = true;
      continue;
    }
    if (inImageSection) {
      if (!t) {
        inImageSection = false;
        out.push(line);
        continue;
      }
      if (/^[0-9一二三四五六七八九十]+[.、)）]\s*/.test(t) || /需上传至图库|理想画面/.test(line)) {
        continue;
      }
      inImageSection = false;
    }
    if (/^\s*理想画面\s*[：:]/.test(line) || /需上传至图库/.test(line)) continue;
    out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** 大纲里的模块标注标签（来自新大纲提示词的“每个模块标注核心内容要点”） */
const OUTLINE_MODULE_LABELS = [
  '主体分论点',
  '评论区引导',
  '案例应用',
  '结尾升华',
  '矛盾探讨',
  '核心收束',
  '行动号召',
  '小段标题',
  '观点',
  '对比',
  '关键',
  '落地',
  '场景',
  '开篇',
  '反思',
  '答案',
  '案例',
  '金句',
  '框架',
  '核心',
];

/**
 * 剥离大纲里的模块标签，只保留标签后的实际内容：
 * - "观点：智商150也答不出冷知识" → "智商150也答不出冷知识"
 * - "主体分论点："（孤立标签行）→ 删除该行
 */
export function stripOutlineModuleLabels(text: string): string {
  const lines = String(text || '').split('\n');
  const labels = OUTLINE_MODULE_LABELS.join('|');
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    const withContent = t.match(new RegExp(`^(${labels})\\s*[：:]\\s*(.+)$`));
    if (withContent) {
      out.push(line.replace(new RegExp(`^\\s*(${labels})\\s*[：:]\\s*`), ''));
      continue;
    }
    if (new RegExp(`^(${labels})\\s*[：:]\\s*$`).test(t)) continue;
    if (new RegExp(`^(${labels})$`).test(t)) continue;
    out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** 生成正文前对大纲做完整清洗：去配图建议 + 去模块标签 */
export function cleanOutlineForArticle(text: string): string {
  return stripOutlineModuleLabels(stripOutlineImages(text));
}
