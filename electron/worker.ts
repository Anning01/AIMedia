import { startServer } from "./server/api.js";
import { importStorage } from "./server/import-storage.js";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { errorMessage } from "./server/types.js";

type WorkerMessage = {
  type: string;
  dataDir?: string;
  webDir?: string;
  token?: string;
  devOrigin?: string;
  port?: number;
  version?: string;
  source?: string;
  requestId?: number;
  workers?: boolean;
};
let service: Awaited<ReturnType<typeof startServer>> | undefined;
let importing = false;
process.parentPort.on("message", async (event: { data: WorkerMessage }) => {
  const message = event.data;
  try {
    if (message.type === "start") {
      const tokenFile = join(message.dataDir!, "integration-token");
      let integrationToken: string;
      try {
        integrationToken = (await readFile(tokenFile, "utf8")).trim();
      } catch {
        integrationToken = randomBytes(32).toString("hex");
        await writeFile(tokenFile, integrationToken, { mode: 0o600 });
      }
      const options = {
        dataDir: message.dataDir!,
        webDir: message.webDir,
        token: message.token!,
        integrationToken,
        devOrigin: message.devOrigin,
        port: message.port,
        version: message.version,
        workers: message.workers,
      };
      try {
        service = await startServer(options);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") throw error;
        service = await startServer({ ...options, port: 0 });
      }
      process.parentPort.postMessage({ type: "ready", origin: service.origin });
    } else if (message.type === "import" && service) {
      if (importing) throw new Error("正在导入数据，请稍候");
      importing = true;
      try {
        const result = await importStorage(
          service.store,
          message.source!,
          join(message.dataDir!, "media"),
        );
        process.parentPort.postMessage({
          type: "imported",
          requestId: message.requestId,
          result,
        });
      } finally {
        importing = false;
      }
    } else if (message.type === "stop") {
      await service?.close();
      process.exit(0);
    }
  } catch (error) {
    process.parentPort.postMessage({
      type: "error",
      requestId: message.requestId,
      message: errorMessage(error),
    });
  }
});
