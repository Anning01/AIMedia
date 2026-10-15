import { listAssets,uid } from "@/data/localStore";
import { fetchImages } from "@/utils/resourceApi";

export const WECHAT_PLATFORM = "微信24小时热榜";

export function nowTime(): string {
  return new Date().toLocaleTimeString("zh-CN", { hour12: false });
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function isStickerHeading(text: string): boolean {
  const s = text.trim();
  return s.length > 0 && s.length <= 22 && !/[。！？；：…]$/.test(s);
}

export function buildStickerCards(
  lines: string[],
): Array<{ heading: string; text: string }> {
  const cards: Array<{ heading: string; text: string }> = [];
  for (let i = 0; i < lines.length; i += 1) {
    const cur = lines[i].trim();
    if (!cur) continue;
    if (isStickerHeading(cur)) {
      const nxt = i + 1 < lines.length ? lines[i + 1].trim() : "";
      if (nxt && !isStickerHeading(nxt)) {
        cards.push({ heading: cur, text: nxt });
        i += 1;
      } else {
        cards.push({ heading: cur, text: "" });
      }
    } else {
      cards.push({ heading: "", text: cur });
    }
  }
  return cards;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(finish));
    setTimeout(finish, 500);
  });
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i += 1) {
    try {
      return await fn();
    } catch (err) {
      if (err && typeof err === "object" && "retryable" in err && err.retryable === false) throw err;
      lastErr = err;
      if (i < retries) await sleep(1200 * (i + 1));
    }
  }
  throw lastErr;
}

export function firstRunAt(startTime: string): string {
  const [h, m] = (startTime || "09:00")
    .split(":")
    .map((x) => parseInt(x, 10) || 0);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d.toISOString();
}

export function nextDayAt(startTime: string): string {
  const [h, m] = (startTime || "09:00")
    .split(":")
    .map((x) => parseInt(x, 10) || 0);
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

export function parseTopicAnchors(topicText: string): string {
  return (topicText.match(/#[^\s#]+/g) || [])
    .map((t) => {
      const ts = Date.now().toString(36);
      const rand = Math.random().toString(36).slice(2, 8).padEnd(6, "0");
      return `<a class="wx_topic_link" topic-id="${ts}-${rand}" style="color: #576B95 !important;" data-topic="1" data-recommend="">${t}</a>`;
    })
    .join(" ");
}

export function keywordsOf(text: string): string[] {
  const words = text.match(/[\u4e00-\u9fa5]{2,6}/g) || [];
  const freq = new Map<string, number>();
  for (const w of words) {
    if (
      [
        "我们",
        "一个",
        "什么",
        "可以",
        "自己",
        "因为",
        "所以",
        "但是",
        "没有",
        "不是",
        "这个",
        "那个",
      ].includes(w)
    )
      continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w);
}

export async function pickImages(
  source: "auto" | "library",
  count: number,
  text: string,
): Promise<string[]> {
  const need = Math.max(1, Math.min(3, count || 1));
  const kws = keywordsOf(text);
  const RECENT_KEY = "wangaohui:recentImages";
  const loadRecent = (): string[] => {
    try {
      const v = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  };
  const saveRecent = (urls: string[]) => {
    try {
      const next = [...new Set([...urls, ...loadRecent()])].slice(0, 20);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };
  const randomPick = (list: Array<{ src: string }>, n: number): string[] => {
    const pool = [...list];
    const out: string[] = [];
    while (out.length < n && pool.length) {
      const idx = Math.floor(Math.random() * pool.length);
      out.push(pool.splice(idx, 1)[0].src);
    }
    return out;
  };

  if (source === "library") {
    const own = listAssets()
      .filter((a) => a.kind === "图片" && (a.dataUrl || a.sourceUrl))
      .map((a) => ({
        src: a.dataUrl || a.sourceUrl || "",
        tags: a.tags || [],
      }));
    const recent = new Set(loadRecent());
    const available = own.filter((a) => !recent.has(a.src));
    const hit = own.filter((a) =>
      a.tags.some((t) => kws.some((k) => t.includes(k) || k.includes(t))),
    );
    const hitAvail = hit.filter((a) => !recent.has(a.src));
    const picked = [
      ...randomPick(hitAvail, need),
      ...randomPick(
        available.filter((a) => !hitAvail.includes(a)),
        need,
      ),
    ].slice(0, need);
    if (picked.length) saveRecent(picked);
    return picked;
  }
  try {
    const r = await fetchImages({ ai_tagged: true, page: 1, page_size: 60 });
    const all = (r.data || []).map((a) => ({
      src: a.url || "",
      tags: (a.tags || []).map((t: string) => t),
    }));
    const recent = new Set(loadRecent());
    const available = all.filter((a) => !recent.has(a.src));
    const hit = all.filter((a) =>
      a.tags.some((t) => kws.some((k) => t.includes(k) || k.includes(t))),
    );
    const hitAvail = hit.filter((a) => !recent.has(a.src));
    const picked = [
      ...randomPick(hitAvail, need),
      ...randomPick(
        available.filter((a) => !hitAvail.includes(a)),
        need,
      ),
    ].slice(0, need);
    if (picked.length) saveRecent(picked);
    return picked;
  } catch {
    return [];
  }
}

export function insertImages(
  blocks: Array<{
    id: string;
    type: string;
    text?: string;
    items?: string[];
    src?: string;
  }>,
  images: string[],
): void {
  if (!images.length) return;
  const flowIdx = blocks
    .map((b, i) => ({ b, i }))
    .filter((x) =>
      ["p", "quote", "card", "tip", "list", "h2"].includes(x.b.type),
    )
    .map((x) => x.i);
  const anchor = flowIdx.length
    ? flowIdx[Math.floor(flowIdx.length / 2)]
    : blocks.length;
  images.forEach((src, k) => {
    blocks.splice(anchor + k, 0, { id: uid("b"), type: "image", src });
  });
}
