import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { articleText, checkFacts, factCheckContext } from "../../electron/server/research/fact-check.js";
import { searchWithSources } from "../../electron/server/research/search.js";
import { startServer } from "../../electron/server/api.js";
import { Store } from "../../electron/server/store.js";
import type { Row } from "../../electron/server/types.js";
import type { FactCheckReport } from "../../shared/research.js";
import { researchClaims, researchHtml, researchProvider } from "../fixtures/research.js";

const config = { firecrawl_api_key: "fixture", max_search_results: 3 };
const options = { runId: "run-test", baseVersionId: "version-1", html: researchHtml, instruction: "核实数据" };
const noEvent = () => {};
const chatResponse = (value: unknown) => Response.json({ choices: [{ message: { content: JSON.stringify(value) } }] });

test("research links raw article claims to verbatim evidence and never treats snippets as proof", async () => {
  const provider = researchProvider(), events: Row[] = [];
  const report = await checkFacts(options, { config, signal: AbortSignal.timeout(5000), request: provider.request, chat: (body, signal) => provider.request("https://model.example/chat", { body: JSON.stringify(body), signal }), event: (type, payload) => events.push({ type, payload }) });
  assert.deepEqual(report.claims.map(claim => claim.verdict), ["supported", "contradicted", "disputed", "uncertain"]);
  assert.equal(report.status, "partial");
  assert.equal(report.sources.length, 5);
  assert.equal(report.base_version_id, "version-1");
  assert.equal(provider.calls.filter(call => call.url.includes("firecrawl")).length, 4);
  assert.deepEqual(events.filter(event => event.type === "tool_call").map(event => event.payload.arguments.query), researchClaims.map(claim => claim.query));
  assert.equal(events.at(-1)?.payload.status, "fact_check_completed");
  assert.ok(events.at(-1)?.payload.report.checked_at);
  assert.match(factCheckContext(report), /不能编造数据、来源/);
  assert.ok(!("content" in report.sources[0]), "Persist excerpts, not whole provider pages");
});

test("claim extraction strips executable HTML, decodes entities, and rejects invented excerpts", async () => {
  assert.equal(articleText('<p>A &amp; B &lt; 20</p><script>secret()</script><p>第二段&nbsp;正文</p>'), "A & B < 20 第二段 正文");
  let searches = 0;
  const report = await checkFacts(options, { config, signal: AbortSignal.timeout(5000), chat: async () => chatResponse({ claims: [{ excerpt: "原文没有这条事实", query: "不要执行" }] }), request: async () => { searches++; throw new Error("unexpected"); }, event: noEvent });
  assert.equal(report.status, "failed");
  assert.equal(report.claims.length, 0);
  assert.equal(searches, 0);
});

test("missing permission or empty text does not call a model or search service", async () => {
  const forbidden = async () => { throw new Error("must not be called"); };
  for (const override of [{ skipReason: "本轮 Skill 未获搜索权限" }, { html: "<p></p>" }]) {
    const report = await checkFacts({ ...options, ...override }, { config, signal: AbortSignal.timeout(5000), chat: forbidden, request: forbidden, event: noEvent });
    assert.equal(report.status, "skipped");
    assert.equal(report.sources.length, 0);
  }
});

test("forged sources, unrelated source IDs, invented quotations and duplicate assessments are downgraded", async () => {
  for (const variant of ["forged-id", "forged-quote", "different-claim", "duplicate", "missing"] as const) {
    let stage = 0;
    const report = await checkFacts(options, { config, signal: AbortSignal.timeout(5000), event: noEvent,
      request: async (_url, init) => Response.json({ data: [{ title: "来源", url: `https://example.com/${JSON.parse(String(init?.body)).query === researchClaims[0].query ? 1 : 2}`, markdown: "本来源明确说明这项事实的数据与原文一致。" }] }),
      chat: async () => {
        if (!stage++) return chatResponse({ claims: researchClaims.slice(0, 2) });
        const claim = { id: "C1", verdict: "supported", reason: "声称已证实", evidence: [{ source_id: variant === "forged-id" ? "fabricated" : variant === "different-claim" ? "S2" : "S1", quote: variant === "forged-quote" ? "网页里根本没有的引文文字" : "本来源明确说明这项事实的数据与原文一致。", stance: "supports" }] };
        return chatResponse({ claims: variant === "duplicate" ? [claim, claim] : variant === "missing" ? [] : [claim] });
      },
    });
    assert.equal(report.claims[0].verdict, "uncertain", variant);
    assert.equal(report.status, "partial", variant);
    assert.doesNotMatch(report.claims[0].reason, /声称已证实/);
  }
});

