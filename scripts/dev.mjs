import { spawn } from "node:child_process";
import { once } from "node:events";
try {
  process.loadEnvFile(".env");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const build = spawn(npm, ["run", "build:desktop"], { stdio: "inherit" });
if ((await once(build, "exit"))[0]) process.exit(1);
const vite = spawn(
  npm,
  [
    "--prefix",
    "renderer",
    "run",
    "dev",
    "--",
    "--host",
    "127.0.0.1",
    "--port",
    "5173",
    "--strictPort",
  ],
  { stdio: "inherit" },
);
const deadline = Date.now() + 30_000;
while (true) {
  try {
    if ((await fetch("http://127.0.0.1:5173")).ok) break;
  } catch {}
  if (Date.now() > deadline) {
    vite.kill();
    throw new Error("前端启动超时");
  }
  await new Promise((resolve) => setTimeout(resolve, 200));
}
const env = { ...process.env, AI_MEDIA_DEV_URL: "http://127.0.0.1:5173" };
delete env.ELECTRON_RUN_AS_NODE;
const electron = spawn(npm, ["start"], { stdio: "inherit", env });
const stop = () => {
  electron.kill();
  vite.kill();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
electron.on("exit", (code) => {
  vite.kill();
  process.exit(code ?? 0);
});
vite.on("exit", () => electron.kill());
