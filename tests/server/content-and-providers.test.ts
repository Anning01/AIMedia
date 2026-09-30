import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { composeMediaHtml } from "../../electron/server/content.js";
import { normalizeArticle, resolvePublic, downloadImage, IMAGE_LIMIT } from "../../electron/server/media.js";
import { searchContext, searchWithSources } from "../../electron/server/research/search.js";
import { startServer } from "../../electron/server/api.js";
import type { Asset, Row } from "../../electron/server/types.js";

const asset = (id: string, metadata: unknown, status = "ready") => ({ id, media_type: "image", url: `https://example.com/${id}.png`, status, metadata_json: metadata }) as Asset;
test("source media normalization retains dimensions, credits, aliases, zero positions and comments", () => {
  const normalized = normalizeArticle({
    contentList: [], body: [{ text: "第一段" }, { value: "第二段" }], comments: [{ content: "评论" }],
    imageList: [{ src: "https://example.com/chart.png", alt: "图表", width: "800", height: "invalid", paragraph_index: 0, credit: "气象台", metadata: { license: "CC BY" } }],
    images: ["https://example.com/chart.png"],
    video_list: [{ url: "https://example.com/movie.mp4", duration: "12", position: "invalid" }],
  });
  assert.deepEqual(normalized.paragraphs, ["第一段", "第二段"]);
  assert.deepEqual(normalized.comments, [{ content: "评论" }]);
  assert.equal(normalized.media.length, 2);
  assert.deepEqual(normalized.media[0].extra, { credit: "气象台", metadata: { license: "CC BY" } });
  assert.equal(normalized.media[0].paragraph_index, 0);
  assert.equal(normalized.media[0].width, 800);
  assert.equal(normalized.media[0].height, 0);
  assert.equal(normalized.media[1].duration, 12);
  assert.equal(normalized.media[1].paragraph_index, null);
});
test("source media placement keeps generated groups with no paragraphs", () => {
  const html = composeMediaHtml("<h1>标题</h1>", [
    asset("end1", { placement: "end" }), asset("source", { origin: "aimaster" }),
    asset("after1", { placement: "after_section" }), asset("end2", { placement: "end" }),
    asset("after2", { placement: "after_section" }), asset("cover", { placement: "cover" }),
  ]);
  const positions = ["cover.png", "标题", "after1.png", "after2.png", "source.png", "end1.png", "end2.png"].map(text => html.indexOf(text));
  assert.ok(positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1])));
});
test("invalid metadata distributes media stably and retains failed source previews", () => {
  const html = composeMediaHtml(Array.from({ length: 6 }, (_, i) => `<p>第${i + 1}段</p>`).join(""), [
    asset("invalid1", { origin: "aimaster", paragraph_index: "bad", source_order: null }, "failed"),
    asset("valid2", { origin: "aimaster", source_order: 2 }),
    asset("invalid2", { origin: "aimaster", paragraph_index: {}, source_order: "bad" }),
    asset("valid1", JSON.stringify({ origin: "aimaster", source_order: "1" })),
    asset("ai-failed", { placement: "cover" }, "failed"),
    asset("bad-json", "{invalid", "failed"),
  ]);
  const expected = ["第2段", "valid1.png", "第3段", "valid2.png", "第4段", "invalid1.png", "第5段", "invalid2.png", "第6段"];
  assert.ok(expected.every((text, i) => html.includes(text) && (i === 0 || html.indexOf(text) > html.indexOf(expected[i - 1]))));
  assert.ok(!html.includes("ai-failed") && !html.includes("bad-json"));
  assert.ok(html.includes('referrerpolicy="no-referrer"'));
  const clamped = composeMediaHtml("<p>一</p><p>二</p>", [asset("start", { origin: "aimaster", paragraph_index: -90 }), asset("end", { origin: "aimaster", paragraph_index: 90 })]);
  assert.ok(clamped.indexOf("start.png") < clamped.indexOf("二") && clamped.indexOf("end.png") > clamped.indexOf("二"));
});
test("proxy fake DNS resolves to validated public IP; private, multicast and forged answers remain blocked", async () => {
  let calls = 0;
  const options = {
    lookup: async () => [{ address: "198.18.0.33", family: 4 }],
    request: (async (url: unknown) => {
      calls++;
      assert.equal(new URL(String(url)).hostname, "cloudflare-dns.com");
      return Response.json({ Status: 0, Answer: [{ type: 1, data: "93.184.216.34" }] });
    }) as typeof fetch,
  };
  const result = await resolvePublic("https://example.com/image.png", options);
  assert.equal(result.address.address, "93.184.216.34");
  assert.equal(calls, 1);
  for (const url of ["http://127.0.0.1", "http://[::1]", "http://[::ffff:127.0.0.1]", "http://10.1.2.3", "http://169.254.169.254", "http://224.0.0.1", "http://[fec0::1]", "http://198.18.0.1", "file:///etc/passwd"]) await assert.rejects(resolvePublic(url, options));
  assert.equal(calls, 1, "Literal private IPs must never use fallback DNS");
  await assert.rejects(resolvePublic("https://example.com", { ...options, request: (async () => Response.json({ Status: 0, Answer: [{ type: 1, data: "127.0.0.1" }] })) as typeof fetch }));
  await assert.rejects(resolvePublic("https://example.com", { ...options, lookup: async () => [{ address: "10.1.2.3", family: 4 }] }));
  assert.equal(calls, 1, "Ordinary private DNS answers must never use fallback DNS");
});
test("source download enforces MIME, length, streamed limit, deadline and public redirect validation", async (t) => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB3sAAAAASUVORK5CYII=", "base64");
  const server = http.createServer((req, res) => {
    switch (req.url) {
      case "/redirect": res.writeHead(302, { Location: "https://example.com/png" }).end(); return;
      case "/private": res.writeHead(302, { Location: "http://127.0.0.1/private" }).end(); return;
      case "/svg": res.writeHead(200, { "Content-Type": "image/svg+xml" }).end("<svg/>"); return;
      case "/invalid": res.writeHead(200, { "Content-Type": "image/png" }).end("not an image"); return;
      case "/declared": res.writeHead(200, { "Content-Type": "image/png", "Content-Length": IMAGE_LIMIT + 1 }).flushHeaders(); return;
      case "/streamed": res.writeHead(200, { "Content-Type": "image/png" }).end(Buffer.alloc(IMAGE_LIMIT + 1)); return;
      case "/slow": {
        res.writeHead(200, { "Content-Type": "image/png" });
        const timer = setInterval(() => res.write(png), 10);
        res.on("close", () => clearInterval(timer));
        return;
      }
      default: res.writeHead(200, { "Content-Type": "image/png" }).end(png);
    }
  });
  await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
  t.after(() => new Promise<void>(done => { server.closeAllConnections(); server.close(() => done()); }));
  const port = (server.address() as { port: number }).port;
  let requests = 0;
  const network = {
    resolve: async (url: string) => resolvePublic(url, { lookup: async () => [{ address: "93.184.216.34", family: 4 }] }),
    request: ((target: URL, options: any, callback: any) => {
      requests++;
      options.lookup(target.hostname, {}, (_error: Error, address: string) => assert.equal(address, "93.184.216.34"));
      assert.equal(options.family, 4);
      assert.equal(options.agent, false);
      return http.get(`http://127.0.0.1:${port}${target.pathname}`, { signal: options.signal, headers: options.headers }, callback);
    }) as typeof http.get,
  };
  assert.deepEqual((await downloadImage("https://example.com/redirect", undefined, AbortSignal.timeout(2000), network)).bytes, png);
  assert.equal(requests, 2);
  await assert.rejects(downloadImage("https://example.com/private", undefined, AbortSignal.timeout(2000), network));
  assert.equal(requests, 3, "Private redirect must be rejected before making another request");
  for (const path of ["svg", "invalid", "declared", "streamed", "slow"]) await assert.rejects(downloadImage(`https://example.com/${path}`, undefined, AbortSignal.timeout(path === "slow" ? 80 : 2000), network), path);
  await assert.rejects(downloadImage("https://example.com/png", undefined, AbortSignal.timeout(30), { ...network, resolve: () => new Promise(() => {}) }), "DNS shares the total deadline");
});
test("search supports both supported HTTP payload formats and surfaces provider failure", async () => {
  for (const data of [[{ title: "权威资料", url: "https://example.com", description: "摘要" }], { web: [{ metadata: { title: "权威资料", sourceURL: "https://example.com" }, markdown: "正文" }] }]) {
    const context = await searchContext({ firecrawl_api_key: "fixture", max_search_results: 1 }, "查证", new AbortController().signal, async (_url, init) => {
      assert.deepEqual(JSON.parse(String(init?.body)), { query: "查证", limit: 1, scrapeOptions: { formats: ["markdown"] } });
      return Response.json({ success: true, data });
    });
    assert.ok(context.includes("权威资料") && context.includes("https://example.com"));
  }
  await assert.rejects(searchContext({ firecrawl_api_key: "fixture" }, "q", new AbortController().signal, async () => new Response("", { status: 401 })), /401/);
  const structured = await searchWithSources({ firecrawl_api_key: "fixture", max_search_results: 1 }, "查证", new AbortController().signal, async () => Response.json({ success: true, data: [{ title: "来源标题", url: "https://example.com/source", description: "来源摘要" }] }));
  assert.deepEqual(structured.sources, [{ title: "来源标题", url: "https://example.com/source", summary: "来源摘要" }]);
});
test("captured article survives importer failure with complete failed media and a runnable rewrite", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "ai-media-importer-test-"));
  const service = await startServer({ dataDir: dir, token: "fixture", workers: false, importMedia: async (store, _dir, taskId, items) => {
    store.createMedia({ task_id: taskId, media_type: "image", url: items[0].source_url, status: "downloading", metadata_json: { original_url: items[0].source_url } });
    throw new Error("Simulated importer interruption");
  } });
  t.after(async () => { await service.close(); await rm(dir, { recursive: true, force: true }); });
  const response = await fetch(service.origin + "/api/articles", { method: "POST", headers: { Authorization: "Bearer fixture", "Content-Type": "application/json" }, body: JSON.stringify({ platform: "source", article: { title: "仅标题", images: ["https://example.com/a.png", "https://example.com/b.png"] } }) });
  assert.equal(response.status, 200);
  const result = await response.json() as Row;
  assert.deepEqual(result.media, { total: 2, ready: 0, failed: 2 });
  assert.equal(service.store.task(result.task_id)?.original_content, "仅标题");
  assert.equal(service.store.get("generation_runs", result.run_id)?.status, "queued");
  assert.equal(service.store.media(result.task_id).length, 2);
});
test("direct rewrite and generate keep their prompts, response lengths and runtime settings", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "ai-media-direct-test-"));
  const prompts: Row[] = [];
  const service = await startServer({ dataDir: dir, token: "fixture", workers: false, request: async (_url, init) => {
    prompts.push(JSON.parse(String(init?.body)));
    return Response.json({ choices: [{ message: { content: "中文😀" } }] });
  } });
  service.store.setConfig("openai_api_key", "fixture");
  service.store.setConfig("llm_model", "configured-model");
  t.after(async () => { await service.close(); await rm(dir, { recursive: true, force: true }); });
  for (const [kind, body] of [["rewrite", { content: "原文😀", length: "short" }], ["generate", { topic: "测试主题", keywords: ["关键字"] }]] as const) {
    const response = await fetch(service.origin + `/api/${kind}`, { method: "POST", headers: { Authorization: "Bearer fixture", "Content-Type": "application/json" }, body: JSON.stringify(body) });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), kind === "rewrite" ? { content: "中文😀", original_length: 3, rewritten_length: 3 } : { content: "中文😀", length: 3 });
  }
  assert.equal(prompts[0].temperature, 0.8);
  assert.equal(prompts[1].temperature, 0.9);
  assert.equal(prompts[0].model, "configured-model");
  assert.match(prompts[0].messages[0].content, /事实核查/);
  assert.match(prompts[1].messages[0].content, /内容创作助手/);
  assert.match(prompts[1].messages[1].content, /关键字/);
});
