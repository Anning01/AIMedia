'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { chatUrl, requestChat } = require('./ai-client.cjs');

const REFERENCES_DIR = path.join(__dirname, 'references');
const DEFAULT_RULES = path.join(REFERENCES_DIR, 'humanizer-ja.md');
const DEFAULT_VIRAL_RULES = path.join(REFERENCES_DIR, 'viral-editor-ja.md');
const DEFAULT_ENGINE = path.join(REFERENCES_DIR, 'universal-viral-engine.md');

const DEFAULT_TONE = '自然、克制、有生活细节，适合公众号长文阅读';
const DEFAULT_AUDIENCE = '关注职场、关系和自我成长的成年读者';
const DEFAULT_MARKET = '中国微信公众号';

console.log(`[pipeline] mech-v2 loaded ${new Date().toISOString()}`);

const DEBUG_LOG = process.env.WANGHUI_DEBUG_LOG;
function dbg(msg) {
  if (DEBUG_LOG) {
    try {
      fs.appendFileSync(DEBUG_LOG, `${new Date().toISOString()} ${msg}\n`);
    } catch {
      /* ignore */
    }
  }
}

function loadEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v.length >= 2 && v[0] === v[v.length - 1] && (v[0] === '"' || v[0] === "'")) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

function readTextFile(file) {
  return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').trim();
}

function reportProgress(cfg, stage, message) {
  cfg.AI_SIGNAL?.throwIfAborted();
  cfg.AI_ON_PROGRESS?.({stage,message});
}
function outputMismatch(message) {
  return Object.assign(new Error(message+'，本次已停止，未自动重新生成；请核对使用记录。'),{code:'QILING_REVIEW',retryable:false});
}
function providerEnv(provider, cfg, overrides = {}) {
  if (cfg.AI_BASE_URL !== undefined) {
    return {
      service: cfg.AI_SERVICE,
      signal: cfg.AI_SIGNAL,
      requestId: cfg.AI_REQUEST_ID,
      maxTokens: cfg.QILING_MAX_TOKENS,
      modelLimit: cfg.QILING_MODEL_LIMIT,
      feeLimit: cfg.QILING_MAX_FEE,
      thinkingMode: cfg.QILING_THINKING_MODE,
      thinkingModes: cfg.QILING_THINKING_MODES,
      key: cfg.AI_API_KEY || '',
      url: cfg.AI_BASE_URL ? chatUrl(cfg.AI_BASE_URL, cfg.AI_API_PATH) : '',
      model: cfg.AI_MODEL || '',
      timeout: cfg.AI_TIMEOUT || 180,
    };
  }
  const deep = provider === 'deepseek';
  const key =
    overrides.apiKey ||
    (deep ? cfg.DEEPSEEK_API_KEY : cfg.MINIMAX_API_KEY) ||
    '';
  let url =
    overrides.baseUrl ||
    (deep ? cfg.DEEPSEEK_BASE_URL : cfg.MINIMAX_API_URL) ||
    (deep
      ? 'https://api.deepseek.com'
      : 'https://api.minimaxi.com/v1/text/chatcompletion_v2');
  if (deep && !/\/chat\/completions$/.test(url)) {
    url = url.replace(/\/+$/, '') + '/chat/completions';
  }
  const model =
    overrides.model ||
    (deep ? cfg.DEEPSEEK_MODEL : cfg.MINIMAX_MODEL) ||
    (deep ? 'deepseek-chat' : 'MiniMax-M3');
  const timeout = Number(deep ? cfg.DEEPSEEK_TIMEOUT : cfg.MINIMAX_TIMEOUT) || 180;
  return { key, url, model, timeout, signal:cfg.AI_SIGNAL };
}

async function callApi(messages, { temperature, env }) {
  dbg(`callApi model=${env.model} messages=${messages.length}`);
  return requestChat(messages, env, temperature);
}

function safeStr(value) {
  if (typeof value !== 'string') return value;
  return Buffer.from(value, 'utf8').toString('utf8');
}

function youdaoInput(q) {
  return q.length <= 20 ? q : q.slice(0, 10) + String(q.length) + q.slice(-10);
}

