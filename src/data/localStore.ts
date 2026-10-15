/**
 * 万稿汇本地数据层：草稿、发布队列、账号、任务、素材库、用量记录。
 * 所有按钮写入这里，页面从同一份数据读取，杜绝“假成功”提示。
 */

export interface DraftItem {
  id: string;
  platform: '公众号' | '小红书';
  title: string;
  content: string;
  html?: string;
  templateId?: string;
  status: '草稿' | '待发布' | '已发布';
  createdAt: string;
}

export interface QueueItem {
  id: string;
  platform: string;
  account: string;
  title: string;
  status: '待发布' | '已发布' | '失败' | '已存草稿';
  error?: string;
  scheduledAt?: string;
  createdAt: string;
}

export interface AccountItem {
  id: string;
  platform: string;
  name: string;
  authed: boolean;
  userId?: string;
  avatar?: string;
  token?: string;
  fingerprint?: string;
  lastRefresh?: string;
  currentUsername?: string;
  remark?: string;
  claimExclusive?: boolean;
  contentDeclaration?: string;
  bjhTtv?: boolean;
  bjhAiTts?: boolean;
  bjhAigc?: boolean;
  bjhAutoGoods?: boolean;
  xhsOriginal?: 'none' | 'original' | 'repost';
  xhsContentDeclaration?: string;
  appId?: string;
  secret?: string;
  cookie?: string;
  note?: string;
  wechatAccounts?: Array<{
    username: string;
    nickname: string;
    bizuin?: string;
    headImg?: string;
    acctType?: number;
    appid?: string;
    kind?: 'mp' | 'wxa';
    enabled?: boolean;
    token?: string;
    cookies?: string;
    contentDeclaration?: string;
    copyrightType?: number;
  }>;
  createdAt: string;
}

export interface TaskItem {
  id: number;
  name: string;
  source: string;
  freq: string;
  output: string;
  target: string;
  nextRun: string;
  status: '运行中' | '已暂停' | '待运行' | '执行中';
  log: string[];
  createdAt: string;
}

export type MaterialStatus = 'pending' | 'using' | 'used' | 'failed';

export interface MaterialItem {
  id: string;
  title: string;
  content: string;
  isOutline?: boolean;
  status: MaterialStatus;
  createdAt: string;
  usedAt?: string;
}

export interface MaterialGroup {
  id: string;
  name: string;
  platform?: string;
  contentType?: 'article' | 'sticker';
  source: 'txt' | 'ai';
  accountNote?: string;
  materials: MaterialItem[];
  createdAt: string;
}

export type HostSourceType = 'hot' | 'wechat' | 'material';

export interface HostTaskItem {
  id: string;
  name: string;
  accountId: string;
  platform: string;
  wechatUsername?: string;
  contentType: 'article' | 'sticker';
  promptSetId?: string;
  sourceType: HostSourceType;
  sourceKey: string;
  templateId: string;
  accent?: string;
  imageSource: 'auto' | 'library';
  imageCount: number;
  perRunCount: number;
  frequency: 'once' | 'daily';
  startTime: string;
  intervalMinutes: number;
  publishMode: 'draft' | 'publish';
  retry: boolean;
  enabled: boolean;
  status: '运行中' | '已暂停' | '待运行' | '执行中' | '已完成';
  nextRunAt: string;
  lastRunAt?: string;
  periodKey?: string;
  doneCount?: number;
  log: string[];
  createdAt: string;
}

export interface ConsumedRecord {
  id: string;
  taskId: string;
  sourceType: HostSourceType;
  itemKey: string;
  status: 'done' | 'failed';
  createdAt: string;
}

export interface AssetItem {
  id: string;
  kind: '设计' | '图片';
  name: string;
  dataUrl?: string;
  sourceUrl?: string;
  design?: unknown;
  tags?: string[];
  createdAt: string;
}

export interface ProductItem {
  id: string;
  name: string;
  points: string;
  audience: string;
  price: number;
  mainImage?: string;
  sceneImages?: string[];
  appearance?: string;
  createdAt: string;
}

export interface StyleAssetItem {
  id: string;
  name: string;
  sourceTitle: string;
  sourceLink: string;
  angle: string;
  titleFormula: string;
  style: string;
  composition: string;
  compositions?: string[];
  visionMeta?: Array<{
    suggestSlot?: string;
    borrow?: string;
    mustReplace?: string;
  }>;
  refImages?: string[];
  overallStyle?: string;
  structure: string[];
  emotionWords: string[];
  tags: string[];
  createdAt: string;
}

