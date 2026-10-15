/**
 * 生图风格档位：决定 AI 出图的整体视觉语言。
 * 默认「爆款吸睛」——高对比、浓色彩、强主体，适合公众号/小红书信息流。
 */

export interface ImageStyle {
  id: string;
  name: string;
  phrase: string;
  desc: string;
}

export const IMAGE_STYLES: ImageStyle[] = [
  {
    id: 'cinema',
    name: '电影质感真实',
    phrase:
      '电影质感真实摄影：真实照片质感，自然光影与电影级调色，浅景深，构图讲究，像专业电影剧照或商业大片，真实自然不夸张；严禁插画、卡通、二次元、数字绘画、唯美插画、超现实、AI绘画感',
    desc: '真实摄影 · 电影调色 · 剧照感',
  },
  {
    id: 'viral',
    name: '爆款吸睛',
    phrase:
      '视觉冲击力强，高对比度，色彩浓郁有层次，主体突出，专业商业摄影质感，光影丰富，构图有张力，一眼抓人眼球',
    desc: '高对比 · 浓色彩 · 强主体',
  },
  {
    id: 'bright',
    name: '明亮生活',
    phrase: '明亮自然光，干净通透，生活化真实感，清新舒适',
    desc: '自然光 · 通透 · 生活感',
  },
  {
    id: 'minimal',
    name: '高级简约',
    phrase: '极简构图，低饱和高级灰，留白充足，质感细腻，克制高级',
    desc: '极简 · 低饱和 · 留白',
  },
  {
    id: 'guofeng',
    name: '国风雅致',
    phrase: '东方美学，水墨意境，典雅配色，留白构图，含蓄有韵味',
    desc: '东方美学 · 水墨 · 意境',
  },
  {
    id: 'tech',
    name: '深色科技',
    phrase: '深色背景，冷色调，科技光效，未来感，精致数字质感',
    desc: '深色 · 冷调 · 科技感',
  },
  {
    id: 'film',
    name: '杂志胶片',
    phrase: '胶片质感，细腻颗粒，电影感色调，故事氛围，有情绪张力',
    desc: '胶片 · 电影感 · 情绪',
  },
];

export function imageStyleById(id: string): ImageStyle {
  return IMAGE_STYLES.find((s) => s.id === id) || IMAGE_STYLES[0];
}

/** 人物要求：根据主题内容自然决定是否出现人物；出现人物时必须是年轻好看的中国面孔 */
export const PEOPLE_REQUIREMENT =
  '画面内容根据主题自然决定：该有人的场景就自然出现人物，不需要人物的场景就保持纯净；不要为了凑人物而硬加，也不要为了避开人物而强行改成空场景。出现人物时，人物必须是中国人（东亚面孔），年轻、五官精致、干净好看、气质自然。';

/** 画面纯净要求：禁止任何文字/水印/logo，保持纯画面 */
export const NO_TEXT_REQUIREMENT =
  '画面中禁止出现任何文字、字母、数字、标点、水印、logo、海报标题、广告语；保持纯画面，不要任何文字元素。';
