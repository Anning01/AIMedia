// Research harness: production API, renderer and preload, deterministic providers.
// Worker/process-boundary behavior is covered separately by the desktop smoke test.
import { app, BrowserWindow, session } from "electron";
import { resolve } from "node:path";
import { startServer } from "../../electron/server/api.js";
import { researchHtml, researchProvider } from "../fixtures/research.js";

app.setPath("userData", process.env.AI_MEDIA_TEST_DATA!);
let service: Awaited<ReturnType<typeof startServer>>;
let stopped = false;
app.on("before-quit", event => {
  if (stopped || !service) return;
  event.preventDefault();
  stopped = true;
  void service.close().finally(() => app.quit());
});
app.on("window-all-closed", () => app.quit());
async function start() {
await app.whenReady();
const fixture = researchProvider();
service = await startServer({ dataDir: process.env.AI_MEDIA_TEST_DATA!, webDir: resolve("renderer/dist"), token: "research-fixture", request: async (url, init) => {
  const body = JSON.parse(String(init?.body || "{}"));
  if (body.messages?.[0]?.content.includes('动作识别器')) return Response.json({ choices: [{ message: { content: JSON.stringify({ action: 'article_edit', message: '' }) } }] });
  if (body.model === "malformed" && body.stream === false) return new Response("malformed fixture result");
  return fixture.request(url, init);
} });
for (const [key, value] of Object.entries({ openai_api_key: "fixture", firecrawl_api_key: "fixture", search_enabled: true, llm_model: "fixture" })) service.store.setConfig(key, value);
const task = service.store.createTask({ platform: "manual", title: "事实核查工作区验收", content: researchHtml });
service.store.saveDraft(task.id, researchHtml, "manual");
await session.defaultSession.cookies.set({ url: service.origin, name: "ai_media_session", value: "research-fixture", httpOnly: true, sameSite: "strict" });
const window = new BrowserWindow({ width: 1440, height: 960, webPreferences: { preload: resolve("dist/electron/preload.cjs"), sandbox: true, contextIsolation: true, nodeIntegration: false, additionalArguments: [`--ai-media-origin=${service.origin}`] } });
window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
await window.loadURL(`${service.origin}/articles/${task.id}`);
}
void start().catch(error => { console.error(error); app.exit(1); });
