import clean from "sanitize-html";
import type { Asset } from "./types.js";

export const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function sanitizeHtml(value: string): string {
  return clean(value || "", {
    allowedTags: [
      "h1",
      "h2",
      "h3",
      "h4",
      "p",
      "br",
      "strong",
      "em",
      "u",
      "s",
      "ul",
      "ol",
      "li",
      "blockquote",
      "a",
      "img",
      "video",
      "source",
      "figure",
      "figcaption",
      "hr",
      "span",
      "div",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: [
        "src",
        "alt",
        "title",
        "width",
        "height",
        "loading",
        "referrerpolicy",
        "data-asset-id",
      ],
      video: [
        "src",
        "controls",
        "poster",
        "preload",
        "referrerpolicy",
        "data-asset-id",
      ],
      source: ["src", "type"],
      div: ["data-type", "data-asset-id"],
      span: ["data-type"],
    },
    allowedSchemes: ["http", "https"],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, rel: "noopener noreferrer" },
      }),
    },
  });
}
const decodeTitleEntities = (value: string) => value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code: string) => {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  if (!code.startsWith("#")) return named[code.toLowerCase()] ?? entity;
  const number = Number.parseInt(code.slice(code[1]?.toLowerCase() === "x" ? 2 : 1), code[1]?.toLowerCase() === "x" ? 16 : 10);
  try { return Number.isFinite(number) ? String.fromCodePoint(number) : entity; } catch { return entity; }
});
/** The first h1 is the versioned article title; drafts without one retain the prior title. */
export function articleTitle(html: string, fallback: string): string {
  const heading = /<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/i.exec(sanitizeHtml(html))?.[1];
  if (heading === undefined) return fallback;
  const title = decodeTitleEntities(clean(heading, { allowedTags: [], allowedAttributes: {} })).replace(/\s+/g, " ").trim();
  return title ? title.slice(0, 300) : fallback;
}
/** Local assets must not retain a development or ephemeral desktop port. */
export function portableMediaHtml(value: string, origin: string): string {
  return value.replace(
    /\b(src|poster)="([^"]+)"/g,
    (full, attr: string, url: string) => {
      try {
        const target = new URL(url, origin);
        return target.origin === origin &&
          /^\/api\/media\/[^/]+\/content$/.test(target.pathname)
          ? `${attr}="${target.pathname}"`
          : full;
      } catch {
        return full;
      }
    },
  );
}
export function normalizeHtml(value: string): string {
  let text = value
    .replace(/\r\n/g, "\n")
    .trim()
    .replace(
      /^\s*(`{3,}|~{3,})[ \t]*(?:html)?[ \t]*\n([\s\S]*?)\n?\1\s*$/i,
      "$2",
    )
    .trim();
  text =
    /<body\b[^>]*>([\s\S]*?)<\/body\s*>/i.exec(text)?.[1] ??
    text.replace(/^\s*<!doctype[^>]*>\s*/i, "");
  const block =
    /<(?:h[1-4]|p|blockquote|ul|ol|figure|img|video|hr|div)\b/i.exec(text);
  if (block) return sanitizeHtml(text.slice(block.index));
  return sanitizeHtml(
    text
      .split(/\n[ \t]*\n+/)
      .filter((s) => s.trim())
      .map(
        (s) =>
          `<p>${s
            .split("\n")
            .filter((s) => s.trim())
            .map((s) => escapeHtml(s.trim()))
            .join("<br>")}</p>`,
      )
      .join(""),
  );
}
export function composeMediaHtml(article: string, assets: Asset[]): string {
  const metadata = (asset: Asset): Asset["metadata_json"] => {
    let value: unknown = asset.metadata_json;
    if (typeof value === "string") {
      try { value = JSON.parse(value); } catch { return {}; }
    }
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  };
  const integer = (value: unknown): number | null =>
    (typeof value === "number" || (typeof value === "string" && value.trim() !== "")) && Number.isFinite(Number(value))
      ? Math.trunc(Number(value)) : null;
  assets = assets.map(asset => ({ ...asset, metadata_json: metadata(asset) }));
  const paragraphEnds = [...article.matchAll(/<\/p\s*>/gi)].map(
    (m) => m.index + m[0].length,
  );
  const insertions = new Map<number, string[]>(),
    cover: string[] = [],
    afterSection: string[] = [],
    end: string[] = [],
    unpositioned: Asset[] = [];
  const markup = (asset: Asset) => {
    if (!["image", "video"].includes(asset.media_type)) return "";
    const source = asset.metadata_json?.origin === "aimaster";
    if (asset.status !== "ready" && !source) return "";
    if (!source && asset.metadata_json?.selection_required && !asset.metadata_json?.selected_at) return "";
    if (article.includes(`data-asset-id="${asset.id}"`) || article.includes(`data-asset-id='${asset.id}'`)) return "";
    const url = asset.url || asset.metadata_json?.original_url;
    if (!url) return "";
    const attrs = `src="${escapeHtml(url)}" data-asset-id="${escapeHtml(asset.id)}"${source ? ' referrerpolicy="no-referrer"' : ""}`;
    const alt = escapeHtml(asset.alt_text || "");
    return `<figure>${asset.media_type === "video" ? `<video ${attrs} controls="controls" preload="metadata"></video>` : `<img ${attrs} alt="${alt}" loading="lazy">`}${alt ? `<figcaption>${alt}</figcaption>` : ""}</figure>`;
  };
  const insert = (index: number, html: string) => {
    const offset =
      paragraphEnds[
        Math.min(Math.max(0, Math.trunc(index)), paragraphEnds.length - 1)
      ];
    insertions.set(offset, [...(insertions.get(offset) ?? []), html]);
  };
  const sources = assets
    .filter((a) => a.metadata_json?.origin === "aimaster")
    .sort(
      (a, b) =>
        (integer(a.metadata_json.source_order) ?? Infinity) -
        (integer(b.metadata_json.source_order) ?? Infinity),
    );
  let sourceIndex = 0;
  const ordered = assets.map((a) =>
    a.metadata_json?.origin === "aimaster" ? sources[sourceIndex++] : a,
  );
  for (const asset of ordered) {
    const html = markup(asset);
    if (!html) continue;
    const meta = asset.metadata_json ?? {};
    if (meta.origin === "aimaster") {
      if (
        integer(meta.paragraph_index) != null &&
        paragraphEnds.length
      )
        insert(Number(meta.paragraph_index), html);
      else unpositioned.push(asset);
    } else if (meta.placement === "cover") cover.push(html);
    else if (meta.placement === "after_section" && paragraphEnds.length)
      insert(0, html);
    else if (meta.placement === "after_section") afterSection.push(html);
    else end.push(html);
  }
  const sourceEnd: string[] = [];
  unpositioned.forEach((asset, index) => {
    if (paragraphEnds.length)
      insert(
        Math.ceil(
          ((index + 1) * paragraphEnds.length) / (unpositioned.length + 1),
        ) - 1,
        markup(asset),
      );
    else sourceEnd.push(markup(asset));
  });
  for (const [offset, html] of [...insertions].sort((a, b) => b[0] - a[0]))
    article = article.slice(0, offset) + html.join("") + article.slice(offset);
  return sanitizeHtml(
    cover.join("") + article + afterSection.join("") + sourceEnd.join("") + end.join(""),
  );
}