async function translateYoudao(text, cfg) {
  const appKey = cfg.YOUDAO_APP_KEY || '';
  const appSecret = cfg.YOUDAO_APP_SECRET || '';
  if (!appKey || !appSecret) {
    throw new Error('缺少有道翻译凭证（YOUDAO_APP_KEY / YOUDAO_APP_SECRET）');
  }
  const salt = crypto.randomUUID();
  const curtime = String(Math.floor(Date.now() / 1000));
  const input = youdaoInput(text);
  const sign = crypto
    .createHash('sha256')
    .update(appKey + input + salt + curtime + appSecret)
    .digest('hex');

  const body = new URLSearchParams({
    q: text,
    from: 'ja',
    to: 'zh-CHS',
    vocabId: '',
    appKey,
    salt,
    curtime,
    signType: 'v3',
    sign,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180000);
  let res;
  try {
    res = await fetch('https://openapi.youdao.com/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    throw new Error(`无法连接有道翻译: ${err.message}`);
  }
  clearTimeout(timer);
  const data = await res.json();
  if (data.errorCode !== '0') {
    throw new Error(`有道翻译失败: ${JSON.stringify(data)}`);
  }
  const translations = data.translation;
  if (!Array.isArray(translations) || translations.length === 0) {
    throw new Error('有道返回结果中没有 translation 字段');
  }
  return translations.join('\n').trim();
}

const STRICT_TRANSLATION_PROMPT = `你是一个日文到简体中文的机器翻译引擎，不是编辑、作者或内容优化工具。

任务：把输入的日文逐段翻译成简体中文。

严格要求：
1. 只翻译，不改写、不润色、不优化。
2. 不增加、不删除、不概括任何信息。
3. 保持原文的段落顺序、标题层级、重复、停顿和语气。
4. 不调整论证结构，不生成开头、总结、金句或过渡句。
5. 原文中不自然、含糊或重复的地方，也应尽量忠实保留，不能擅自修正。
6. 人称、时间、数字、专有名词和因果关系必须与原文一致。
7. 使用自然但克制的简体中文，只修复目标语言必需的语法，不进行文学化表达。
8. 不输出解释、注释、翻译说明或"译文如下"等文字。
9. 每个原文段落对应一个译文段落，不合并、不拆分。
10. 输出只能包含翻译后的中文正文。

在输出前自行检查：
- 是否新增了原文没有的信息；
- 是否删除了原文已有的信息；
- 是否改变了语气、立场或结构；
- 是否出现模板化公众号表达。
如有，恢复为忠实直译。`;

async function translateLlm(text, provider, cfg) {
  const env = providerEnv(provider, cfg);
  const translated = await callApi(
    [
      { role: 'system', content: STRICT_TRANSLATION_PROMPT },
      {
        role: 'user',
        content:
          '请严格按照系统要求翻译下面的日文。只输出简体中文正文。\n\n---日文开始---\n' +
          text +
          '\n---日文结束---',
      },
    ],
    { temperature: 0, provider, env },
  );
  return stripCodeFence(translated);
}

const GENERIC_ZH_TRANSLATION_PROMPT = `你是一个机器翻译引擎。
任务：把输入文本逐段翻译成简体中文，只做翻译。
严格规则：
1. 不改写、不润色、不优化、不省略、不补充任何内容。
2. 保留原文的段落顺序、标题层级、重复、停顿和语气。
3. 人名、时间、数字、专有名词和因果关系必须与原文一致。
4. 输出只能包含译文正文，不要任何解释、注记或“译文如下”之类的文字。`;

async function translateLlmAny(text, provider, cfg) {
  const env = providerEnv(provider, cfg);
  const translated = await callApi(
    [
      { role: 'system', content: GENERIC_ZH_TRANSLATION_PROMPT },
      {
        role: 'user',
        content:
          '请把下面文本逐段翻译成简体中文，忠实原意，不增删不改写。\n\n---原文开始---\n' +
          text +
          '\n---原文结束---',
      },
    ],
    { temperature: 0, provider, env },
  );
  return stripCodeFence(translated);
}

/** 粗略判断译文是否已经是中文（中文字符数不少于英文字母数） */
function looksChinese(text) {
  const s = String(text || '');
  const cjk = s.match(/[\u4e00-\u9fff]/g) || [];
  const ascii = s.match(/[A-Za-z0-9]/g) || [];
  return cjk.length > 0 && cjk.length >= ascii.length;
}

// 回译后的机械清理：确定性修复常见翻译错乱，不依赖模型
const CLEAN_RULES = [
  [/\b(?:true|false)\b(?=\s*[\[【（(])/gi, ''],
  [/句意\s*[：:]\s*/g, ''],
  [/翻译\s*[：:]\s*/g, ''],
  [/\[[^\]\n]{1,20}\]\s*[^。！？\n]{0,15}每日一句[：:]\s*/g, ''],
  [/一箇/g, '一个'],
  [/箇/g, '个'],
  [/処/g, '处'],
  [/地質/g, '地质'],
  [/題/g, '题'],
  [/覚/g, '觉'],
  [/異/g, '异'],
  [/裡/g, '里'],
  [/冰淋/g, '冰淇淋'],
  [/冰激淋/g, '冰淇淋'],
  [/犹予/g, '犹豫'],
  [/看完节点/g, '看完节目'],
  [/说真实故事/g, '说实话'],
  [/<s:\d+>/g, ''],
  [/<\/?[a-zA-Z][^>]{0,80}>/g, ''],
  [/&nbsp;|&amp;|&lt;|&gt;/g, ' '],
  [/\n?[^\n]*(?:本文|文章)[^\n]*?(?:参考|来源|源于|来源于)[^\n]*?(?:公众号|微信|文章|公号)[^\n]*\n?/g, '\n'],
  [/[，,、。；;]?\s*(?:具体的步骤在此省略|细节略|此处省略|不再赘述|具体步骤略|具体内容略)[。.！!；;]?/g, ''],
  [/\s*[*＊]+\s*$/gm, ''],
  [/当周当周/g, '当周'],
  [/作为作为/g, '作为'],
  [/都市都市/g, '都市'],
  [/然后然后/g, '然后'],
  [/但是但是/g, '但是'],
  [/\n{3,}/g, '\n\n'],
];

function cleanTranslatedText(text) {
  let out = String(text || '');
  let hits = 0;
  for (const [re, rep] of CLEAN_RULES) {
    out = out.replace(re, () => {
      hits += 1;
      return rep;
    });
  }
  if (hits > 0) console.log(`[pipeline] 机械修复 ${hits} 处`);
  return out.trim();
}

// 清理标题里的序号/编号残渣（如“，为什么又个1.”“标题1：”）
function cleanArticleTitle(text) {
  return String(text || '')
    .trim()
    .replace(/^\s*(?:标题|备选标题)?\s*\d+\s*[.、)）:：]\s*/, '')
    .replace(/[，,、。]?\s*(?:为什么|为何)\s*又\s*个?\s*\d+\s*[.、)）]?\s*$/, '')
    .replace(/[，,、。]?\s*(?:标题|备选标题)\s*\d+\s*$/, '')
    .replace(/\s*[*＊]+\s*$/, '')
    .trim();
}

// 翻译前占位符保护：专有名词与数字在机器翻译中不被改写，翻译后还原
function escapeRegExpChar(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function protectTerms(text, terms) {
  let out = String(text || '');
  // 先保护数字，再保护专有名词，避免占位符里的序号被二次替换
  const nums = [];
  out = out.replace(/\d+(?:\.\d+)?/g, (n) => {
    nums.push(n);
    return `{{N${nums.length - 1}}}`;
  });
  const words = [];
  (terms || []).forEach((t, i) => {
    const w = String(t || '').trim();
    if (!w || w.length < 2 || w.length > 12) return;
    const re = new RegExp(escapeRegExpChar(w), 'g');
    if (re.test(out)) {
      out = out.replace(re, `{{W${i}}}`);
      words.push(w);
    }
  });
  console.log(`[pipeline] 占位符保护: 词=${words.length} 数字=${nums.length}`);
  return { text: out, words, nums };
}

function restoreTerms(text, words, nums) {
  let out = String(text || '');
  (nums || []).forEach((n, i) => {
    out = out.split(`{{N${i}}}`).join(n);
  });
  (words || []).forEach((w, i) => {
    out = out.split(`{{W${i}}}`).join(w);
  });
  return out;
}

// 从内容骨架中解析“不可变事实清单”里的专有名词（人名/地名/账号名）
function parseFactTerms(brief) {
  const s = String(brief || '');
  const out = [];
  const m = s.match(/^\s*(?:人名|人物姓名|专有名词)\s*[：:]\s*(.+)$/m);
  if (m) {
    out.push(
      ...m[1]
        .split(/[｜|、,，;；\s]+/)
        .map((x) => x.trim())
        .filter((x) => x.length >= 2 && x.length <= 12),
    );
  }
  const unique = [...new Set(out)];
  if (unique.length) console.log(`[pipeline] 事实清单解析: ${unique.length} 个专有名词`);
  return unique;
}

const TRANSLATION_REPAIR_SYSTEM =
  '你是日文回译稿的逐句修复员。有道机器翻译的中文稿存在硬伤，请对照【中文参考素材】和【日文原文】逐句修复。\n' +
  '只修复以下硬伤：错字、漏字、缺字（如人名“董思玗”被翻成“董思”）、语句残缺、断句碎乱、重复错乱（如“a: a:”噪声）、人名/地名/专业词翻译错误、明显胡译。\n' +
  '严格要求：\n' +
  '1. 保持机器直译的效果和原文句式结构，禁止润色、扩写、调整语序、合并或拆分句子、改写成更书面或更顺滑的表达。\n' +
  '2. “原文”必须是待修复中文稿中的原样片段，尽量短；“修正”只改出问题的部分，长度与“原文”相差不超过 4 字。\n' +
  '3. 逐句检查每一句：只要句子读不通、与日文原文不符、含乱码或胡译词，就必须修复，不要遗漏；禁止输出与“原文”完全相同的“修正”；整篇最多 50 处。\n' +
  '4. 只输出 JSON：{"patches":[{"原文":"...","修正":"..."}]}，不要任何解释。';

// 简单编辑距离（带提前退出），用于校验修复幅度
function levenshteinDistance(a, b, maxDist) {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;
  if (a === b) return 0;
  const n = a.length;
  const m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;
  let prev = new Array(m + 1);
  let curr = new Array(m + 1);
  for (let j = 0; j <= m; j += 1) prev[j] = j;
  for (let i = 1; i <= n; i += 1) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= m; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDist) return maxDist + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[m];
}

// 固定一轮逐句修复：对照原素材和日文稿，用精确补丁修复有道译文的硬伤，保持直译
async function repairTranslationWithLlm(reference, japanese, chinese, provider, cfg) {
  const env = providerEnv(provider, cfg);
  const userMsg =
    `【中文参考素材】\n${String(reference || '').slice(0, 6000)}\n\n` +
    `【日文原文】\n${String(japanese || '').slice(0, 8000)}\n\n` +
    `【待修复的有道中文稿】\n${chinese}\n\n请只输出修复清单 JSON。`;
  const raw = await callApi(
    [
      { role: 'system', content: TRANSLATION_REPAIR_SYSTEM },
      { role: 'user', content: userMsg },
    ],
    { temperature: 0.1, provider, env },
  );
  const cleaned = stripCodeFence(raw);
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return chinese;
  let parsed;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return chinese;
  }
  const patches = Array.isArray(parsed.patches) ? parsed.patches : [];
  let out = chinese;
  let applied = 0;
  const seen = new Set();
  for (const p of patches) {
    const src = typeof p.原文 === 'string' ? p.原文 : typeof p.old === 'string' ? p.old : '';
    const rep = typeof p.修正 === 'string' ? p.修正 : typeof p.new === 'string' ? p.new : '';
    if (!src || src.length < 2 || !rep || src === rep || seen.has(src)) continue;
    seen.add(src);
    if (!out.includes(src)) continue;
    if (src.length > 28) continue;
    // 允许缩短（删除乱码/噪声/残缺），但不允许明显扩写；含噪声片段可大幅缩短
    const noisy =
      /(?:[a-zA-Z]{1,3}\s*[:：]\s*){3,}|false\s*[\[【（(]|句意\s*[：:]|\[[^\]]{1,20}\]\s*[^。！？\n]{0,15}每日一句/.test(
        src,
      );
    if (rep.length > src.length + 4 || (src.length - rep.length > 12 && !noisy)) continue;
    if (/[【】]/.test(rep)) continue;
    if (!/[（(]/.test(src) && /[（(]/.test(rep)) continue;
    if (applied >= 50) break;
    out = out.split(src).join(rep);
    applied += 1;
  }
  // 防止整篇重写：修复幅度过大时回退有道原文
  const maxLen = Math.max(chinese.length, out.length);
  const hardLimit = Math.max(30, Math.ceil(maxLen * 0.12));
  const dist = levenshteinDistance(chinese, out, hardLimit);
  if (dist > hardLimit) {
    console.log(`[pipeline] 翻译修复改动过大（${dist} 字符 > ${hardLimit}），已保留有道译文`);
    return chinese;
  }
  console.log(`[pipeline] 翻译修复: 应用 ${applied} 处补丁`);
  return out;
}

async function translateToChinese(text, translationProvider, translationLlmProvider, cfg) {
  if (translationProvider === 'youdao') return translateYoudao(text, cfg);
  if (translationProvider === 'llm') {
    return translateLlm(text, translationLlmProvider, cfg);
  }
  throw new Error('translation_provider 只能是 youdao 或 llm');
}

function stripCodeFence(text) {
  let cleaned = String(text).trim();
  if (!cleaned.startsWith('```')) return cleaned;
  const lines = cleaned.split('\n');
  if (lines[0] && lines[0].trim().startsWith('```')) lines.shift();
  if (lines.length && lines[lines.length - 1].trim() === '```') lines.pop();
  return lines.join('\n').trim();
}

/** 日文检测：含平假名/片假名才算日文（中文不会有假名） */
function looksJapanese(text) {
  const kana = String(text || '').match(/[\u3040-\u30ff]/g) || [];
  return kana.length > 0;
}

/**
 * 排版分块轮：只划分结构，不改写原文。
 * 输入已定稿中文，输出结构化 blocks（JSON），由前端直接渲染进排版模板。
 */
async function formatArticleBlocks(chineseText, provider, cfg) {
  const env = providerEnv(provider, cfg);
  const user = `下面是一篇已定稿的中文公众号文章。请对它做“排版分块”，严禁改动原文。

严格规则：
1. 不得修改原文的任何句子（不得新增、删除、改写、润色、合并或拆分段落内容）；不得补写摘要、金句或结尾。
1b. 不得新增原文没有的小标题；原文没有小标题时，只把段落按顺序输出为 p 块，不要自创标题。
2. 只判断每段内容适合哪种排版块，并按原文顺序输出。
3. Markdown 标题（# / ## / ###）按级别转成 title / h2：去掉 # 标记和后面一个空格，只保留标题文字本身，标题文字不改写。
3b. 没有 # 标记时：第一行若是短句（≤30 字、句末无。！？）且明显是文章标题，转成 title；其余独立成行的短句一律按 p 处理，不要自动升成 h2（小标题只允许来自原文 # 标记）。
4. 列表行（-、*、数字序号）归并为 list，条目文字原样保留。
5. > 开头的引用行转成 quote，文字原样保留。
6. --- 或 *** 转成 divider。
7. 明显是行动号召的短句（含 关注、点赞、在看、转发、收藏 等）转成 cta，文字原样保留。
8. 其余长段落转成 p；语义上明显是“重点/提示”的段落可转 tip 或 card，但文字必须原样。
9. 只有原文包含图片语法 ![说明](地址) 时才输出 image 块，并原样保留 src 与说明，不要虚构图片。
10. 只输出一个 JSON 对象，不要输出任何解释文字，格式：
{"blocks":[{"type":"title","text":"..."},{"type":"h2","text":"..."},{"type":"p","text":"..."},{"type":"quote","text":"..."},{"type":"list","items":["...","..."]},{"type":"tip","text":"..."},{"type":"card","text":"..."},{"type":"divider"},{"type":"cta","text":"..."}]}

文章：
---原文开始---
${chineseText}
---原文结束---`;

  const raw = await callApi(
    [
      {
        role: 'system',
        content:
          '你是一个严谨的公众号排版分块器。你只负责把文章按语义切成排版块，绝不改变原文的任何文字。你只输出合法 JSON。',
      },
      { role: 'user', content: user },
    ],
    { temperature: 0, provider, env },
  );

  const cleaned = stripCodeFence(raw);
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('排版分块返回内容不是 JSON');
  }
  let json = cleaned.slice(start, end + 1);
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    // 模型偶尔返回 JS 风格对象：属性名不带双引号 / 单引号 / 尾逗号
    json = json
      .replace(/([{,]\s*)'([^']+)'\s*:/g, '$1"$2":')
      .replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*|[0-9]+)\s*:/g, '$1"$2":')
      .replace(/:\s*'((?:[^'\\]|\\.)*)'/g, ':"$1"')
      .replace(/(\[|,)\s*'((?:[^'\\]|\\.)*)'\s*(?=[,\]])/g, '$1"$2"')
      .replace(/,\s*([}\]])/g, '$1');
    parsed = JSON.parse(json);
  }
  const blocks = Array.isArray(parsed.blocks) ? parsed.blocks : [];
  const allowed = new Set([
    'title',
    'subtitle',
    'h2',
    'p',
    'quote',
    'card',
    'divider',
    'cta',
    'list',
    'tip',
    'image',
    'follow',
  ]);
  const filtered = blocks
    .filter((b) => b && typeof b === 'object' && allowed.has(b.type))
    .map((b) => ({
      type: String(b.type),
      text: typeof b.text === 'string' ? b.text : undefined,
      items: Array.isArray(b.items) ? b.items.map(String) : undefined,
      src: typeof b.src === 'string' ? b.src : undefined,
    }));
  if (!filtered.length) {
    throw new Error('排版分块结果为空');
  }
  return filtered;
}

