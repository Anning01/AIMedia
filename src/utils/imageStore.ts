/**
 * 图片磁盘存储前端工具：
 * - 新增图片统一调用 saveImage 落盘，返回 wgh-image:// 地址
 * - 旧数据（data: 开头的 base64）启动时后台迁移到磁盘
 * - 页面直接显示 wgh-image:// 地址；canvas/裁剪场景用 readImage 转回 dataURL
 */

export type ImageKind = 'library' | 'generated' | 'history';

export const WGH_PREFIX = 'wgh-image://';

export function isDataUrl(src?: string): boolean {
  return !!src && /^data:/i.test(src);
}

export function isWghUrl(src?: string): boolean {
  return !!src && src.startsWith(WGH_PREFIX);
}

export async function saveImage(dataUrl: string, kind: ImageKind): Promise<string> {
  if (!window.wangaohui?.saveImage || !isDataUrl(dataUrl)) return dataUrl;
  const r = await window.wangaohui.saveImage({ dataUrl, kind });
  if (!r?.ok || !r.url) throw new Error(r?.error || '图片保存失败');
  return r.url;
}

export async function readImage(src: string): Promise<string> {
  if (!isWghUrl(src) || !window.wangaohui?.readImage) return src;
  const r = await window.wangaohui.readImage({ src });
  if (!r?.ok || !r.dataUrl) return src;
  return r.dataUrl;
}

/** 把块列表里 data: 开头的图片落盘并替换为 wgh-image:// 地址（失败保留原值） */
export async function saveBlockImages<T extends { src?: string }>(
  blocks: T[],
  kind: ImageKind,
): Promise<T[]> {
  const out: T[] = [];
  for (const b of blocks) {
    if (isDataUrl(b.src)) {
      try {
        out.push({ ...b, src: await saveImage(b.src as string, kind) });
      } catch {
        out.push(b);
      }
    } else {
      out.push(b);
    }
  }
  return out;
}

const MIGRATED_FLAG = 'wangaohui:imagesMigrated';

async function migrateArray(
  key: string,
  walk: (item: Record<string, unknown>) => Promise<boolean>,
): Promise<void> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return;
    let changed = false;
    for (const item of list) {
      if (item && typeof item === 'object') {
        if (await walk(item as Record<string, unknown>)) changed = true;
      }
    }
    if (changed) localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* 迁移失败不影响使用 */
  }
}

/** 启动时把旧 base64 图片迁移到磁盘（一次性，带标记避免重复扫描） */
export async function migrateLocalImages(): Promise<void> {
  try {
    if (localStorage.getItem(MIGRATED_FLAG) || !window.wangaohui?.saveImage) return;

    // 我的图库/图片素材
    await migrateArray('wangaohui:assets', async (a) => {
      if (isDataUrl(a.dataUrl as string | undefined)) {
        try {
          a.dataUrl = await saveImage(a.dataUrl as string, 'library');
          return true;
        } catch {
          return false;
        }
      }
      return false;
    });

    // 文章/贴图生成记录
    await migrateArray('wangaohui:articleHistory', async (item) => {
      let changed = false;
      const blocks = item.blocks as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(blocks)) {
        for (const b of blocks) {
          if (b && b.type === 'image' && isDataUrl(b.src as string | undefined)) {
            try {
              b.src = await saveImage(b.src as string, 'history');
              changed = true;
            } catch {
              /* ignore */
            }
          }
        }
      }
      const images = item.images as string[] | undefined;
      if (Array.isArray(images)) {
        for (let i = 0; i < images.length; i += 1) {
          if (isDataUrl(images[i])) {
            try {
              images[i] = await saveImage(images[i], 'history');
              changed = true;
            } catch {
              /* ignore */
            }
          }
        }
      }
      return changed;
    });

    // 小红书笔记生成记录
    await migrateArray('wangaohui:noteHistory', async (item) => {
      const images = item.images as string[] | undefined;
      if (!Array.isArray(images)) return false;
      let changed = false;
      for (let i = 0; i < images.length; i += 1) {
        if (isDataUrl(images[i])) {
          try {
            images[i] = await saveImage(images[i], 'history');
            changed = true;
          } catch {
            /* ignore */
          }
        }
      }
      return changed;
    });

    // 商品图片
    await migrateArray('wangaohui:products', async (item) => {
      let changed = false;
      for (const field of ['mainImage', 'appearance']) {
        if (isDataUrl(item[field] as string | undefined)) {
          try {
            item[field] = await saveImage(item[field] as string, 'library');
            changed = true;
          } catch {
            /* ignore */
          }
        }
      }
      const scenes = item.sceneImages as string[] | undefined;
      if (Array.isArray(scenes)) {
        for (let i = 0; i < scenes.length; i += 1) {
          if (isDataUrl(scenes[i])) {
            try {
              scenes[i] = await saveImage(scenes[i], 'library');
              changed = true;
            } catch {
              /* ignore */
            }
          }
        }
      }
      return changed;
    });

    // 自定义贴图模板背景图
    await migrateArray('wangaohui:tplCustomStickerTemplates', async (tpl) => {
      let changed = false;
      for (const field of ['bgImage', 'cardBgImage']) {
        if (isDataUrl(tpl[field] as string | undefined)) {
          try {
            tpl[field] = await saveImage(tpl[field] as string, 'generated');
            changed = true;
          } catch {
            /* ignore */
          }
        }
      }
      return changed;
    });

    localStorage.setItem(MIGRATED_FLAG, '1');
  } catch {
    /* 迁移失败不影响使用 */
  }
}
