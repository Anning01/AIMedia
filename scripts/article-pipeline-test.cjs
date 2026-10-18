const { app } = require('electron');
const { runtimeConfig } = require('../electron/ai-config.cjs');
const { runPipeline } = require('../electron/pipeline.cjs');

const DEFAULT_SOURCE = [
  '【文章主题/素材】',
  '请写一篇公众号文章：为什么越追求完美的母亲越累',
  '',
  '【文章大纲】',
  '金句：先做好完整的自己，再去照顾好孩子。',
  '框架：',
  '1. 完美妈妈的自我消耗',
  '2. 孩子真正需要的是真实而非完美',
  '3. 学会示弱与求助',
  '小段标题：',
  '1. 越完美，越崩溃',
  '2. 孩子不需要完美的妈妈',
  '3. 承认做不到，才是爱的开始',
].join('\n');

app.whenReady().then(async () => {
  const cfg = runtimeConfig();
  const payload = {
    sourceText: process.argv[2] || DEFAULT_SOURCE,
    provider: 'deepseek',
    inputMode: 'auto',
    qualityMode: 'fast',
    rewriteMode: 'rebuild',
    viralMode: true,
    autoStrategy: true,
    audience: '关注家庭关系和自我成长的成年读者',
    category: '',
    translationProvider: 'youdao',
  };
  const t0 = Date.now();
  try {
    const r = await runPipeline(payload, cfg);
    console.log(
      'RESULT OK mode=',
      r.mode,
      'japaneseLen=',
      (r.japanese || '').length,
      'chineseLen=',
      (r.chinese || '').length,
      'blocks=',
      (r.blocks || []).length,
      'elapsedMs=',
      Date.now() - t0,
    );
    console.log('CHINESE_HEAD=', (r.chinese || '').slice(0, 160));
  } catch (err) {
    console.log('RESULT FAIL elapsedMs=', Date.now() - t0);
    console.log('ERROR=', err && (err.stack || err.message || err));
  }
  process.exit(0);
});