function detectInputMode(source) {
  const lines = source
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 1 && source.length <= 100) return 'title';
  return 'article';
}

function providerWritingGuidance(provider) {
  if (provider === 'deepseek') {
    return (
      'DeepSeek适配：避免把文章整理成过度整齐的三段式，' +
      '避免连续总结句、中文句法直译成日文，以及「まず、次に、最後に」' +
      '式机械连接。优先使用日本读者自然理解、同时便于回译中文的句序。'
    );
  }
  return (
    'MiniMax适配：不要为了增强画面感而补写原文没有的城市、时间、' +
    '人物履历、对话、动作和心理活动。具体感必须来自输入或明确的假设场景。'
  );
}

async function createContentPlan(
  source,
  inputMode,
  audience,
  articleCategory,
  provider,
  engineRules,
  cfg,
) {
  const env = providerEnv(provider, cfg);
  const user = `请根据通用内容引擎，为下面的输入制定写作计划。

输入形式：${inputMode}
用户填写类目：${articleCategory}
目标读者：${audience}

通用内容引擎：
---规则开始---
${engineRules}
---规则结束---

输入：
---输入开始---
${source}
---输入结束---

只输出 JSON，字段如下：
{
  "detected_category": "自动判断的类目",
  "primary_archetype": "八种原型之一",
  "secondary_archetype": "可选副原型或 none",
  "core_message": "读者最后只记住的一层意思",
  "reader_stake": "这件事为什么与目标读者有关",
  "central_tension": "文章中的真实矛盾；没有则写 none",
  "counter_position": "另一种合理解释或现实限制",
  "sharing_drivers": ["最适合的传播驱动，最多三个"],
  "hook_plan": "标题与前三段如何进入",
  "body_arc": ["正文推进节点，不固定三段"],
  "reader_value": "读者最终得到的新判断、说法或动作",
  "ending_plan": "回扣场景或具体讨论问题",
  "evidence_limits": ["不能虚构或扩大断言的地方"]
}`;
  return callApi(
    [
      {
        role: 'system',
        content: '你是中国公众号内容策略编辑。你的任务是选择适合题材的文章结构，不是把所有内容都改成争议文。只输出 JSON，不写正文。',
      },
      { role: 'user', content: user },
    ],
    { temperature: 0.2, provider, env },
  );
}

