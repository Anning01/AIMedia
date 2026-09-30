import { DatabaseSync, backup } from "node:sqlite";
import {
  mkdtemp,
  rm,
  mkdir,
  copyFile,
  readFile,
  access,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, extname } from "node:path";
import { Store, id } from "./store.js";
import { ownedMediaPath } from "./media.js";
import { escapeHtml, sanitizeHtml } from "./content.js";
import type { Asset, Row } from "./types.js";
import { defaultTemplates } from "./templates.js";

const exists = async (path: string) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};
const json = async (path: string, fallback: unknown) =>
  (await exists(path)) ? JSON.parse(await readFile(path, "utf8")) : fallback;
/** Import a snapshot. Never modify the source or replace destination rows/config. */
export async function importStorage(
  store: Store,
  sourceDir: string,
  mediaDir: string,
) {
  const source = resolve(sourceDir),
    sourceDb = join(source, "ai_media.db");
  if (resolve(store.filename) === sourceDb)
    throw new Error("源目录与当前数据目录相同");
  const result = {
      tasks: 0,
      accounts: 0,
      media: 0,
      config: 0,
      missing_media: 0,
    },
    copied: string[] = [];
  const snapshotDir = await mkdtemp(join(tmpdir(), "ai-media-import-"));
  let snapshot: DatabaseSync | undefined;
  try {
    const tables = new Map<string, Row[]>();
    if (await exists(sourceDb)) {
      const reader = new DatabaseSync(sourceDb, { readOnly: true });
      try {
        await backup(reader, join(snapshotDir, "source.db"));
      } finally {
        reader.close();
      }
      snapshot = new DatabaseSync(join(snapshotDir, "source.db"), {
        readOnly: true,
      });
      const names = new Set(
        snapshot
          .prepare("SELECT name FROM sqlite_master WHERE type='table'")
          .all()
          .map((r) => String(r.name)),
      );
      if (!names.has("tasks"))
        throw new Error("所选数据库不是 AI Media 数据库");
      for (const table of store.columns.keys())
        if (names.has(table))
          tables.set(
            table,
            snapshot
              .prepare(`SELECT * FROM ${table}`)
              .all()
              .map((r) => store.decode<Row>(r)!),
          );
    } else if (
      !(await exists(join(source, "tasks.json"))) &&
      !(await exists(join(source, "config.json"))) &&
      !(await exists(join(source, "accounts.json")))
    )
      throw new Error(
        "请选择包含 ai_media.db 或JSON 数据文件的 storage 文件夹",
      );
    const replacements = new Map<string, string>();
    for (const asset of tables.get("media_assets") ?? []) {
      if (store.get("media_assets", asset.id)) continue;
      if (asset.local_path) {
        const candidates = [
          resolve(source, asset.local_path),
          resolve(source, "..", asset.local_path),
        ];
        let input: string | undefined;
        for (const candidate of candidates) {
          try {
            input = await ownedMediaPath(source, candidate);
            break;
          } catch {}
        }
        if (input) {
          const folder = join(mediaDir, "imported");
          await mkdir(folder, { recursive: true });
          const extension = /^\.[a-z0-9]{1,6}$/i.test(extname(input))
            ? extname(input)
            : ".bin";
          const output = join(folder, `${id()}${extension}`);
          await copyFile(input, output);
          copied.push(output);
          const url = `/api/media/${asset.id}/content`;
          if (asset.url) replacements.set(asset.url, url);
          asset.local_path = output;
          asset.url = url;
        } else {
          asset.local_path = null;
          asset.status = "failed";
          asset.metadata_json = {
            ...asset.metadata_json,
            error: "导入时未找到原媒体文件，请重新上传",
          };
          result.missing_media++;
        }
      }
    }
    const rewriteHtml = (html: string) => {
      for (const [old, url] of replacements) html = html.split(old).join(url);
      return sanitizeHtml(html);
    };
    const jsonTasks = (await json(join(source, "tasks.json"), {})) as Row;
    const jsonAccounts = (await json(
      join(source, "accounts.json"),
      [],
    )) as Row[];
    const jsonConfig = (await json(join(source, "config.json"), {})) as Row;
    // Backup the destination before merging. WAL-aware SQLite backup preserves a consistent snapshot.
    const backupDir = join(resolve(store.filename, ".."), "backups");
    await mkdir(backupDir, { recursive: true });
    await backup(store.db, join(backupDir, `before-import-${Date.now()}.db`));
    store.transaction(() => {
      for (const [table, rows] of tables) {
        for (const row of rows) {
          if (table === "system_config") {
            if (
              !(row.key in store.config()) &&
              !["version_cache", "github_etag"].includes(row.key)
            ) {
              store.setConfig(row.key, row.value);
              result.config++;
            }
            continue;
          }
          if (table === "generation_events") {
            // Event ids are local cursors; an id collision must not silently discard imported history.
            if (!store.config()[`import_events_${source}`]) {
              delete row.id;
              store.insert(table, row);
            }
            continue;
          }
          const existing = store.get(table, row.id);
          if (existing) {
            // Fresh databases already contain the stock templates. Import older
            // user edits over an untouched stock template, while retaining local edits.
            if (table === "rewrite_templates") {
              const stock = defaultTemplates.find(item => item.id === row.id);
              if (stock && ["name", "description", "system_prompt", "user_prompt_template"].every(key => existing[key] === (stock as Row)[key])) {
                store.update(table, row.id, row);
              }
            }
            continue;
          }
          if (table === "draft_versions") row.html = rewriteHtml(row.html);
          if (table === "generation_runs") {
            row.template_id ??= null;
            row.source_task_id ??= null;
            row.partial_html = rewriteHtml(row.partial_html || "");
            if (["queued", "running"].includes(row.status))
              row.status = "paused_import";
          }
          if (
            table === "publish_schedules" &&
            ["scheduled", "publishing"].includes(row.status)
          )
            row.status = "paused_import";
          if (table === "tasks") {
            row.target_account_id ??= null;
            row.publish_policy_override ??= null;
            if (["queued", "running"].includes(row.generation_status))
              row.generation_status = "paused_import";
            if (["scheduled", "publishing"].includes(row.publish_status))
              row.publish_status = "paused_import";
          }
          store.insert(table, row);
          if (table === "tasks") result.tasks++;
          if (table === "accounts_v2") result.accounts++;
          if (table === "media_assets") result.media++;
        }
      }
      if (tables.has("generation_events"))
        store.setConfig(`import_events_${source}`, true);
      for (const item of Object.values(jsonTasks) as Row[]) {
        if (store.task(item.id)) continue;
        store.createTask({
          id: item.id,
          platform: item.platform || "",
          title: item.original_title || "",
          content: item.original_content || "",
          comments: item.original_comments || [],
          style: item.style || "professional",
          created_at: item.created_at,
        });
        // saveDraft owns a transaction, so insert the immutable migration version directly here.
        if (item.rewritten_content) {
          const versionId = id();
          store.insert("draft_versions", {
            id: versionId,
            task_id: item.id,
            html: sanitizeHtml(
              `<h1>${escapeHtml(item.rewritten_title || item.original_title || "")}</h1><p>${escapeHtml(item.rewritten_content)}</p>`,
            ),
            source: "migration",
            prompt: null,
            created_at: item.created_at,
          });
          store.update("tasks", item.id, {
            active_version_id: versionId,
            generation_status: "completed",
          });
        }
        result.tasks++;
      }
      for (const account of jsonAccounts)
        if (!store.account(account.id)) {
          store.createAccount({
            id: account.id,
            platform: account.platform || "",
            name: account.name || "",
            status: account.status || "active",
            credentials: {
              app_id: account.app_id || "",
              app_secret: account.app_secret || "",
              cookies: account.cookies || "",
            },
          });
          result.accounts++;
        }
      const config = store.config();
      for (const [key, value] of Object.entries(jsonConfig))
        if (!(key in config)) {
          store.setConfig(key, value);
          result.config++;
        }
    });
    return result;
  } catch (error) {
    await Promise.all(copied.map((path) => rm(path, { force: true })));
    throw error;
  } finally {
    snapshot?.close();
    await rm(snapshotDir, { recursive: true, force: true });
  }
}
