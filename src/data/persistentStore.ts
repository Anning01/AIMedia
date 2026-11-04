/**
 * 关键业务数据的落盘通道：
 * - 账号 / 素材组 / 图片素材 / 托管任务以磁盘文件为准（{userData}/app-data.json），
 *   不再只依赖渲染进程 localStorage，避免 localStorage 配额爆掉 / 解析失败时数据直接消失
 * - localStorage 保留为兼容层：老用户的数据能读出来并一次性迁移到磁盘
 * - 对外仍是同步读写接口，调用方（localStore.ts）无需改成异步
 */

/** 走磁盘存储的 key（与主进程 app-data.json 里的 key 一一对应） */
export const DISK_KEYS = [
  "accounts",
  "materialGroups",
  "assets",
  "hostTasks",
] as const;
export type DiskKey = (typeof DISK_KEYS)[number];

/** localStorage 里的旧 key 与磁盘 key 的映射 */
const LEGACY_KEYS: Record<DiskKey, string> = {
  accounts: "wangaohui:accounts",
  materialGroups: "wangaohui:materialGroups",
  assets: "wangaohui:assets",
  hostTasks: "wangaohui:hostTasks",
};

type DiskData = Partial<Record<DiskKey, unknown>>;

/** 内存镜像：渲染进程里所有读写都先经过这里，保证同步语义 */
let cache: DiskData = {};
/** 主进程返回的数据是否可用（IPC 不可用时降级为纯 localStorage） */
let diskReady = false;
/** 是否已经做过初始化，避免重复迁移 */
let initialized = false;

interface AppDataBridge {
  appDataRead?: () => {
    ok: boolean;
    data?: Record<string, unknown>;
    corrupted?: boolean;
  };
  appDataWrite?: (data: Record<string, unknown>) => Promise<{
    ok: boolean;
    error?: string;
  }>;
}

function bridge(): AppDataBridge | undefined {
  return (window as unknown as { wangaohui?: AppDataBridge }).wangaohui;
}

/**
 * 从 localStorage 读旧数据。
 * corrupted=true 表示这条数据本身解析失败（不是"没有数据"），
 * 上层要区分这两种情况，不能把损坏伪装成空列表。
 */
function readLegacy<T>(key: string): { value: T | null; corrupted: boolean } {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === "") return { value: null, corrupted: false };
    return { value: JSON.parse(raw) as T, corrupted: false };
  } catch {
    return { value: null, corrupted: true };
  }
}

/**
 * 把 localStorage 里的旧数据迁移到磁盘（老用户不丢数据）。
 * 磁盘已经有数据时以磁盘为准；若磁盘是空列表且旧存储有数据，或磁盘缺失该 key 时用旧数据补齐。
 */
function migrateLegacy(): boolean {
  let changed = false;
  for (const key of DISK_KEYS) {
    const legacy = readLegacy<unknown>(LEGACY_KEYS[key]);
    if (legacy.corrupted) continue;
    if (legacy.value === null || legacy.value === undefined) continue;
    const diskValue = cache[key];
    if (diskValue !== undefined && diskValue !== null) {
      // 磁盘为空列表但老 localStorage 有数据时，优先迁移老数据
      if (
        Array.isArray(diskValue) &&
        diskValue.length === 0 &&
        Array.isArray(legacy.value) &&
        legacy.value.length > 0
      ) {
        cache[key] = legacy.value;
        changed = true;
      }
      continue;
    }
    cache[key] = legacy.value;
    changed = true;
  }
  return changed;
}

let flushing: Promise<void> | null = null;
let pendingFlush = false;

async function doFlush(): Promise<void> {
  const api = bridge();
  if (diskReady === false || api?.appDataWrite === undefined) return;
  const payload: Record<string, unknown> = {};
  for (const key of DISK_KEYS) {
    const value = cache[key];
    if (value !== undefined) payload[key] = value;
  }
  try {
    await api.appDataWrite(payload);
  } catch {
    // 落盘失败不阻塞界面，内存数据仍在，下次写入会重试
  }
}

/** 把内存镜像写回磁盘（整体覆盖这些 key，并进行串行排队避免并发竞态） */
async function flush(): Promise<void> {
  if (flushing) {
    pendingFlush = true;
    return;
  }
  flushing = doFlush().finally(() => {
    flushing = null;
    if (pendingFlush) {
      pendingFlush = false;
      void flush();
    }
  });
}

/**
 * 初始化：同步读取磁盘数据，并把 localStorage 里的旧数据合并进来。
 * 必须在应用启动时（渲染进程加载前）调用一次。
 */
export function initPersistentStore(): void {
  if (initialized) return;
  initialized = true;
  const api = bridge();
  if (api?.appDataRead === undefined) {
    diskReady = false;
    migrateLegacy();
    return;
  }
  try {
    const result = api.appDataRead();
    if (result?.ok && result.data) {
      cache = { ...cache, ...(result.data as DiskData) };
      diskReady = true;
    }
  } catch {
    diskReady = false;
  }
  // 老用户数据迁移：磁盘没有的，从 localStorage 补齐并回写磁盘
  if (migrateLegacy() && diskReady) {
    void flush();
  }
}

/** 读取走磁盘存储的数据（同步） */
export function readDisk<T>(key: DiskKey, fallback: T): T {
  if (!initialized) initPersistentStore();
  const value = cache[key];
  if (value === undefined || value === null) return fallback;
  return value as T;
}

/**
 * 写入走磁盘存储的数据（同步更新内存，异步落盘）。
 * 返回是否写入了内存，保证调用方能立刻读到新值。
 */
export function writeDisk(key: DiskKey, value: unknown): void {
  if (!initialized) initPersistentStore();
  cache[key] = value;
  void flush();
}

/** 数据是否已经来自磁盘（false 表示当前跑在浏览器调试环境） */
export function isDiskStoreReady(): boolean {
  return diskReady;
}

/**
 * 从 localStorage 读旧数据（兼容层）。
 * 解析失败返回 fallback，并保留原始内容以便排查。
 */
export function readLegacyValue<T>(key: string, fallback: T): T {
  const legacy = readLegacy<T>(key);
  if (legacy.corrupted) {
    try {
      localStorage.setItem(`${key}:corrupted`, localStorage.getItem(key) || "");
    } catch {
      // 保留失败也不影响使用
    }
    return fallback;
  }
  if (legacy.value === null || legacy.value === undefined) return fallback;
  return legacy.value;
}
