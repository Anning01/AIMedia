import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { readFile, mkdir, writeFile, realpath } from "node:fs/promises";
import { join, relative, isAbsolute } from "node:path";
import ipaddr from "ipaddr.js";
import { Store, id } from "./store.js";
import { type Row, type Asset, errorMessage } from "./types.js";

export const IMAGE_LIMIT = 20 * 1024 * 1024;
const imageExtensions: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};
export function httpUrl(value: unknown): string | null {
  try {
    const u = new URL(String(value ?? "").trim());
    return ["http:", "https:"].includes(u.protocol) &&
      !u.username &&
      !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export async function resolvePublic(url: string, options: {
  lookup?: (hostname: string) => Promise<Array<{ address: string; family: number }>>;
  request?: typeof fetch;
  signal?: AbortSignal;
} = {}) {
  if (!httpUrl(url)) throw new Error("仅支持公网 HTTP(S) 媒体地址");
  const target = new URL(url),
    hostname = target.hostname.replace(/^\[|\]$/g, "");
  let addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await (options.lookup ?? ((host) => lookup(host, { all: true })))(hostname);
  // TUN proxies can synthesize 198.18.0.0/15 DNS answers. Resolve the public
  // destination over TLS in that specific case, then validate and pin its real
  // IP as usual. Never connect to the fake/private address or weaken SSRF checks.
  if (!isIP(hostname) && addresses.length && addresses.every(({ address }) => ipaddr.process(address).range() === "reserved" && /^198\.(18|19)\./.test(address))) {
    const endpoint = new URL("https://cloudflare-dns.com/dns-query");
    endpoint.searchParams.set("name", hostname);
    endpoint.searchParams.set("type", "A");
    const response = await (options.request ?? fetch)(endpoint, {
      headers: { Accept: "application/dns-json" },
      redirect: "error",
      signal: options.signal ?? AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("公网 DNS 解析失败");
    const data = await response.json() as Row;
    addresses = data.Status === 0 && Array.isArray(data.Answer)
      ? data.Answer.filter((item: Row) => item.type === 1 && isIP(item.data) === 4).map((item: Row) => ({ address: item.data, family: 4 }))
      : [];
  }
  if (
    !addresses.length ||
    addresses.some(
      ({ address }) => ipaddr.process(address).range() !== "unicast",
    )
  )
    throw new Error("不允许访问内网或本机媒体地址");
  return { target, address: addresses[0] };
}
async function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let rejectAbort: (reason: unknown) => void = () => {};
  const onAbort = () => rejectAbort(signal.reason);
  const cancelled = new Promise<never>((_, reject) => {
    rejectAbort = reject;
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return await Promise.race([work, cancelled]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}
export function imageMime(bytes: Buffer): string | undefined {
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return "image/jpeg";
  if (/^GIF8[79]a/.test(bytes.subarray(0, 6).toString())) return "image/gif";
  if (
    bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WEBP"
  )
    return "image/webp";
  return undefined;
}
export async function downloadImage(
  url: string,
  referer?: string,
  signal = AbortSignal.timeout(15_000),
  network: { resolve?: typeof resolvePublic; request?: typeof http.get } = {},
): Promise<{ bytes: Buffer; mime: string }> {
  let current = url;
  for (let i = 0; i < 4; i++) {
    const { target, address } = await abortable((network.resolve ?? resolvePublic)(current, { signal }), signal);
    signal.throwIfAborted();
    const result = await new Promise<{
      location?: string;
      bytes: Buffer;
      mime: string;
    }>((resolve, reject) => {
      const req = (network.request ?? (target.protocol === "https:" ? https : http).get)(
        target,
        {
          agent: false,
          family: address.family,
          signal,
          headers: {
            "User-Agent": "AI-Media/0.4",
            Referer: referer ?? current,
          },
          // Pin the validated address, retaining the original hostname for TLS/SNI.
          lookup: (_hostname, _options, callback) =>
            callback(null, address.address, address.family),
        },
        (res) => {
          if ([301, 302, 303, 307, 308].includes(res.statusCode ?? 0)) {
            const location = res.headers.location;
            res.resume();
            if (!location) reject(new Error("媒体跳转地址为空"));
            else resolve({ location, bytes: Buffer.alloc(0), mime: "" });
            return;
          }
          const mime = (res.headers["content-type"] ?? "")
            .split(";")[0]
            .trim()
            .toLowerCase();
          if (
            (res.statusCode ?? 500) >= 400 ||
            !imageExtensions[mime] ||
            Number(res.headers["content-length"] ?? 0) > IMAGE_LIMIT
          ) {
            res.destroy();
            reject(new Error("远程图片类型、大小或响应状态不符合要求"));
            return;
          }
          const chunks: Buffer[] = [];
          let length = 0;
          res.on("data", (chunk: Buffer) => {
            length += chunk.length;
            if (length > IMAGE_LIMIT) res.destroy(new Error("图片超过 20 MB"));
            else chunks.push(chunk);
          });
          res.on("error", reject);
          res.on("end", () => {
            const bytes = Buffer.concat(chunks);
            if (imageMime(bytes) !== mime)
              reject(new Error("图片文件内容与类型不符"));
            else resolve({ bytes, mime });
          });
        },
      );
      req.on("error", reject);
    });
    if (result.location) {
      current = new URL(result.location, current).href;
      continue;
    }
    return result;
  }
  throw new Error("媒体重定向次数过多");
}
export interface SourceItem extends Row {
  media_type: "image" | "video";
  source_url: string;
  alt_text: string;
  paragraph_index: number | null;
  source_order: number;
}
export function normalizeArticle(article: Row) {
  const integer = (value: unknown, fallback: number | null) =>
    (typeof value === "number" || (typeof value === "string" && value.trim() !== "")) && Number.isFinite(Number(value))
      ? Math.trunc(Number(value)) : fallback;
  const mediaFields = new Set(["src", "url", "source", "download_url", "alt", "title", "caption", "poster", "width", "height", "duration", "paragraphIndex", "paragraph_index", "position", "type", "media_type"]);
  const first = (keys: string[], fallback: unknown) =>
    keys
      .map((k) => article[k])
      .find((v) => v != null && v !== "" && (!Array.isArray(v) || v.length)) ??
    fallback;
  const raw = first(
    ["contentList", "content", "contents", "paragraphs", "body", "text"],
    [],
  );
  const paragraphs = (Array.isArray(raw) ? raw : String(raw).split("\n\n"))
    .map((v) =>
      String(
        typeof v === "object" && v ? v.text || v.content || v.value || "" : v,
      ).trim(),
    )
    .filter(Boolean);
  const candidates: Array<["image" | "video", unknown]> = [];
  for (const [keys, kind] of [
    [["imageList", "images", "image_list", "imageUrls", "image_urls"], "image"],
    [["videoList", "videos", "video_list", "videoUrls", "video_urls"], "video"],
    [["media", "mediaList", "media_list"], "mixed"],
  ] as const) {
    for (const key of keys)
      if (article[key] != null)
        for (const item of Array.isArray(article[key])
          ? article[key]
          : [article[key]]) {
          candidates.push([
            kind === "mixed"
              ? String(item?.type || item?.media_type).toLowerCase() === "video"
                ? "video"
                : "image"
              : kind,
            item,
          ]);
        }
  }
  const seen = new Set<string>(),
    media: SourceItem[] = [];
  candidates.forEach(([kind, raw], order) => {
    const data: Row = typeof raw === "object" && raw ? raw : { src: raw };
    const url = ["src", "url", "source", "download_url"]
      .map((k) => httpUrl(data[k]))
      .find(Boolean);
    if (!url || seen.has(url)) return;
    seen.add(url);
    const index = data.paragraphIndex ?? data.paragraph_index ?? data.position;
    media.push({
      media_type: kind,
      source_url: url,
      alt_text: String(data.alt || data.title || data.caption || "").trim(),
      poster: httpUrl(data.poster),
      width: integer(data.width, 0),
      height: integer(data.height, 0),
      duration: integer(data.duration, 0),
      extra: Object.fromEntries(Object.entries(data).filter(([key]) => !mediaFields.has(key))),
      source_order: order,
      paragraph_index:
        integer(index, null) != null
          ? Math.max(0, integer(index, null)!)
          : null,
    });
  });
  return {
    title: String(article.title || "").trim(),
    paragraphs,
    comments: article.commentList || article.comments || [],
    article_url: httpUrl(article.url),
    media,
  };
}
export async function importSourceMedia(
  store: Store,
  mediaDir: string,
  taskId: string,
  items: SourceItem[],
  articleUrl?: string | null,
  signal?: AbortSignal,
) {
  const results: Asset[] = [];
  // A bounded batch avoids exhausting sockets for media-heavy source articles.
  for (let start = 0; start < items.length; start += 4)
    results.push(
      ...(await Promise.all(
        items.slice(start, start + 4).map(async (item) => {
          const metadata = {
            ...item,
            origin: "aimaster",
            original_url: item.source_url,
          };
          const asset = store.createMedia({
            task_id: taskId,
            media_type: item.media_type,
            url: item.source_url,
            alt_text: item.alt_text,
            status: "downloading",
            metadata_json: metadata,
          });
          try {
            if (item.media_type === "video") {
              await abortable(
                resolvePublic(item.source_url),
                signal
                  ? AbortSignal.any([signal, AbortSignal.timeout(15_000)])
                  : AbortSignal.timeout(15_000),
              );
              return store.update<Asset>("media_assets", asset.id, {
                status: "ready",
              })!;
            }
            const timeout = AbortSignal.timeout(15_000);
            const { bytes, mime } = await downloadImage(
              item.source_url,
              articleUrl ?? undefined,
              signal ? AbortSignal.any([signal, timeout]) : timeout,
            );
            const folder = join(mediaDir, asset.id);
            await mkdir(folder, { recursive: true });
            const file = join(folder, `source${imageExtensions[mime]}`);
            await writeFile(file, bytes);
            return store.update<Asset>("media_assets", asset.id, {
              local_path: file,
              mime_type: mime,
              url: `/api/media/${asset.id}/content`,
              status: "ready",
            })!;
          } catch (error) {
            return store.update<Asset>("media_assets", asset.id, {
              status: "failed",
              metadata_json: { ...metadata, error: errorMessage(error) },
            })!;
          }
        }),
      )),
    );
  return results;
}
export async function ownedMediaPath(
  mediaDir: string,
  filename: string,
): Promise<string> {
  const [root, file] = await Promise.all([
    realpath(mediaDir),
    realpath(filename),
  ]);
  const child = relative(root, file);
  if (!child || child.startsWith("..") || isAbsolute(child))
    throw new Error("媒体文件不在数据目录内");
  return file;
}
export interface ImageOptions {
  prompt: string;
  aspect_ratio?: string;
  count?: number;
  placement?: string;
  alt_text?: string;
}
export interface ImageResult {
  url?: string;
  local_path?: string;
  mime_type: string;
  revised_prompt?: string;
}
export interface ImageProvider {
  generate(options: ImageOptions, signal?: AbortSignal): Promise<ImageResult[]>;
  edit(
    asset: Asset,
    options: ImageOptions,
    signal?: AbortSignal,
  ): Promise<ImageResult[]>;
}
export class CompatibleImageProvider implements ImageProvider {
  constructor(
    private store: Store,
    private mediaDir: string,
    private requestFetch: typeof fetch = fetch,
  ) {}
  private async request(
    options: ImageOptions,
    source?: Asset,
    signal?: AbortSignal,
  ): Promise<ImageResult[]> {
    const c = this.store.config();
    if (
      !["gpt-image-2", "gptimage2", "openai", "method"].includes(
        String(c.image_provider || "gpt-image-2").toLowerCase(),
      )
    )
      throw new Error("不支持的图片实现器");
    if (!String(c.image_api_key || "").trim())
      throw new Error("请先在设置中配置图片 API Key");
    const fields: Row = {
      model: String(c.image_model || "gpt-image-2").trim(),
      prompt: options.prompt,
      n: options.count ?? 1,
      size:
        (
          {
            "1:1": "1024x1024",
            "4:3": "1280x960",
            "3:4": "960x1280",
            "16:9": "1536x864",
          } as Row
        )[options.aspect_ratio ?? "16:9"] ?? "auto",
      quality: c.image_quality || "auto",
    };
    if (c.image_custom_size_quality === false) {
      delete fields.size;
      delete fields.quality;
    }
    const headers: Record<string, string> = {
      Authorization: `Bearer ${String(c.image_api_key).trim()}`,
    };
    let body: FormData | string;
    if (source) {
      const input = source.local_path
        ? {
            bytes: await readFile(
              await ownedMediaPath(this.mediaDir, source.local_path),
            ),
            mime: source.mime_type || "image/png",
          }
        : await downloadImage(source.url || "", undefined, signal);
      const form = new FormData();
      for (const [k, v] of Object.entries(fields)) form.set(k, String(v));
      form.set(
        "image",
        new Blob([new Uint8Array(input.bytes)], { type: input.mime }),
        `source${imageExtensions[input.mime] || ".png"}`,
      );
      body = form;
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(fields);
    }
    // Image gateways may stream keep-alive bytes while queued. The old SDK's
    // 180-second read timeout was not a 180-second total request deadline.
    // Allow a bounded ten-minute job while still honoring immediate app shutdown.
    const timeout = AbortSignal.timeout(600_000);
    const response = await this.requestFetch(
      `${String(c.image_base_url || "https://api.openai.com/v1").trim().replace(/\/$/, "")}/images/${source ? "edits" : "generations"}`,
      {
        method: "POST",
        headers,
        body,
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      },
    );
    if (!response.ok)
      throw new Error(
        `图片服务返回 ${response.status}：${(await response.text()).slice(0, 500)}`,
      );
    const data = (await response.json()) as Row;
    if (!Array.isArray(data.data) || !data.data.length)
      throw new Error("图片接口未返回任何结果");
    const output: ImageResult[] = [];
    for (const item of data.data) {
      if (item.b64_json) {
        if (
          typeof item.b64_json !== "string" ||
          item.b64_json.length > IMAGE_LIMIT * 1.4
        )
          throw new Error("图片 Base64 数据无效或过大");
        const encoded = item.b64_json.replace(/^data:image\/(?:png|jpeg|webp|gif);base64,/, "");
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.replace(/=+$/, "").length % 4 === 1)
          throw new Error("图片 Base64 数据无效或过大");
        const bytes = Buffer.from(encoded, "base64"),
          mime = imageMime(bytes);
        if (bytes.length > IMAGE_LIMIT) throw new Error("图片超过 20 MB");
        if (!mime) throw new Error("图片接口返回的文件不是受支持的图片");
        const folder = join(this.mediaDir, "generated");
        await mkdir(folder, { recursive: true });
        const file = join(folder, `${id()}${imageExtensions[mime]}`);
        await writeFile(file, bytes);
        output.push({
          local_path: file,
          mime_type: mime,
          revised_prompt: item.revised_prompt,
        });
      } else if (httpUrl(item.url))
        output.push({
          url: httpUrl(item.url)!,
          mime_type: "image/png",
          revised_prompt: item.revised_prompt,
        });
      else throw new Error("图片接口结果缺少有效的 b64_json 或 url");
    }
    return output;
  }
  generate(options: ImageOptions, signal?: AbortSignal) {
    return this.request(options, undefined, signal);
  }
  edit(asset: Asset, options: ImageOptions, signal?: AbortSignal) {
    return this.request({ ...options, count: 1 }, asset, signal);
  }
}
