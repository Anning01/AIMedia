const { app, BrowserWindow, clipboard, dialog, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { runPipeline, testConnection, chatWithProvider } = require('./pipeline.cjs');
const { fetchXhsNote, downloadNoteImages, publishXhsNote } = require('./xhs.cjs');
const { analyzeNoteImages } = require('./vision.cjs');
const { cutoutProduct } = require('./segment.cjs');
const {
  createLoginSession,
  pollLoginSession,
  cancelSession,
} = require('./platformLogin.cjs');
const { getPublicAccounts } = require('./wechatMp.cjs');
const wechatMp = require('./wechatMp.cjs');
const {
  publishArticle: publishToutiao,
  verifyLogin: verifyToutiao,
} = require('./toutiao.cjs');
const {
  publishArticle: publishBaijiahao,
  verifyLogin: verifyBaijiahao,
} = require('./baijiahao.cjs');
const aiConfig = require('./ai-config.cjs');
const { createQilingService } = require('./qiling-service.cjs');
const { isQilingUrl } = require('./qiling-api.cjs');
let qiling;
const qilingService = () => qiling ||= createQilingService({config:aiConfig,directory:app.getPath('userData'),openExternal:url=>shell.openExternal(url)});
const aiError = error => ({ok:false,error:error.message||String(error),code:error.code,retryable:error.retryable});
const callConfig = payload => ({...readAiConfig(),AI_REQUEST_ID:payload.requestId || require('crypto').randomUUID()});

const IMAGEHOST_CONFIG = path.join(__dirname, '..', 'config', 'imagehost.json');
const readAiConfig = aiConfig.runtimeConfig;

function registerIpc() {
  ipcMain.handle('window-minimize', () => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    win?.minimize();
  });
  ipcMain.handle('window-maximize', () => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.handle('window-close', () => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    win?.close();
  });
  ipcMain.handle('copy-html', (_e, html) => {
    if (typeof html !== 'string' || !html) return { ok: false, error: '内容为空' };
    clipboard.writeHTML(html);
    return { ok: true };
  });
  ipcMain.handle('select-image', async () => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    const result = await dialog.showOpenDialog(win, {
      title: '选择图片',
      properties: ['openFile'],
      filters: [
        { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
      ],
    });
    if (result.canceled || !result.filePaths.length) {
      return { ok: false, canceled: true };
    }
    const file = result.filePaths[0];
    const stat = fs.statSync(file);
    if (stat.size > 12 * 1024 * 1024) {
      return { ok: false, error: '图片超过 12MB，请压缩后再试' };
    }
    const ext = path.extname(file).toLowerCase().replace('.', '');
    const mimeMap = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
    };
    const mime = mimeMap[ext] || 'image/png';
    const dataUrl = `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
    return { ok: true, name: path.basename(file), dataUrl };
  });
  ipcMain.handle('select-text-file', async () => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    const result = await dialog.showOpenDialog(win, {
      title: '选择素材 txt 文件',
      properties: ['openFile'],
      filters: [{ name: '文本文件', extensions: ['txt', 'md'] }],
    });
    if (result.canceled || !result.filePaths.length) {
      return { ok: false, canceled: true };
    }
    const file = result.filePaths[0];
    const stat = fs.statSync(file);
    if (stat.size > 5 * 1024 * 1024) {
      return { ok: false, error: '文件超过 5MB，请拆分后再导入' };
    }
    const content = fs.readFileSync(file, 'utf8');
    return { ok: true, name: path.basename(file), path: file, content };
  });
  ipcMain.handle('select-images', async (_e, payload = {}) => {
    const max = Math.min(Math.max(Number(payload.max) || 3, 1), 9);
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    const result = await dialog.showOpenDialog(win, {
      title: max > 3 ? `选择图片（最多 ${max} 张）` : '选择文章配图（最多 3 张）',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
      ],
    });
    if (result.canceled || !result.filePaths.length) {
      return { ok: false, canceled: true };
    }
    const files = result.filePaths.slice(0, max);
    const mimeMap = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
    };
    const images = [];
    for (const file of files) {
      const stat = fs.statSync(file);
      if (stat.size > 12 * 1024 * 1024) {
        return { ok: false, error: `图片超过 12MB：${path.basename(file)}` };
      }
      const ext = path.extname(file).toLowerCase().replace('.', '');
      const mime = mimeMap[ext] || 'image/png';
      images.push({
        name: path.basename(file),
        dataUrl: `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`,
      });
    }
    return { ok: true, images };
  });
  ipcMain.handle('read-imagehost-config', () => {
    try {
      const config = JSON.parse(fs.readFileSync(IMAGEHOST_CONFIG, 'utf8'));
      return { ok: true, config: config || {} };
    } catch {
      return { ok: true, config: {} };
    }
  });
  ipcMain.handle('save-imagehost-config', (_e, payload) => {
    try {
      fs.mkdirSync(path.dirname(IMAGEHOST_CONFIG), { recursive: true });
      fs.writeFileSync(IMAGEHOST_CONFIG, JSON.stringify(payload || {}, null, 2), 'utf8');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });
  ipcMain.handle('save-file', async (_e, payload = {}) => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    const isPng = !!payload.dataUrl;
    const result = await dialog.showSaveDialog(win, {
      defaultPath: payload.defaultName || (isPng ? 'untitled.png' : 'export.txt'),
      filters: isPng
        ? [{ name: 'PNG 图片', extensions: ['png'] }]
        : [{ name: '文本文件', extensions: ['txt', 'log', 'csv'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    try {
      if (isPng) {
        const base64 = String(payload.dataUrl).split(',')[1] || '';
        fs.writeFileSync(result.filePath, Buffer.from(base64, 'base64'));
      } else {
        fs.writeFileSync(result.filePath, String(payload.text ?? ''), 'utf8');
      }
      return { ok: true, path: result.filePath };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });
  ipcMain.handle('select-directory', async () => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory'],
      title: '选择数据目录',
    });
    if (result.canceled || !result.filePaths.length) return { ok: false, canceled: true };
    return { ok: true, path: result.filePaths[0] };
  });
  ipcMain.handle('set-autostart', (_e, payload = {}) => {
    app.setLoginItemSettings({ openAtLogin: !!payload.enabled });
    return { ok: true, enabled: !!payload.enabled };
  });
  ipcMain.handle('generate-image', async (_e, payload = {}) => {
    try {
      let { provider = 'minimax', apiKey = '', baseUrl = '', model = '', prompt = '', size = '', count = 1 } = payload;
      const aiCfg = readAiConfig();
      if (aiCfg.IMAGE_API_KEY) {
        provider = aiCfg.IMAGE_PROVIDER;
        apiKey = aiCfg.IMAGE_API_KEY;
        baseUrl = aiCfg.IMAGE_BASE_URL;
        model = aiCfg.IMAGE_MODEL;
      }
      // MiniMax / Seedream 模式：Key 留空时自动使用 ai.env 中配置的对应密钥
      if (provider === 'minimax' && !apiKey) {
        apiKey = aiCfg.MINIMAX_API_KEY || '';
      }
      if (provider === 'seedream' && !apiKey) {
        apiKey = aiCfg.ARK_API_KEY || '';
      }
      if (!apiKey) {
        throw new Error('未配置图片生成 Key，请到「AI 配置 → 图片生成」设置');
      }
      if (!prompt.trim()) throw new Error('请输入画面描述');

      const normalizeUrl = (u, suffix) => {
        const clean = u.replace(/\/+$/, '');
        return clean.endsWith(suffix) ? clean : clean + suffix;
      };
      let url;
      let body;
      if (provider === 'seedream') {
        url = normalizeUrl(
          baseUrl || 'https://ark.cn-beijing.volces.com/api/v3/images/generations',
          '/api/v3/images/generations',
        );
        const refs = Array.isArray(payload.referenceImages)
          ? payload.referenceImages.filter((x) => typeof x === 'string' && x.trim())
          : [];
        body = {
          model: model || 'doubao-seedream-4-5-251128',
          prompt,
          response_format: 'b64_json',
          watermark: false,
          seed:
            Number.isInteger(payload.seed)
              ? payload.seed
              : Math.floor(Math.random() * 2147483647),
        };
        if (refs.length) body.image = refs.length === 1 ? refs[0] : refs;
        const sizeMap = { '3:4': '1728x2304', '4:3': '2304x1728', '1:1': '2048x2048', '9:16': '1440x2560', '16:9': '2560x1440' };
        body.size = sizeMap[size] || size || '1728x2304';
        if (count > 1) {
          body.sequential_image_generation = 'auto';
          body.sequential_image_generation_options = { max_images: Math.min(Number(count) || 1, 8) };
        }
      } else if (provider === 'custom') {
        url = normalizeUrl(baseUrl || 'https://api.openai.com/v1', '/images/generations');
        body = {
          model: model || 'gpt-image-1',
          prompt,
          n: count,
          size: ({ '3:4': '1024x1536', '9:16': '1024x1536', '4:3': '1536x1024', '16:9': '1536x1024', '1:1': '1024x1024' })[size] || size || '1024x1024',
          response_format: 'b64_json',
        };
      } else {
        url = normalizeUrl(baseUrl || 'https://api.minimaxi.com/v1', '/image_generation');
        body = {
          model: model || 'image-01',
          prompt,
          n: count,
          aspect_ratio: size || '3:4',
          response_format: 'base64',
          watermark: false,
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout((Number(aiCfg.AI_TIMEOUT) || 180) * 1000),
        redirect: 'error',
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`图片接口返回 HTTP ${res.status}: ${detail.split(apiKey).join('[已隐藏]').slice(0, 300)}`);
      }
      const data = await res.json();
      let images = [];
      if (Array.isArray(data.data)) {
        // OpenAI 兼容：data 为数组，元素含 b64_json / url / image_url
        images = data.data
          .map((item) => {
            if (item && item.b64_json) return `data:image/png;base64,${item.b64_json}`;
            if (item && (item.url || item.image_url)) return item.url || item.image_url;
            return '';
          })
          .filter(Boolean);
      } else if (data.data && typeof data.data === 'object') {
        // MiniMax：data.image_base64 为 base64 数组
        const d = data.data;
        const raw = Array.isArray(d.image_base64)
          ? d.image_base64
          : typeof d.image_base64 === 'string'
            ? [d.image_base64]
            : [];
        images = raw.map((b) => `data:image/png;base64,${b}`).filter(Boolean);
        if (!images.length && Array.isArray(d.image_urls)) images = d.image_urls.filter(Boolean);
        if (!images.length && Array.isArray(d.urls)) images = d.urls.filter(Boolean);
      }
      if (!images.length) throw new Error('图片接口返回格式不支持');
      return { ok: true, images };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });
  ipcMain.handle('publish-article', async (_e, payload = {}) => {
    try {
      const endpoint = String(payload.endpoint || '').trim();
      if (!endpoint) throw new Error('未配置发布接口，请先在「设置 → 发布与图片接口」中填写');
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(payload.token ? { Authorization: `Bearer ${payload.token}` } : {}),
        },
        body: JSON.stringify({
          platform: payload.platform,
          account: payload.account,
          title: payload.title,
          content: payload.content,
          contentType: payload.contentType || 'html',
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`发布接口返回 HTTP ${res.status}: ${detail.slice(0, 300)}`);
      }
      const text = await res.text().catch(() => '');
      let parsed = {};
      try {
        parsed = text ? JSON.parse(text) : {};
      } catch {
        parsed = { ok: true, raw: text.slice(0, 200) };
      }
      return { ok: true, response: parsed };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });
  const qilingHandlers = {
    'qiling-connect': (_e,p) => qilingService().connect(p.apiKey),
    'qiling-models': () => qilingService().models().then(models=>({models})),
    'qiling-model-select': (_e,p) => qilingService().selectModel(p.model,p),
    'qiling-auth-start': (e,p) => qilingService().startAuth(e.sender.id,p),
    'qiling-auth-poll': e => qilingService().pollAuth(e.sender.id),
    'qiling-auth-cancel': e => qilingService().cancelAuth(e.sender.id),
    'qiling-remove-price': () => qilingService().price(),
    'qiling-remove-get': (_e,p) => ({job:qilingService().getJob(p.id)}),
    'qiling-remove-start': async (e,p) => ({job:await qilingService().startRemove(p,e.sender.id)}),
    'qiling-remove-poll': async (_e,p) => ({job:await qilingService().pollRemove(p.id)}),
    'qiling-remove-pause': (e,p) => ({job:qilingService().pauseRemove(p.id,e.sender.id)}),
    'qiling-remove-resume': (_e,p) => ({job:qilingService().resumeRemove(p.id)}),
    'qiling-remove-adopt': (_e,p) => ({job:qilingService().adoptRemove(p.id)}),
    'qiling-open-account': (_e,p) => qilingService().openAccount(p.page),
  };
  const owners=new Set();
  for(const [channel,handler] of Object.entries(qilingHandlers)) ipcMain.handle(channel,async(e,p={})=>{
    const owner=e.sender.id;
    if(!owners.has(owner)){owners.add(owner);e.sender.once('destroyed',()=>{try{qiling?.stopOwner(owner);}catch{}owners.delete(owner);});}
    try{return {ok:true,...await handler(e,p)};}catch(error){return aiError(error);}
  });
  const generations=new Map();
  const cancelled=new Set();
  const generationKey=(e,id)=>`${e.sender.id}:${id}`;
  const generateCall=async(e,payload,fn)=>{
    const requestId=payload.requestId || require('crypto').randomUUID();
    const key=generationKey(e,requestId);
    if(cancelled.has(key))return aiError(Object.assign(new Error('已停止等待'),{code:'QILING_CANCELLED',retryable:false}));
    if(generations.has(key))return aiError(new Error('同一生成请求正在进行，请勿重复提交'));
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),600000);
    generations.set(key,controller);
    const destroyed=()=>controller.abort();e.sender.once('destroyed',destroyed);
    try{
      return await fn({...callConfig({...payload,requestId}),AI_SIGNAL:controller.signal,AI_ON_PROGRESS:progress=>{if(!e.sender.isDestroyed())e.sender.send('generation-progress',{requestId,...progress});}});
    }catch(error){
      if(controller.signal.aborted)return aiError(Object.assign(new Error('已停止等待或达到本轮时间上限。已提交的请求请先核对使用记录，不会自动重试。'),{code:'QILING_CANCELLED',retryable:false}));
      return aiError(error);
    }finally{clearTimeout(timer);generations.delete(key);if(!e.sender.isDestroyed())e.sender.removeListener('destroyed',destroyed);}
  };
  ipcMain.handle('generation-cancel',(e,payload={})=>{
    if(typeof payload.requestId!=='string'||!payload.requestId)return {ok:false,error:'缺少生成请求号'};
    const key=generationKey(e,payload.requestId);cancelled.add(key);generations.get(key)?.abort();
    return {ok:true};
  });
  ipcMain.handle('llm-chat',async(e,payload={})=>generateCall(e,payload,async cfg=>({ok:true,reply:await chatWithProvider(payload,cfg)})));
  ipcMain.handle('generate-article',async(e,payload={})=>generateCall(e,payload,async cfg=>{
    const result=await runPipeline(payload,cfg);
    return {ok:true,mode:result.mode,chinese:result.chinese,blocks:Array.isArray(result.blocks)?result.blocks:[]};
  }));
  ipcMain.handle('test-ai-config', async (_event, payload = {}) => {
    try {
      if (isQilingUrl(payload.baseUrl)) {
        const key = payload.apiKey || readAiConfig().QILING_API_KEY;
        const models = await require('./qiling-api.cjs').createQilingApi().models(key);
        return {ok:true,reply:'器灵 Key 验证成功',models};
      }
      const cfg = {...aiConfig.testConfig(payload),AI_SERVICE:'custom'};
      return { ok: true, reply: await testConnection({}, cfg) };
    } catch (error) {
      return aiError(error);
    }
  });
  ipcMain.handle('save-ai-config', async (_event, payload = {}) => {
    try {
      if (isQilingUrl(payload.baseUrl)) return {ok:true,...await qilingService().connect(payload.apiKey || readAiConfig().QILING_API_KEY)};
      return aiConfig.saveConfig(payload);
    } catch (error) {
      return aiError(error);
    }
  });
  ipcMain.handle('read-ai-config', () => {
    try {
      return aiConfig.publicConfig();
    } catch (error) {
      return aiError(error);
    }
  });
  ipcMain.handle('read-note', async (_e, payload = {}) => {
    try {
      const note = await fetchXhsNote(payload.url, payload.cookie);
      return { ok: true, note };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });
  ipcMain.handle('download-note-images', async (_e, payload = {}) => {
    try {
      const images = await downloadNoteImages(
        payload.urls,
        payload.cookie,
        payload.referer,
      );
      return { ok: true, images };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });
  ipcMain.handle('download-image', async (_e, payload = {}) => {
    try {
      if (!payload.url) return { ok: false, error: '缺少图片地址' };
      const url = String(payload.url);
      const candidates = [url];
      const bang = url.indexOf('!');
      if (bang > 0) candidates.push(url.slice(0, bang));
      let lastError = '';
      for (const candidate of candidates) {
        try {
          const res = await fetch(candidate, {
            headers: {
              'user-agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
              accept:
                'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            },
            signal: AbortSignal.timeout(20000),
          });
          if (!res.ok) {
            lastError = `HTTP ${res.status}`;
            continue;
          }
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length > 15 * 1024 * 1024) {
            return { ok: false, error: '图片超过 15MB，未导入' };
          }
          const mime =
            (res.headers.get('content-type') || 'image/jpeg').split(';')[0] ||
            'image/jpeg';
          return {
            ok: true,
            dataUrl: `data:${mime};base64,${buf.toString('base64')}`,
          };
        } catch (err) {
          lastError = err.message || String(err);
        }
      }
      return { ok: false, error: lastError || '图片下载失败' };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });
  ipcMain.handle('analyze-note-images', async (_e, payload = {}) => {
    try {
      const result = await analyzeNoteImages(payload.images, readAiConfig());
      return {
        ok: true,
        compositions: result.compositions,
        overallStyle: result.overallStyle,
        items: result.items,
      };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });
  ipcMain.handle('cutout-image', async (_e, payload = {}) => {
    try {
      const cfg = readAiConfig();
      if (payload.ak) cfg.VOLC_ACCESS_KEY = String(payload.ak).trim();
      if (payload.sk) cfg.VOLC_SECRET_KEY = String(payload.sk).trim();
      const result = await cutoutProduct(payload.dataUrl, cfg);
      return { ok: true, dataUrl: result };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });
  ipcMain.handle('platform-login-create', async (_e, payload = {}) => {
    try {
      const normalized = payload.platform === 'xiaohongshu' ? 'xhs' : payload.platform;
      const r = await createLoginSession(normalized);
      return r.ok
        ? { ok: true, session: r.session }
        : { ok: false, error: r.error };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });
  ipcMain.handle('platform-login-poll', async (_e, payload = {}) => {
    try {
      const r = await pollLoginSession(payload.id);
      return { ok: true, ...r };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });
  ipcMain.handle('platform-login-cancel', (_e, payload = {}) => {
    try {
      cancelSession(payload.id);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });
  ipcMain.handle('wechat-sync-accounts', async (_e, payload = {}) => {
    try {
      // 对齐参考项目：同步前先刷新最新 token/cookie，避免用旧 token 请求导致失败
      return await wechatMp.withSession(async () => {
        const auth = await wechatMp.refreshAuth(payload.token, payload.cookie);
        const r = await getPublicAccounts(auth.token, auth.cookies);
        return {
          ok: r.success,
          accounts: r.accounts || [],
          token: auth.token,
          cookies: auth.cookies,
          error: r.error,
        };
      });
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });
  ipcMain.handle('open-account-backend', async (_e, payload = {}) => {
    try {
      const { BrowserWindow, session } = require('electron');
      const platform = payload.platform;
      let url = '';
      let title = '';
      if (platform === 'wechat') {
        url = 'https://mp.weixin.qq.com/';
        title = '微信后台';
      } else if (platform === 'toutiao') {
        url = 'https://mp.toutiao.com/';
        title = '头条号后台';
      } else if (platform === 'baijiahao') {
        url = 'https://baijiahao.baidu.com/';
        title = '百家号后台';
      } else if (platform === 'xiaohongshu') {
        url = 'https://creator.xiaohongshu.com/new/home';
        title = '小红书创作服务平台';
      } else {
        return { ok: false, error: `不支持的平台：${platform}` };
      }
      const cookies = String(payload.cookie || '');
      if (!cookies) return { ok: false, error: '该账号未保存登录信息，请重新登录' };
      const partition = `temp-backend-${platform}-${Date.now()}`;
      const ses = session.fromPartition(partition);
      const pairs = cookies
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const pair of pairs) {
        const eq = pair.indexOf('=');
        if (eq < 1) continue;
        try {
          await ses.cookies.set({
            url,
            name: pair.slice(0, eq).trim(),
            value: pair.slice(eq + 1).trim(),
            path: '/',
          });
        } catch {
          /* ignore */
        }
      }
      const win = new BrowserWindow({
        width: 1200,
        height: 800,
        title,
        icon: path.join(__dirname, 'icon.png'),
        autoHideMenuBar: true,
        backgroundColor: '#ffffff',
        webPreferences: {
          partition,
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: false,
        },
      });
      win.webContents.setUserAgent(wechatMp.platformUa());
      win.loadURL(url);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });
  ipcMain.handle('platform-publish', async (_e, payload = {}) => {
    try {
      const { platform } = payload;
      let cookie = payload.cookie;
      let token = payload.token;
      const fingerprint = payload.fingerprint || wechatMp.DEFAULT_FINGERPRINT;
      const common = {
        title: payload.title,
        content: payload.content,
        cover_image_url: payload.coverImageUrl || '',
        save_draft_only: platform === 'wechat' || payload.saveDraftOnly === true,
        claim_exclusive: payload.claimExclusive,
        content_declaration: payload.contentDeclaration,
        tuwen_wtt_transfer: payload.tuwenWttTransfer,
        bjh_ttv: payload.bjhTtv,
        bjh_ai_tts: payload.bjhAiTts,
        bjh_aigc: payload.bjhAigc,
      };
      if (platform === 'xiaohongshu') {
        if (common.save_draft_only) {
          return { ok: false, error: '小红书暂不支持保存草稿，请选择直接发布' };
        }
        const images = Array.isArray(payload.images) ? payload.images.filter(Boolean) : [];
        if (!images.length) {
          return { ok: false, error: '小红书笔记发布需要至少 1 张图片（贴图）' };
        }
        try {
          const plain = String(common.content || '')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .trim();
          const topics = Array.from(new Set((plain.match(/#[^\s#]+/g) || []).map((t) => t.replace(/^#/, ''))));
          const r = await publishXhsNote({
            cookie: String(cookie || ''),
            title: String(payload.title || ''),
            desc: plain,
            images,
            topics,
            original: payload.xhsOriginal,
            contentDeclaration: payload.xhsContentDeclaration,
          });
          return { ok: true, articleId: r.noteId, link: r.shareLink, method: 'publish' };
        } catch (err) {
          return { ok: false, error: String(err && err.message ? err.message : err) };
        }
      }
      if (platform === 'toutiao') {
        const r = await publishToutiao(cookie, common);
        return { ok: r.success, ...r };
      }
      if (platform === 'baijiahao') {
        const r = await publishBaijiahao(cookie, common);
        return { ok: r.success, ...r };
      }
      if (platform === 'wechat') {
        return await wechatMp.withSession(async () => {
          const username = String(payload.wechatUsername || '').trim();
          const selectTarget = async () => {
            const auth = await wechatMp.refreshSession(
              token, cookie, username || undefined, fingerprint, undefined,
              payload.wechatAccounts, payload.currentUsername,
            );
            if (!auth.success || !auth.cookies) throw new Error(auth.error || '切换公众号登录态失败');
            wechatMp.assertAccount(auth.cookies, username);
            token = auth.token || token;
            cookie = auth.cookies;
          };
          if (username) await selectTarget();
          // 草稿操作后回写本次实际使用的登录态
          let currentToken = token;
          let currentCookie = cookie;
          const postAuth = async (tk, ck) => {
            try {
              const auth = await wechatMp.refreshAuth(tk, ck);
              if (auth.success && auth.cookies && auth.found) {
                return { token: auth.token || tk, cookies: auth.cookies, lastRefresh: auth.lastRefresh };
              }
            } catch {
              /* ignore */
            }
            return { token: tk, cookies: ck, lastRefresh: undefined };
          };
          const draftOpts = {
            username,
            title: common.title,
            content: common.content,
            digest: payload.digest || '',
            cover: payload.coverImageUrl || '',
            postType: payload.postType === 'sticker' ? 'sticker' : 'article',
            images: Array.isArray(payload.images) ? payload.images : [],
            claimSourceType: payload.claimSourceType || 0,
            isUserNoClaim: payload.isUserNoClaim || 0,
            copyrightType: payload.copyrightType || 0,
            sections: payload.sections0 || '',
            composeInfo: payload.composeInfo || '',
          };
          let draft = await wechatMp.createDraft(
            token,
            cookie,
            fingerprint,
            draftOpts,
          );
          if (draft.success && draft.cookies) {
            cookie = draft.cookies;
            currentCookie = draft.cookies;
            currentToken = token;
          }
          if (
            !draft.success &&
            (draft.errorCode === 200003 ||
              /invalid session|invalid csrf|csrf token/i.test(draft.error || ''))
          ) {
            // 会话/CSRF 失效：重新切号续期后重试一次
            await selectTarget();
            currentToken = token;
            currentCookie = cookie;
            draft = await wechatMp.createDraft(token, cookie, fingerprint, draftOpts);
            if (draft.success && draft.cookies) cookie = draft.cookies;
          }
          if (!draft.success) {
            const auth = await postAuth(currentToken, currentCookie);
            return { ok: false, error: draft.error, token: auth.token, cookies: auth.cookies };
          }
          const auth = await postAuth(token, cookie);
          wechatMp.assertAccount(auth.cookies, username);
          return {
            ok: true,
            articleId: draft.appmsgid,
            method: 'draft',
            token: auth.token,
            cookies: auth.cookies,
            currentUsername: username || undefined,
          };
        });
      }
      return { ok: false, error: `不支持的平台：${platform}` };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });
  ipcMain.handle('wechat-refresh-session', async (_e, payload = {}) => {
    try {
      const r = await wechatMp.withSession(() => wechatMp.refreshSession(
        payload.token,
        payload.cookie,
        payload.username,
        payload.fingerprint,
        payload.appid,
        payload.accounts,
        payload.currentUsername,
      ));
      if (r.success) wechatMp.assertAccount(r.cookies, payload.username);
      console.log(
        `[ipc] wechat-refresh-session: target=${payload.username || '(none)'} currentUsername=${r.currentUsername || ''} token=${
          r.token || ''
        } cookiesLen=${String(r.cookies || '').length}`,
      );
      return {
        ok: r.success,
        token: r.token,
        cookies: r.cookies,
        lastRefresh: r.lastRefresh,
        currentUsername: r.currentUsername,
        appid: r.appid,
        error: r.error,
      };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });
  ipcMain.handle('platform-verify', async (_e, payload = {}) => {
    try {
      if (payload.platform === 'wechat') {
        const r = await wechatMp.withSession(() => wechatMp.verifySession(payload.token, payload.cookie));
        return { ok: r.ok, valid: r.valid, error: r.error };
      }
      if (payload.platform === 'toutiao') return await verifyToutiao(payload.cookie);
      if (payload.platform === 'baijiahao') return await verifyBaijiahao(payload.cookie);
      return { ok: false, valid: false, error: `不支持的平台：${payload.platform}` };
    } catch (err) {
      return { ok: false, valid: false, error: String(err && err.message ? err.message : err) };
    }
  });
}

module.exports = { registerIpc };
