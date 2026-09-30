import { join, resolve } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { startServer } from "./api.js";
try {
  process.loadEnvFile(".env");
} catch {}
const dataDir = resolve(process.env.AI_MEDIA_DATA_DIR || "storage-node");
await mkdir(dataDir, { recursive: true, mode: 0o700 });
const tokenPath = join(dataDir, "api-token");
let token = process.env.AI_MEDIA_API_TOKEN;
if (!token) {
  try {
    token = (await readFile(tokenPath, "utf8")).trim();
  } catch {
    token = randomBytes(32).toString("hex");
    await writeFile(tokenPath, token, { mode: 0o600 });
  }
}
const service = await startServer({
  dataDir,
  token,
  integrationToken: token,
  port: Number(process.env.AI_MEDIA_PORT || 8000),
  webDir: resolve("renderer/dist"),
  devOrigin: "http://127.0.0.1:5173",
});
console.log(
  `AI Media Node 服务：${service.origin}；访问令牌保存在 ${tokenPath}`,
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    void service.close().then(() => process.exit(0));
  });