async function extractArticleBrief(source, audience, articleCategory, provider, cfg) {
  const env = providerEnv(provider, cfg);
  const user = `把下面的中文原稿提取为可供重新创作的"内容骨架"。

目标读者：${audience}
文章类目：${articleCategory}

严格要求：
1. 保留核心观点、事实、数字、人物、案例、因果关系和最终结论。
2. 区分"原稿明确事实""作者判断""举例或假设"，不得混淆。
3. 删除原稿的标题、小标题、段落顺序、排比、金句、转折和总结话术。
4. 不沿用原稿句子；每一点只写中性的事实或含义。
5. 列出禁止虚构、禁止扩大和需要保留限定语的内容。
6. 不评价原稿，不输出改写建议，不写日文正文。
7. 额外输出“不可变事实清单”：把原稿中的专有名词（人名全称、地名、账号名等）、人物关系（谁是谁的妈妈/爸爸/女儿/姐姐/妹妹）、数字与比分、时间点、比赛/事件轮次结果逐项列出；格式为：
[不可变事实清单]
人名：董思辰｜董思玗｜晓菲姐
人物关系：晓菲姐是妈妈；董思辰是姐姐；董思玗是妹妹
数字与比分：150｜1比5｜1比1｜20页｜1小时
时间点：节目播出当晚
事件轮次：第一轮董思辰被淘汰；第二轮全组淘汰；第三轮获胜进入下一轮
该清单中每一项都必须与原文完全一致，后续任何环节不得改写、省略或混淆。

只按以下格式输出：
[核心命题]
[事实与材料]
[作者判断]
[读者处境与真实矛盾]
[必须保留的限定与反方理由]
[禁止虚构或扩大的内容]
[不可变事实清单]
[可采用但不固定的推进方向]

---中文原稿开始---
${source}
---中文原稿结束---`;
  return callApi(
    [
      {
        role: 'system',
        content: '你是内容事实编辑。只提取原稿已经存在的信息，不写文章，不润色，不补充案例、场景、数据、人物或心理活动。',
      },
      { role: 'user', content: user },
    ],
    { temperature: 0.1, provider, env },
  );
}

