import type { Row } from "../types.js";
import { sourceUrl, type SearchSource } from "../../../shared/research.js";

export type SearchDocument = SearchSource & { content: string; content_kind: "page" | "snippet" };
const text = (value: unknown) => typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

export async function searchWithSources(config: Row, query: string, signal: AbortSignal, request: typeof fetch = fetch) {
  const key = String(config.firecrawl_api_key || process.env.FIRECRAWL_API_KEY || "").trim();
  if (!key) throw new Error("尚未配置 Firecrawl API Key");
  const requested = Number(config.max_search_results);
  const limit = Number.isFinite(requested) ? Math.min(10, Math.max(1, Math.trunc(requested))) : 3;
  const response = await request("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit, scrapeOptions: { formats: ["markdown"] } }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]),
  });
  if (!response.ok) throw new Error(`搜索服务返回 ${response.status}`);
  const result = await response.json() as Row;
  if (!result || typeof result !== "object") throw new Error("搜索服务响应格式无效");
  if (result.success === false) throw new Error("搜索服务未能完成本次检索");
  const data = result.data ?? result;
  // v2 returns grouped web/news results; older fixtures/integrations return a list.
  const items: unknown[] = Array.isArray(data) ? data : [
    ...(Array.isArray(data.web) ? data.web : []),
    ...(Array.isArray(data.news) ? data.news : []),
  ];
  const seen = new Set<string>();
  const documents: SearchDocument[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const row = item as Row;
    const url = sourceUrl(row.url || row.metadata?.sourceURL);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const page = row.metadata?.error || Number(row.metadata?.statusCode) >= 400 ? "" : text(row.markdown);
    const content = (page || text(row.description || row.snippet || row.summary)).slice(0, 4000);
    documents.push({ title: text(row.title || row.metadata?.title).slice(0, 240) || "未命名来源", url,
      summary: content.slice(0, 280), content, content_kind: page ? "page" : "snippet" });
    if (documents.length >= limit) break;
  }
  return {
    documents,
    sources: documents.map(({ title, url, summary }) => ({ title, url, summary })),
    context: documents.map(source => `### ${source.title}\n来源: ${source.url}\n${source.content.slice(0, 1500)}`).join("\n\n---\n\n"),
  };
}

export async function searchContext(config: Row, query: string, signal: AbortSignal, request: typeof fetch = fetch) {
  return (await searchWithSources(config, query, signal, request)).context;
}
