/**
 * 模板预览用的示例文章：轻断食的正确开始方法——不用再勉强忍受饥饿。
 * 仅用于展示模板排版效果，正文可在编辑器中修改或重新生成。
 */

export interface SampleBlock {
  id: string;
  type: 'title' | 'subtitle' | 'h2' | 'p' | 'quote' | 'list' | 'tip' | 'card' | 'divider' | 'cta';
  text?: string;
  items?: string[];
}

export const SAMPLE_ARTICLE_BLOCKS: SampleBlock[] = [
  { id: 's1', type: 'title', text: '轻断食的正确开始方法——不用再勉强忍受饥饿' },
  { id: 's2', type: 'subtitle', text: '别再靠意志力硬扛，方法对了，身体才会配合' },
  { id: 's3', type: 'h2', text: '轻断食不是「饿肚子」的代名词' },
  { id: 's4', type: 'p', text: '很多人对轻断食的理解，停留在「少吃一顿饭」这个层面。但轻断食的核心，从来不是让自己难受，而是调整进食节奏。' },
  { id: 's5', type: 'p', text: '当你在不该饿的时候强行挨饿，身体会分泌更多饥饿素，同时降低基础代谢率。饿一上午，晚上反而吃得更多。' },
  { id: 's6', type: 'quote', text: '你饿着肚子硬扛的那些小时，身体记住的是「饥荒」，不是「自律」。' },
  { id: 's7', type: 'h2', text: '一个更温和的起点' },
  { id: 's8', type: 'p', text: '不用一上来就挑战 16 小时，先从一个能长期坚持的节奏开始：' },
  {
    id: 's9',
    type: 'list',
    items: ['早餐晚一点，晚餐早一点', '每餐先吃菜和蛋白质', '多喝水，别靠饿撑'],
  },
  { id: 's10', type: 'tip', text: '刚开始别追求严格，先把进食时间固定下来。' },
  { id: 's11', type: 'h2', text: '比「怎么断」更重要的是「怎么吃」' },
  { id: 's12', type: 'p', text: '断食只是给身体留出处理能量的窗口，真正决定效果的是窗口里吃了什么。' },
  { id: 's13', type: 'card', text: '16+8 简单版：10 点第一餐，18 点前结束晚餐，留出完整空腹时间。' },
  { id: 's14', type: 'divider' },
  { id: 's15', type: 'cta', text: '点个在看，把这份方法转给需要的人' },
];