async function createJapanese(
  {
    source,
    rules,
    viralRules,
    engineRules,
    contentPlan,
    tone,
    audience,
    publicationMarket,
    articleCategory,
    provider,
    inputMode,
    viralMode,
    qualityMode,
    articleRewriteMode,
    languageGuard,
  },
  cfg,
) {
  const env = providerEnv(provider, cfg);
  const modelGuidance = providerWritingGuidance(provider);
  const viralSection = viralMode
    ? `传播力编辑规则：
---传播规则开始---
${viralRules}
---传播规则结束---`
    : '传播力编辑层未启用。以自然、准确和事实保真为主。';
  const marketSection = `最终发布约束：
1. 日文只是中间创作语言，最终内容发布于「${publicationMarket}」。
2. 目标读者是「${audience}」，文章类目为「${articleCategory}」。
3. 不得把中国人物、平台、货币、学校、家庭和社会语境改成日本语境。
4. 日文必须自然，但要避免只有日本读者才懂的文化梗和模糊省略，保证回译中文后仍清楚。

通用内容引擎：
---通用引擎开始---
${engineRules}
---通用引擎结束---

本篇写作计划：
---计划开始---
${contentPlan}
---计划结束---

写作时执行计划，但如果计划与原始输入冲突，以原始输入和事实保真为准。`;

  let task;
  if (inputMode === 'title') {
    task = `下面的中文输入只有标题或选题，不是待翻译的正文。
请围绕它创作一篇完整的日文公众号风格文章。

写作要求：
1. 正文建议 1600 至 2400 个日文字符，不能只输出标题、提纲或摘要。
2. 使用一个具体但不具名的日常场景开篇，再逐步展开观点。
3. 不虚构真实人物、采访、研究、机构、数据或作者亲身经历。
4. 场景必须使用「たとえば」、第二人称或其他明确的假设表达。
5. 不得凭空添加城市、具体时间、年份、次数、家庭履历或看似真实采访的对话。
6. 对心理和社会现象保留分寸，不把一种可能性说成适用于所有人的定律。
7. 设置一个真实的两难或立场冲突，并公平呈现另一方的理由。
8. 写出读者熟悉但不容易说出口的具体处境。
9. 按写作计划收尾；讨论型文章留下具体问题，故事或随笔可以回扣场景。
10. 输出一个日文标题和完整正文。

中文标题或选题：
---输入开始---
${source}
---输入结束---`;
  } else if (articleRewriteMode === 'rebuild') {
    task = `下面不是待翻译的中文原稿，而是从原稿中提取的内容骨架。
原稿的标题、句式、段落和修辞已被刻意隔离。请只根据骨架中的信息，
重新创作一篇自然、可独立发布的日文文章。

严格要求：
1. 结构可以重新组织，但逻辑骨架必须与骨架一致：核心观点、事实、要点顺序不得遗漏或颠倒。
2. 小标题可以重写润色成更自然、更有吸引力的表达，但主题必须与骨架对应；不得自创与骨架无关的新结构。
3. 必须严格保留“不可变事实清单”中的每一项：人名全称、人物关系、数字、比分、时间点、事件轮次结果，逐字保留，不得省略、改写、混淆或前后矛盾。
4. 中文人名在日文稿中直接使用汉字（如“董思辰”），不假名化、不音译、不省略。
5. 不补充骨架中没有的人物、经历、对话、数字、研究或心理活动。
6. 不把假设写成真实经历，不把作者判断写成公认事实。
7. 避免规整三段式、连续排比、重复结论和模板化金句。

内容骨架：
---骨架开始---
${source}
---骨架结束---`;
  } else {
    const rewriteFocus =
      articleRewriteMode === 'light'
        ? '尽量保留原稿的段落顺序和论证结构，只改善表达与节奏。'
        : '可以重组开头、段落顺序和小标题，但必须保留事实和核心观点。';
    task = `下面的中文输入是一篇待编辑的文章。
请保留原文事实和核心观点，把它重写成自然、可独立发布的日文文章。
不要逐句直译，也不要补充原文没有的事实、动作、对话或心理活动。
改写强度：${rewriteFocus}

中文原稿：
---原稿开始---
${source}
---原稿结束---`;
  }

  const rewriteMessages = [
    {
      role: 'system',
      content:
        'あなたは中国語と日本語に精通した文章編集者です。逐語訳ではなく、原文に忠実な自然な日本語記事を書いてください。',
    },
    {
      role: 'user',
      content: `【出力言語の硬性要求】
本环节是“中文 → 日文中间稿 → 中文回译”的去AI化流程。你必须用日语写作，正文必须包含平假名或片假名（かな），禁止输出中文、英文或混合语言。
${languageGuard ? '\n【警告】上次输出不是日文。本次必须全部使用日语写作，禁止输出中文。' : ''}

以下の編集規則に従って、中国語原稿を日本語の記事にしてください。

希望する文体：
${tone}

模型适配要求：
${modelGuidance}

編集規則：
---規則開始---
${rules}
---規則終了---

任务：
---任务开始---
${task}
---任务结束---

目标读者：
${audience}

${viralSection}

${marketSection}`,
    },
  ];
  reportProgress(cfg,'article','正在撰写中间稿');
  const candidate = await callApi(rewriteMessages, { temperature: 0.55, provider, env });

  if (qualityMode === 'single') return candidate.trim();

  let verified = candidate.trim();
  if (qualityMode === 'full') {
    reportProgress(cfg,'article','正在校核事实');
    let verificationInstruction;
    let sourceLabel;
    if (inputMode === 'title') {
      verificationInstruction =
        '候補稿が中国語の題名から外れていないか確認してください。' +
        '実在の人物、取材、研究、組織、データ、著者の体験として裏付けのない内容があれば、一般的な例に直してください。' +
        '題名だけ、要約だけの場合は、完全な記事に直してください。' +
        '入力にない都市、時刻、年数、回数、家族履歴、取材風の会話を削除し、場面は仮定だと明示してください。' +
        '構成計画が議論型なら具体的な質問で終え、物語や随筆なら場面に戻ってください。' +
        '最終読者は中国にいるため、日本の制度、通貨、プラットフォーム、都市、生活習慣への置き換えがあれば、中国の文脈に戻してください。' +
        '「不可变事实清单」に記載された人名、人物関係、数字、時間、事件の順番を逐項照合し、不一致があれば直接修正してください。';
      sourceLabel = '中国語の題名またはテーマ';
    } else {
      verificationInstruction =
        '候補稿の自然な日本語を保ちながら、原文にない事実、行動、会話、数字、心理描写、因果関係だけを削除または修正してください。' +
        '中国の文脈を日本の制度、通貨、プラットフォーム、都市、生活習慣に置き換えないでください。' +
        '「不可变事实清单」に記載された人名、人物関係、数字、時間、事件の順番を逐項照合し、不一致があれば直接修正してください。';
      sourceLabel = '中国語原稿';
    }
    verified = await callApi(
      [
        {
          role: 'system',
          content:
            'あなたは事実確認を行う日中バイリンガル編集者です。' +
            verificationInstruction +
            '最終的な日本語記事だけを出力してください。',
        },
        {
          role: 'user',
          content: `${sourceLabel}：
---原稿開始---
${source}
---原稿終了---

日本語候補稿：
---候補稿開始---
${candidate}
---候補稿終了---`,
        },
      ],
      { temperature: 0.15, provider, env },
    ).then((s) => s.trim());
  }

  if (!viralMode) return verified;

  reportProgress(cfg,'article','正在检查成稿结构');
  const publicationReview = await callApi(
    [
      {
        role: 'system',
        content:
          'あなたは中国のWeChat公式アカウント向け記事の最終編集者です。' +
          '日本語は翻訳前の中間原稿です。記事を日本向けに変更しないでください。' +
          '修正後の完全な日本語記事だけを出力してください。',
      },
      {
        role: 'user',
        content: `以下の日本語候補稿を、中国で公開する前提で最終確認してください。

中国語の入力：
---入力開始---
${source}
---入力終了---

入力形式：${inputMode}
対象読者：${audience}
公開市場：${publicationMarket}
記事カテゴリー：${articleCategory}

事前に選んだ構成：
---計画開始---
${contentPlan}
---計画終了---

最終確認：
1. 中国の文脈を維持し、日本の通貨、制度、都市、プラットフォームに置き換えない。
2. 入力が title の場合、入力にない都市、時刻、年数、回数、家族履歴、取材風の会話を削除する。
3. title の場面描写は「たとえば」または第二人称の仮定として明示し、実話のように見せない。
4. 双方に理解できる理由があり、片方を愚か・悪意・無能として描かない。
5. 同じ結論の反復、煽り、侮辱的なラベル、根拠のない心理診断を削除する。
6. 本文は完全な記事として残し、短い要約にしない。
7. 終わり方は構成計画に従う。議論型なら具体的な質問、物語・随筆型なら場面への回帰を優先する。
8. 題材に合う文章原型を使い、対立、三段構成、金句、質問を機械的に強制しない。
9. 核心、冒頭、具体性、信頼性、感情、展開、読者価値、自然さの中で最も弱い二点だけを修正する。
10. 次の人間らしい文章規則を守り、機械的な接続、整いすぎた列挙、否定形の連続、翻訳調を除く。
11. 入力の「不可变事实清单」に記載された人名、人物関係、数字、時間、事件の順番を逐項照合し、不一致があれば直接修正する。

人間らしい文章規則：
---人性化規則開始---
${rules}
---人性化規則終了---

日本語候補稿：
---候補稿開始---
${verified}
---候補稿終了---`,
      },
    ],
    { temperature: 0.2, provider, env },
  );
  return publicationReview.trim();
}