test("retrieval failure and malformed assessment remain visible and do not fabricate a conclusion", async () => {
  for (const failSearch of [true, false]) {
    let stage = 0;
    const report = await checkFacts(options, { config, signal: AbortSignal.timeout(5000), event: noEvent,
      chat: async () => !stage++ ? chatResponse({ claims: researchClaims.slice(0, 1) }) : new Response("invalid json"),
      request: async () => failSearch ? new Response("private diagnostic", { status: 503 }) : Response.json({ data: [{ title: "来源", url: "https://example.com/source", markdown: "这是一个用于检查异常处理的来源正文。" }] }),
    });
    assert.equal(report.status, "failed");
    assert.equal(report.claims[0].verdict, "uncertain");
    assert.equal(report.claims[0].search_status, failSearch ? "failed" : "completed");
    assert.ok(!JSON.stringify(report).includes("private diagnostic"));
  }
});

test("long articles declare their actual scope and abort does not produce a completed report", async () => {
  let supplied: Row | undefined;
  const report = await checkFacts({ ...options, html: `<p>${"这是长正文。".repeat(7000)}</p>` }, { config, signal: AbortSignal.timeout(5000), event: noEvent, chat: async body => { supplied = JSON.parse(body.messages[1].content); return chatResponse({ claims: [] }); } });
  assert.equal(supplied?.article.length, 30_000);
  assert.equal(report.scope.article_truncated, true);
  assert.equal(report.status, "skipped");
  let completions = 0;
  const abort = new AbortController();
  await assert.rejects(checkFacts(options, { config, signal: abort.signal, event: (_type, payload) => { if (payload.status === "fact_check_completed") completions++; }, chat: async () => { abort.abort(); throw new Error("cancelled"); } }));
  assert.equal(completions, 0);
});

test("Firecrawl result validation rejects active links and marks failed page scrapes as snippets", async () => {
  const result = await searchWithSources(config, "查询", AbortSignal.timeout(5000), async () => Response.json({ data: { web: [
    { title: "unsafe", url: "javascript:alert(1)", markdown: "不可信" },
    { title: "credentials", url: "https://user:password@example.com/", markdown: "不可信" },
    { title: "failed-page", url: "https://example.com/failed", markdown: "错误页面不应成为证据", description: "只有搜索摘要", metadata: { statusCode: 403 } },
    { title: "duplicate", url: "https://example.com/failed", markdown: "重复" },
    null,
  ], images: [{ url: "https://example.com/image.jpg", title: "图片不是事实来源" }] } }));
  assert.equal(result.sources.length, 1);
  assert.equal(result.documents[0].content_kind, "snippet");
  assert.equal(result.documents[0].content, "只有搜索摘要");
});

test("Agent API persists the report and uses checked findings in a proposal without changing the saved version", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ai-media-research-"));
  const provider = researchProvider();
  const service = await startServer({ dataDir: dir, token: "fixture", workers: false, request: provider.request });
  try {
    service.store.setConfig("openai_api_key", "fixture");
    service.store.setConfig("firecrawl_api_key", "fixture");
    service.store.setConfig("search_enabled", true);
    const task = service.store.createTask({ platform: "manual", title: "无关的旧标题", content: "无关旧正文" });
    const saved = service.store.saveDraft(task.id, "<p>原来保存的稿件。</p>", "manual");
    const response = await fetch(`${service.origin}/api/tasks/${task.id}/agent-runs`, { method: "POST", headers: { Authorization: "Bearer fixture", "Content-Type": "application/json" }, body: JSON.stringify({ instruction: "核实未保存正文", current_html: researchHtml, base_version_id: saved.id }) });
    assert.equal(response.status, 202);
    const run = await response.json() as Row;
    await service.generator.run(run.id, AbortSignal.timeout(5000));
    const history = await fetch(`${service.origin}/api/tasks/${task.id}/agent-history`, { headers: { Authorization: "Bearer fixture" } }).then(response => response.json()) as Row[];
    const report = history.find(event => event.payload.status === "fact_check_completed")?.payload.report as FactCheckReport;
    assert.equal(report.claims.length, 4);
    assert.equal(report.base_version_id, saved.id);
    assert.equal(report.run_id, run.id);
    assert.equal(service.store.task(task.id)?.active_version_id, saved.id);
    assert.equal(service.store.get("generation_runs", run.id)?.status, "completed");
    const rewrite = provider.calls.find(call => call.body.stream);
    assert.match(rewrite?.body.messages[1].content, /证据反驳/);
    assert.match(rewrite?.body.messages[1].content, /来源支持/);
    assert.match(rewrite?.body.messages[1].content, /"verdict":"uncertain"/);
    assert.ok(provider.calls.filter(call => call.url.includes("firecrawl")).every(call => call.body.query !== "无关的旧标题"));
    await service.close();
    const reopened = new Store(join(dir, "ai_media.db"));
    try { assert.deepEqual(reopened.events(0, run.id).find(event => event.payload.status === "fact_check_completed")?.payload.report, report); }
    finally { reopened.close(); }
  } finally {
    if (service.server.listening) await service.close();
    await rm(dir, { recursive: true, force: true });
  }
});
