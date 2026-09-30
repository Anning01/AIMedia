import { build } from "esbuild";
import { rm } from "node:fs/promises";
await rm("dist/electron", { recursive: true, force: true });
await build({
  entryPoints: ["electron/main.ts", "electron/preload.ts", "electron/worker.ts"],
  outdir: "dist/electron",
  outExtension: { ".js": ".cjs" },
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["electron"],
  sourcemap: false,
  minify: true,
});
