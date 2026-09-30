/** Persisted research contract shared by the worker and article workspace. */
export type SearchSource = { title: string; url: string; summary: string };
export const FACT_CHECK_MAX_CLAIMS = 6;
export type ResearchSource = SearchSource & { id: string; content_kind: "page" | "snippet" };
export const verdictLabels = {
  supported: "来源支持",
  contradicted: "证据反驳",
  disputed: "存在争议",
  uncertain: "无法确认",
} as const;
export type FactVerdict = keyof typeof verdictLabels;
export const factCheckStatusLabels = { completed: "本轮核查结束", partial: "部分核查未完成", failed: "本轮核查失败", skipped: "本轮未核查" } as const;
export type FactClaim = {
  id: string;
  excerpt: string;
  query: string;
  verdict: FactVerdict;
  reason: string;
  evidence: { source_id: string; quote: string; stance: "supports" | "contradicts" }[];
  search_status: "completed" | "failed";
  search_error?: string;
};
export type FactCheckReport = {
  schema_version: 1;
  run_id: string;
  base_version_id: string | null;
  checked_at: string;
  status: "completed" | "partial" | "failed" | "skipped";
  note: string;
  scope: { max_claims: number; input_chars: number; article_truncated: boolean; input_proposal_id?: string };
  claims: FactClaim[];
  sources: ResearchSource[];
};

/** Search results are untrusted, including links rendered from older history. */
export function sourceUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 4096) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password
      ? url.href : null;
  } catch { return null; }
}
