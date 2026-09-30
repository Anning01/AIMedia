/** Deterministic provider data. No outbound requests or paid model calls. */
export const researchClaims = [
  { excerpt: "示例展览于 2026 年 9 月 1 日开幕。", query: "示例展览 官方 开幕日期" },
  { excerpt: "示例展览门票为 100 元。", query: "示例展览 官方 门票价格" },
  { excerpt: "示例展览开放时间是每天 9 点。", query: "示例展览 开放时间 公告" },
  { excerpt: "示例展览预计有一百万人参观。", query: "示例展览 预计人数" },
];
export const researchHtml = researchClaims.map(claim => `<p>${claim.excerpt}</p>`).join("");
export function researchProvider() {
  const calls: { url: string; body: Record<string, any> }[] = [];
  const request: typeof fetch = async (url, init) => {
    const body = JSON.parse(String(init?.body));
    calls.push({ url: String(url), body });
    if (String(url).includes("firecrawl.dev")) {
      const index = researchClaims.findIndex(claim => claim.query === body.query);
      if (index < 0) throw new Error("Unexpected query");
      const texts = [
        ["示例展览开幕日期为 2026 年 9 月 1 日，欢迎参观。"],
        ["示例展览门票价格为 80 元，官网没有 100 元票价。"],
        ["示例展览每天上午 9 点开门。", "示例展览最新公告：每天上午 10 点开门。"],
        ["示例展览预计有一百万人参观，但这只是搜索摘要。"],
      ][index];
      return Response.json({ success: true, data: { web: texts.map((text, i) => ({ title: `示例官方资料 ${index + 1}-${i + 1}`, url: `https://example.com/evidence/${index + 1}/${i + 1}`, ...(index === 3 ? { description: text } : { markdown: text }) })) } });
    }
    if (body.stream) return new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: "<p>示例展览于 2026 年 9 月 1 日开幕，门票 80 元。开放时间存在不同公告，参观人数预测尚无法确认。</p>" } }] })}\n\ndata: [DONE]\n\n`, { headers: { "Content-Type": "text/event-stream" } });
    const data = JSON.parse(body.messages[1].content);
    const result = data.article ? { claims: researchClaims } : { claims: [
      { id: "C1", verdict: "supported", reason: "开幕公告支持该日期。", evidence: [{ source_id: "S1", quote: "开幕日期为 2026 年 9 月 1 日", stance: "supports" }] },
      { id: "C2", verdict: "contradicted", reason: "票务说明的价格为 80 元，不是 100 元。", evidence: [{ source_id: "S2", quote: "示例展览门票价格为 80 元", stance: "contradicts" }] },
      { id: "C3", verdict: "disputed", reason: "两份开放公告的时间不同，需要进一步核对适用日期。", evidence: [
        { source_id: "S3", quote: "示例展览每天上午 9 点开门。", stance: "supports" },
        { source_id: "S4", quote: "每天上午 10 点开门。", stance: "contradicts" },
      ] },
      // Intentionally overconfident: the service must downgrade a search-only snippet.
      { id: "C4", verdict: "supported", reason: "摘要支持预测。", evidence: [{ source_id: "S5", quote: "示例展览预计有一百万人参观", stance: "supports" }] },
    ] };
    return Response.json({ choices: [{ message: { content: JSON.stringify(result) } }] });
  };
  return { request, calls };
}
