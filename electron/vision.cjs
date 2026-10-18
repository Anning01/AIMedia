'use strict';
const { chatUrl, requestChat } = require('./ai-client.cjs');

function openAiChatUrl(cfg) {
  let url = String(cfg.MINIMAX_API_URL || 'https://api.minimaxi.com/v1/text/chatcompletion_v2').trim();
  if (url.includes('/text/chatcompletion_v2')) {
    url = url.replace('/text/chatcompletion_v2', '/chat/completions');
  } else if (!/\/chat\/completions$/.test(url)) {
    url = url.replace(/\/+$/, '') + '/chat/completions';
  }
  return url;
}

function extractJson(raw) {
  const cleaned = String(raw || '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('视觉模型返回不是 JSON');
  let json = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(json);
  } catch {
    // 模型偶尔返回 JS 风格对象：属性名不带双引号 / 单引号 / 尾逗号
    json = json
      .replace(/([{,]\s*)'([^']+)'\s*:/g, '$1"$2":')
      .replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*|[0-9]+)\s*:/g, '$1"$2":')
      .replace(/:\s*'((?:[^'\\]|\\.)*)'/g, ':"$1"')
      .replace(/(\[|,)\s*'((?:[^'\\]|\\.)*)'\s*(?=[,\]])/g, '$1"$2"')
      .replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(json);
  }
}

async function analyzeNoteImages(images, cfg) {
  const dashKey = String(cfg.DASHSCOPE_API_KEY || '').trim();
  const miniKey = String(cfg.MINIMAX_API_KEY || '').trim();
  if (!cfg.AI_VISION && !dashKey && !miniKey) {
    throw new Error(
      '请到「AI 配置」选择支持图片输入的模型，并启用图片输入；已有独立视觉服务配置也可继续使用',
    );
  }
  const list = Array.isArray(images) ? images.filter(Boolean).slice(0, 9) : [];
  if (!list.length) {
    throw new Error('没有可分析的爆款图片');
  }
  const prompt = `你是小红书爆款笔记的图片构图分析师。请按顺序分析用户提供的每一张爆款图片，只输出可执行的视觉描述，不要复制图中文字。
对每张图输出：
- layout：构图方式（居中/三分/对角线/框架/俯拍/平视/特写等）
- subject：画面主体是什么、在画面中的位置、占画面比例
- lighting：光线方向与质感
- color：主色调与情绪
- scene：场景与环境氛围
- style：整体图片风格（真实摄影/杂志感/生活感/ins风/暖调等）
- text：画面中是否有文字区域，文字在画面中的作用（不复制文字内容）
- suggestSlot：这张图的内容类型，取值 cover（封面/首图）/ product（产品特写）/ scene（使用场景）/ text（文字卡片、截图、图文排版）/ other
- borrow：从这张图能借鉴的构图元素（主体位置、景别、机位角度、光线方向、色调关系、氛围），要具体可执行
- mustReplace：绝对不能复用的内容（原产品/品牌/人物/文字/水印/背景物品/博主信息/界面元素），逐项列清楚
最后输出 overallStyle 作为整组图片的统一风格。
只输出 JSON，不要任何解释：
{"images":[{"index":1,"layout":"","subject":"","lighting":"","color":"","scene":"","style":"","text":"","suggestSlot":"","borrow":"","mustReplace":""}],"overallStyle":""}`;

  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        ...list.map((image) => ({
          type: 'image_url',
          image_url: { url: image },
        })),
      ],
    },
  ];

  const env = cfg.AI_VISION
    ? { key: cfg.AI_API_KEY, url: cfg.AI_BASE_URL ? chatUrl(cfg.AI_BASE_URL, cfg.AI_API_PATH) : '', model: cfg.AI_MODEL, timeout: cfg.AI_TIMEOUT }
    : dashKey
      ? { key: dashKey, url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', model: cfg.DASHSCOPE_MODEL || 'qwen3-vl-flash', timeout: 120 }
      : { key: miniKey, url: openAiChatUrl(cfg), model: cfg.MINIMAX_MODEL || 'MiniMax-M3', timeout: 120 };
  const content = await requestChat(messages, env, 0.2);
  const parsed = extractJson(content);
  const items = Array.isArray(parsed.images) ? parsed.images : [];
  if (!items.length) {
    throw new Error('视觉分析结果缺少 images 字段');
  }
  const compositions = items.map((item) => {
    const parts = [
      item.layout ? `构图：${item.layout}` : '',
      item.subject ? `主体：${item.subject}` : '',
      item.lighting ? `光线：${item.lighting}` : '',
      item.color ? `色调：${item.color}` : '',
      item.scene ? `场景：${item.scene}` : '',
      item.style ? `风格：${item.style}` : '',
      item.text ? `文字区：${item.text}` : '',
    ].filter(Boolean);
    return parts.join('；');
  });
  return {
    ok: true,
    compositions,
    overallStyle: String(parsed.overallStyle || ''),
    items: items.map((item) => ({
      index: item.index,
      layout: item.layout || '',
      subject: item.subject || '',
      lighting: item.lighting || '',
      color: item.color || '',
      scene: item.scene || '',
      style: item.style || '',
      text: item.text || '',
      suggestSlot: item.suggestSlot || '',
      borrow: item.borrow || '',
      mustReplace: item.mustReplace || '',
    })),
  };
}

module.exports = { analyzeNoteImages };