async function runPipeline(payload = {}, cfg = {}) {
  const source = String(payload.sourceText || '').trim();
  if(!source)throw new Error('输入内容为空，请先填写文章主题或粘贴素材');
  const provider=cfg.AI_PROVIDER||cfg.PROVIDER||payload.provider||'deepseek';
  reportProgress(cfg,'article','正在直接生成中文正文（仅一次模型调用）');
  const {articleBlocks,articleMessages}=require('./article-text.cjs');
  const chinese=stripCodeFence(await callApi(articleMessages(payload,source),{temperature:0.5,env:providerEnv(provider,cfg)}));
  cfg.AI_SIGNAL?.throwIfAborted();
  if(!looksChinese(chinese))throw outputMismatch('模型未返回中文正文');
  reportProgress(cfg,'layout','正文已完成，正在本地排版（不调用模型）');
  return {mode:detectInputMode(source),chinese:safeStr(chinese),blocks:articleBlocks(chinese)};
}

async function testConnection(payload = {}, cfg = {}) {
  const provider = cfg.AI_PROVIDER || cfg.PROVIDER || (payload.provider === 'minimax' ? 'minimax' : 'deepseek');
  const env = providerEnv(provider, cfg, payload);
  const reply = await callApi(
    [
      { role: 'system', content: '你是连接测试助手，只做简短回复。' },
      { role: 'user', content: '请只回复：连接成功 OK' },
    ],
    { temperature: 0, provider, env },
  );
  return reply;
}

async function chatWithProvider({ system, user, provider = 'deepseek', temperature = 0.3 }, cfg = {}) {
  const env = providerEnv(provider, cfg);
  if (!system || !user) throw new Error('缺少对话内容');
  return callApi(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { temperature: Number(temperature) || 0.3, provider, env },
  );
}

module.exports = { runPipeline, testConnection, loadEnvFile, formatArticleBlocks, chatWithProvider };