export interface NoteHistoryItem {
  id: string;
  title: string;
  paras: string[];
  tags: string[];
  productId: string;
  productName: string;
  sourceTitle?: string;
  sourceLink?: string;
  images: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UsageRecord {
  type: '文章' | '笔记' | '贴图' | '发布';
  time: string;
}

export interface StoredBlock {
  id: string;
  type: string;
  text?: string;
  items?: string[];
  src?: string;
}

export interface ArticleHistoryItem {
  id: string;
  title: string;
  time: string;
  tag: string;
  templateId?: string;
  blocks: StoredBlock[];
  kind?: 'article' | 'sticker';
  images?: string[];
  text?: string;
  status?: '待发布' | '已发布' | '已存草稿' | '发布失败';
  error?: string;
}

const KEYS = {
  drafts: 'wangaohui:drafts',
  queue: 'wangaohui:publishQueue',
  accounts: 'wangaohui:accounts',
  tasks: 'wangaohui:tasks',
  assets: 'wangaohui:assets',
  usage: 'wangaohui:usage',
  articleHistory: 'wangaohui:articleHistory',
  noteHistory: 'wangaohui:noteHistory',
  settings: 'wangaohui:appSettings',
  products: 'wangaohui:products',
  styleAssets: 'wangaohui:styleAssets',
  materialGroups: 'wangaohui:materialGroups',
  hostTasks: 'wangaohui:hostTasks',
  consumed: 'wangaohui:consumed',
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function uid(prefix = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function listDrafts(): DraftItem[] {
  return read<DraftItem[]>(KEYS.drafts, []);
}

export function saveDraft(d: DraftItem): DraftItem[] {
  const list = listDrafts();
  const idx = list.findIndex((x) => x.id === d.id);
  if (idx >= 0) list[idx] = d;
  else list.unshift(d);
  write(KEYS.drafts, list);
  return list;
}

export function removeDraft(id: string): DraftItem[] {
  const list = listDrafts().filter((x) => x.id !== id);
  write(KEYS.drafts, list);
  return list;
}

export function listQueue(): QueueItem[] {
  return read<QueueItem[]>(KEYS.queue, []);
}

export function saveQueueItem(q: QueueItem): QueueItem[] {
  const list = listQueue();
  const idx = list.findIndex((x) => x.id === q.id);
  if (idx >= 0) list[idx] = q;
  else list.unshift(q);
  write(KEYS.queue, list);
  return list;
}

export function removeQueueItem(id: string): QueueItem[] {
  const list = listQueue().filter((x) => x.id !== id);
  write(KEYS.queue, list);
  return list;
}

export function listAccounts(): AccountItem[] {
  return read<AccountItem[]>(KEYS.accounts, []);
}

export function saveAccount(a: AccountItem): AccountItem[] {
  const list = listAccounts();
  const idx = list.findIndex((x) => x.id === a.id);
  if (idx >= 0) list[idx] = a;
  else list.push(a);
  write(KEYS.accounts, list);
  return list;
}

export function removeAccount(id: string): AccountItem[] {
  const list = listAccounts().filter((x) => x.id !== id);
  write(KEYS.accounts, list);
  return list;
}

// 对齐参考项目 _resolvePublishContext：当前激活账号用主账号 token/cookie，
// 否则优先用该公众号子账号自己保存的 token/cookie（没有则回退主账号）
export function resolveWechatAuth(
  a: AccountItem,
  _username: string,
): { token?: string; cookie?: string } {
  // 对齐参考项目 _switchAccountAndPersist：切换/发布始终用主账号（微信登录会话）的 token/cookie，
  // 不能用公众号子账号自己存的旧凭证，否则切第二个号会带旧 token/cookie 报 invalid session
  return {
    token: a.token,
    cookie: a.cookie,
  };
}

// 对齐参考项目 _refreshCurrentSessionAuth：切换/发布后把最新 token/cookie
// 同时写回主账号（wechat_accounts）和目标公众号子账号（public_accounts）
export function saveWechatSession(
  a: AccountItem,
  username: string,
  token?: string,
  cookies?: string,
  currentUsername?: string,
): AccountItem[] {
  const next: AccountItem = {
    ...a,
    token: token || a.token,
    cookie: cookies || a.cookie,
    currentUsername: currentUsername || username,
    wechatAccounts: (a.wechatAccounts || []).map((w) =>
      w.username === username
        ? {
            ...w,
            token: token || w.token,
            cookies: cookies || w.cookies,
          }
        : w,
    ),
  };
  return saveAccount(next);
}

// 同步/登录时合并公众号子账号设置：保留用户已配置的启用、原创、创作声明，
// 只更新同步回来的账号信息和当前凭证
export function mergeWechatAccounts(
  prev: AccountItem['wechatAccounts'],
  next: AccountItem['wechatAccounts'],
): NonNullable<AccountItem['wechatAccounts']> {
  return (next || []).map((w) => {
    const old = (prev || []).find((x) => x.username === w.username);
    return {
      ...w,
      enabled: old ? old.enabled !== false : true,
      contentDeclaration: old?.contentDeclaration,
      copyrightType: old?.copyrightType,
      token: w.token || old?.token,
      cookies: w.cookies || old?.cookies,
    };
  });
}

export function listTasks(): TaskItem[] {
  return read<TaskItem[]>(KEYS.tasks, []);
}

export function saveTasks(list: TaskItem[]): void {
  write(KEYS.tasks, list);
}

export function listMaterialGroups(): MaterialGroup[] {
  return read<MaterialGroup[]>(KEYS.materialGroups, []);
}

export function saveMaterialGroups(list: MaterialGroup[]): void {
  write(KEYS.materialGroups, list);
}

export function upsertMaterialGroup(g: MaterialGroup): MaterialGroup[] {
  const list = listMaterialGroups();
  const idx = list.findIndex((x) => x.id === g.id);
  if (idx >= 0) list[idx] = g;
  else list.unshift(g);
  write(KEYS.materialGroups, list);
  return list;
}

export function removeMaterialGroup(id: string): MaterialGroup[] {
  const list = listMaterialGroups().filter((x) => x.id !== id);
  write(KEYS.materialGroups, list);
  return list;
}

export function updateMaterial(
  groupId: string,
  materialId: string,
  patch: Partial<MaterialItem>,
): MaterialGroup[] {
  const list = listMaterialGroups().map((g) =>
    g.id === groupId
      ? {
          ...g,
          materials: g.materials.map((m) => (m.id === materialId ? { ...m, ...patch } : m)),
        }
      : g,
  );
  write(KEYS.materialGroups, list);
  return list;
}

export function listHostTasks(): HostTaskItem[] {
  return read<HostTaskItem[]>(KEYS.hostTasks, []);
}

export function saveHostTasks(list: HostTaskItem[]): void {
  write(KEYS.hostTasks, list);
}

export function listConsumed(): ConsumedRecord[] {
  return read<ConsumedRecord[]>(KEYS.consumed, []);
}

export function addConsumed(r: ConsumedRecord): ConsumedRecord[] {
  const list = listConsumed();
  list.unshift(r);
  write(KEYS.consumed, list.slice(0, 5000));
  return list;
}

export function updateConsumed(id: string, patch: Partial<ConsumedRecord>): ConsumedRecord[] {
  const list = listConsumed();
  const idx = list.findIndex((x) => x.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...patch };
    write(KEYS.consumed, list.slice(0, 5000));
  }
  return list;
}

export function listAssets(): AssetItem[] {
  return read<AssetItem[]>(KEYS.assets, []);
}

export function saveAsset(a: AssetItem): AssetItem[] {
  let list = listAssets();
  list.unshift(a);
  list = list.slice(0, 60);
  // 写入失败（超配额）时逐步丢最旧记录重试；单条也写不进才放弃
  while (list.length > 0) {
    try {
      write(KEYS.assets, list);
      return list;
    } catch {
      list = list.slice(0, -1);
    }
  }
  return list;
}

export function updateAsset(id: string, patch: Partial<AssetItem>): AssetItem[] {
  const list = listAssets().map((a) => (a.id === id ? { ...a, ...patch } : a));
  try {
    write(KEYS.assets, list);
  } catch {
    /* 超出配额时保留原数据 */
  }
  return list;
}

export function removeAsset(id: string): AssetItem[] {
  const list = listAssets().filter((a) => a.id !== id);
  write(KEYS.assets, list);
  return list;
}

export function removeAssets(ids: string[]): AssetItem[] {
  const set = new Set(ids);
  const list = listAssets().filter((a) => !set.has(a.id));
  write(KEYS.assets, list);
  return list;
}

export function listProducts(): ProductItem[] {
  return read<ProductItem[]>(KEYS.products, []);
}

export function saveProduct(p: ProductItem): ProductItem[] {
  const list = listProducts();
  const idx = list.findIndex((x) => x.id === p.id);
  if (idx >= 0) list[idx] = p;
  else list.unshift(p);
  write(KEYS.products, list);
  return list;
}

export function removeProduct(id: string): ProductItem[] {
  const list = listProducts().filter((x) => x.id !== id);
  write(KEYS.products, list);
  return list;
}

export function listNoteHistory(): NoteHistoryItem[] {
  const list = read<NoteHistoryItem[]>(KEYS.noteHistory, []);
  return list.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

export function saveNoteHistory(item: NoteHistoryItem): NoteHistoryItem[] {
  let list = listNoteHistory();
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx >= 0) list[idx] = item;
  else list.unshift(item);
  // 最多保留 12 条，避免图片把 localStorage 撑爆
  list = list.slice(0, 12);
  // 写入失败（超配额）时逐步丢弃最旧记录重试
  while (list.length > 1) {
    try {
      write(KEYS.noteHistory, list);
      return list;
    } catch {
      list = list.slice(0, -1);
    }
  }
  // 单条也写不进：去掉图片兜底，只保留文案
  try {
    const slim = { ...list[0], images: [] };
    write(KEYS.noteHistory, [slim]);
    return [slim];
  } catch {
    return list;
  }
}

export function removeNoteHistory(id: string): NoteHistoryItem[] {
  const list = listNoteHistory().filter((x) => x.id !== id);
  write(KEYS.noteHistory, list);
  return list;
}

export function listStyleAssets(): StyleAssetItem[] {
  return read<StyleAssetItem[]>(KEYS.styleAssets, []);
}

export function saveStyleAsset(s: StyleAssetItem): StyleAssetItem[] {
  const list = listStyleAssets();
  const idx = list.findIndex((x) => x.id === s.id);
  if (idx >= 0) list[idx] = s;
  else list.unshift(s);
  write(KEYS.styleAssets, list);
  return list;
}

export function removeStyleAsset(id: string): StyleAssetItem[] {
  const list = listStyleAssets().filter((x) => x.id !== id);
  write(KEYS.styleAssets, list);
  return list;
}

export function listUsage(): UsageRecord[] {
  return read<UsageRecord[]>(KEYS.usage, []);
}

export function addUsage(type: UsageRecord['type']): UsageRecord[] {
  const list = listUsage();
  list.unshift({ type, time: nowIso() });
  write(KEYS.usage, list.slice(0, 500));
  return list;
}

export function countToday(type: UsageRecord['type']): number {
  const today = new Date().toDateString();
  return listUsage().filter((u) => u.type === type && new Date(u.time).toDateString() === today).length;
}

export function countThisMonth(type: UsageRecord['type']): number {
  const now = new Date();
  return listUsage().filter((u) => {
    const d = new Date(u.time);
    return u.type === type && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
}

export function loadArticleHistory(): ArticleHistoryItem[] {
  return read<ArticleHistoryItem[]>(KEYS.articleHistory, []);
}

export function saveArticleHistoryItem(item: ArticleHistoryItem): ArticleHistoryItem[] {
  const list = [item, ...loadArticleHistory().filter(previous => previous.id !== item.id)];
  write(KEYS.articleHistory, list);
  return list;
}

export function clearArticleHistory(): ArticleHistoryItem[] {
  write(KEYS.articleHistory, []);
  return [];
}

export function updateArticleHistoryStatus(
  title: string,
  status: NonNullable<ArticleHistoryItem['status']>,
  error?: string,
  id?: string,
): ArticleHistoryItem[] {
  const list = loadArticleHistory();
  let changed = false;
  const next = list.map((h) => {
    if (id ? h.id === id : h.title === title) {
      changed = true;
      return { ...h, status, error };
    }
    return h;
  });
  if (changed) write(KEYS.articleHistory, next);
  return next;
}

export function removeArticleHistory(id: string): ArticleHistoryItem[] {
  const list = loadArticleHistory().filter((x) => x.id !== id);
  write(KEYS.articleHistory, list);
  return list;
}

export interface AppSettings {
  autostart: boolean;
  dataDir: string;
  language: string;
  publishEndpoint: string;
  publishToken: string;
  imageGenProvider: string;
  imageGenKey: string;
  imageGenBaseUrl: string;
  imageGenModel: string;
  imageStyle: string;
  noteImageGenProvider: string;
  noteImageGenKey: string;
  noteImageGenBaseUrl: string;
  noteImageGenModel: string;
  noteCutoutAk: string;
  noteCutoutSk: string;
}

export function loadAppSettings(): AppSettings {
  const defaults: AppSettings = {
    autostart: false,
    dataDir: 'D:\\wangaohui-data',
    language: '简体中文',
    publishEndpoint: '',
    publishToken: '',
    imageGenProvider: 'minimax',
    imageGenKey: '',
    imageGenBaseUrl: '',
    imageGenModel: 'image-01',
    imageStyle: 'cinema',
    noteImageGenProvider: 'seedream',
    noteImageGenKey: '',
    noteImageGenBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3/images/generations',
    noteImageGenModel: 'doubao-seedream-4-5-251128',
    noteCutoutAk: '',
    noteCutoutSk: '',
  };
  const s = read<AppSettings>(KEYS.settings, defaults);
  // 一次性迁移：旧默认 4.0 自动升级到 4.5（构图/中文文字更强）
  if (s.noteImageGenModel === 'doubao-seedream-4-0-250828') {
    s.noteImageGenModel = 'doubao-seedream-4-5-251128';
    write(KEYS.settings, s);
  }
  return s;
}

export function saveAppSettings(s: AppSettings): void {
  write(KEYS.settings, s);
}
