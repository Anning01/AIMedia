import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { schema } from "./schema.js";
import { defaultTemplates } from "./templates.js";
import { articleTitle, sanitizeHtml } from "./content.js";
import {
  now,
  HttpError,
  type Account,
  type Asset,
  type GenerationEvent,
  type Row,
  type Run,
  type Schedule,
  type Task,
  type Template,
} from "./types.js";

export const id = () => randomUUID().replaceAll("-", "");
const jsonColumns = new Set([
  "original_comments",
  "payload",
  "metadata_json",
  "credentials",
  "daily_slots",
  "request_summary",
  "summary",
  "permissions",
  "tool_permissions",
  "skill_snapshot",
  "skill_files",
  "triggers",
  "value",
]);
const booleans = new Set(["is_builtin", "enabled", "branding_enabled"]);
export class Store {
  readonly db: DatabaseSync;
  readonly columns = new Map<string, Set<string>>();
  constructor(public filename: string) {
    if (filename !== ":memory:")
      mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(filename);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
    this.db.exec(schema);
    for (const [table, column, definition] of [
      ["tasks", "target_account_id", "TEXT"],
      ["tasks", "publish_policy_override", "TEXT"],
      ["generation_runs", "template_id", "TEXT"],
      ["generation_runs", "source_task_id", "TEXT"],
      ["generation_runs", "tool_permissions", "TEXT NOT NULL DEFAULT '[\"web_search\"]'"],
      ["generation_runs", "skill_snapshot", "TEXT NOT NULL DEFAULT '[]'"],
      ["generation_runs", "base_version_id", "TEXT"],
      ["generation_runs", "base_html", "TEXT"],
      ["generation_runs", "parent_run_id", "TEXT"],
      ["rewrite_templates", "enabled", "INTEGER NOT NULL DEFAULT 1"],
      ["rewrite_templates", "version", "TEXT NOT NULL DEFAULT '1.0.0'"],
      ["rewrite_templates", "source", "TEXT NOT NULL DEFAULT 'user'"],
      ["rewrite_templates", "permissions", "TEXT NOT NULL DEFAULT '[]'"],
      ["rewrite_templates", "skill_key", "TEXT"],
      ["rewrite_templates", "skill_files", "TEXT NOT NULL DEFAULT '[]'"],
      ["rewrite_templates", "triggers", "TEXT NOT NULL DEFAULT '[]'"],
      ["accounts_v2", "entry_url", "TEXT"],
      ["publish_schedules", "version_id", "TEXT"],
      ["publish_schedules", "account_revision", "TEXT"],
      ["publish_schedules", "title_snapshot", "TEXT"],
    ]) {
      if (
        !this.db
          .prepare(`PRAGMA table_info(${table})`)
          .all()
          .some((c) => c.name === column)
      )
        this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
    for (const row of this.db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      )
      .all()) {
      this.columns.set(
        String(row.name),
        new Set(
          this.db
            .prepare(`PRAGMA table_info(${row.name})`)
            .all()
            .map((c) => String(c.name)),
        ),
      );
    }
    this.transaction(() => {
      for (const t of defaultTemplates)
        if (!this.get("rewrite_templates", t.id))
          this.insert("rewrite_templates", {
            ...t,
            is_builtin: true,
            enabled: true,
            version: "1.0.0",
            source: "builtin",
            created_at: now(),
            updated_at: now(),
          });
      if (!this.config().rewrite_templates_seeded_v1)
        this.setConfig("rewrite_templates_seeded_v1", true);
    });
    this.db
      .prepare("UPDATE rewrite_templates SET source='builtin' WHERE is_builtin=1")
      .run();
    this.db
      .prepare("UPDATE rewrite_templates SET skill_key=COALESCE(skill_key,style_key,id)")
      .run();
  }
  close() {
    this.db.close();
  }
  transaction<T>(action: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = action();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  decode<T>(row: Row | undefined): T | undefined {
    if (!row) return undefined;
    const result: Row = { ...row };
    for (const [key, value] of Object.entries(result)) {
      if (jsonColumns.has(key) && typeof value === "string") {
        try {
          result[key] = JSON.parse(value);
        } catch {}
      }
      if (booleans.has(key) && value != null) result[key] = Boolean(value);
      if (
        key.endsWith("_at") &&
        typeof value === "string" &&
        !/[zZ]|[+-]\d\d:\d\d$/.test(value)
      )
        result[key] = value.replace(" ", "T") + "Z";
    }
    return result as T;
  }
  rows<T = Row>(sql: string, ...params: SQLInputValue[]): T[] {
    return this.db
      .prepare(sql)
      .all(...params)
      .map((r) => this.decode<T>(r)!);
  }
  get<T = Row>(table: string, key: string): T | undefined {
    this.checkTable(table);
    return this.decode<T>(
      this.db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(key),
    );
  }
  private checkTable(table: string) {
    if (!this.columns.has(table)) throw new Error("未知数据表");
  }
  private entries(table: string, values: Row) {
    this.checkTable(table);
    return Object.entries(values)
      .filter(([k, v]) => this.columns.get(table)!.has(k) && v !== undefined)
      .map(
        ([k, v]) =>
          [
            k,
            jsonColumns.has(k)
              ? JSON.stringify(v)
              : typeof v === "boolean"
                ? Number(v)
                : v,
          ] as [string, SQLInputValue],
      );
  }
  insert<T = Row>(table: string, values: Row): T {
    const entries = this.entries(table, values);
    this.db
      .prepare(
        `INSERT INTO ${table} (${entries.map(([k]) => `"${k}"`).join(",")}) VALUES (${entries.map(() => "?").join(",")})`,
      )
      .run(...entries.map(([, v]) => v));
    return values as T;
  }
  update<T = Row>(table: string, key: string, values: Row): T | undefined {
    if (this.columns.get(table)?.has("updated_at"))
      values = { ...values, updated_at: now() };
    const entries = this.entries(table, values).filter(
      ([k]) => !["id", "created_at"].includes(k),
    );
    if (entries.length)
      this.db
        .prepare(
          `UPDATE ${table} SET ${entries.map(([k]) => `"${k}"=?`).join(",")} WHERE id=?`,
        )
        .run(...entries.map(([, v]) => v), key);
    return this.get<T>(table, key);
  }
  delete(table: string, key: string): boolean {
    this.checkTable(table);
    return Boolean(
      this.db.prepare(`DELETE FROM ${table} WHERE id=?`).run(key).changes,
    );
  }
  config(): Row {
    return Object.fromEntries(
      this.rows("SELECT * FROM system_config").map((r) => [r.key, r.value]),
    );
  }
  setConfig(key: string, value: unknown) {
    this.db
      .prepare(
        "INSERT INTO system_config(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
      )
      .run(key, JSON.stringify(value), now());
  }
  task(key: string): Task | undefined {
    const t = this.get<Task>("tasks", key);
    return t
      ? {
          ...t,
          html: t.active_version_id
            ? (this.get("draft_versions", t.active_version_id)?.html ?? "")
            : "",
        }
      : undefined;
  }
  tasks(limit = 100, offset = 0): Task[] {
    return this.rows<Task>(
      "SELECT * FROM tasks ORDER BY created_at DESC LIMIT ? OFFSET ?",
      limit,
      offset,
    ).map((t) => this.task(t.id)!);
  }
  createTask(data: Row): Task {
    const timestamp = data.created_at ?? now();
    this.insert("tasks", {
      id: data.id ?? id().slice(0, 12),
      platform: data.platform,
      original_title: data.title,
      original_content: data.content,
      original_comments: data.comments ?? [],
      style: data.style ?? "professional",
      generation_status: "queued",
      publish_status: "draft",
      active_version_id: null,
      target_account_id: data.target_account_id ?? null,
      publish_policy_override: data.publish_policy ?? null,
      error: null,
      created_at: timestamp,
      updated_at: timestamp,
    });
    const task = this.rows<Task>(
      "SELECT * FROM tasks ORDER BY rowid DESC LIMIT 1",
    )[0];
    this.event(task.id, null, "status", { status: "queued" });
    return this.task(task.id)!;
  }
  deleteTask(key: string): boolean {
    return this.transaction(() => {
      if (!this.task(key)) return false;
      // Keep attempts for audit; cancel all queued work before removing the task.
      this.db
        .prepare(
          "UPDATE publish_schedules SET status='cancelled',updated_at=? WHERE task_id=? AND status IN ('scheduled','failed','paused_import','awaiting_browser','awaiting_approval','needs_handoff')",
        )
        .run(now(), key);
      this.db
        .prepare(
          "UPDATE generation_runs SET status='cancelled',updated_at=? WHERE task_id=? AND status IN ('queued','running','paused_import')",
        )
        .run(now(), key);
      this.delete("tasks", key);
      this.event(key, null, "status", { status: "deleted" });
      return true;
    });
  }
  saveDraft(
    taskId: string,
    html: string,
    source: string,
    prompt: string | null = null,
    expectedVersionId?: string | null,
  ) {
    return this.transaction(() => {
      this.checkDraftBase(taskId, expectedVersionId);
      return this.insertDraftVersion(taskId, html, source, prompt);
    });
  }
  checkDraftBase(taskId: string, expectedVersionId?: string | null): Task {
    const task = this.task(taskId);
    if (!task) throw new HttpError(404, "文章不存在");
    if (expectedVersionId !== undefined && task.active_version_id !== expectedVersionId)
      throw new HttpError(409, "文章已有新版本，请先核对最新正文，不能覆盖后续修改");
    return task;
  }
  /** Persistence primitive; callers own the surrounding transaction. */
  insertDraftVersion(taskId: string, html: string, source: string, prompt: string | null = null) {
    const task = this.task(taskId);
    if (!task) throw new HttpError(404, "文章不存在");
    const sanitized = sanitizeHtml(html);
    const version = this.insert("draft_versions", {
      id: id(),
      task_id: taskId,
      html: sanitized,
      source,
      prompt,
      created_at: now(),
    });
    this.update("tasks", taskId, { active_version_id: version.id, original_title: articleTitle(sanitized, task.original_title) });
    this.event(taskId, null, "status", { status: "draft_saved" });
    return version;
  }
  event(
    taskId: string | null,
    runId: string | null,
    type: string,
    payload: Row,
  ): GenerationEvent {
    const result = this.db
      .prepare(
        "INSERT INTO generation_events(task_id,run_id,event_type,payload,created_at) VALUES(?,?,?,?,?)",
      )
      .run(taskId, runId, type, JSON.stringify(payload), now());
    return {
      id: Number(result.lastInsertRowid),
      task_id: taskId,
      run_id: runId,
      event_type: type,
      payload,
      created_at: now(),
    };
  }
  events(after = 0, runId?: string): GenerationEvent[] {
    return runId
      ? this.rows(
          "SELECT * FROM generation_events WHERE id>? AND run_id=? ORDER BY id LIMIT 200",
          after,
          runId,
        )
      : this.rows(
          "SELECT * FROM generation_events WHERE id>? ORDER BY id LIMIT 200",
          after,
        );
  }
  createRun(data: Row): Run {
    return this.insert("generation_runs", {
      id: id(),
      task_id: null,
      source_task_id: null,
      template_id: null,
      tool_permissions: ["web_search"],
      skill_snapshot: [],
      base_version_id: null,
      base_html: null,
      parent_run_id: null,
      kind: "rewrite",
      system_prompt: "你是一个资深媒体编辑。",
      user_prompt: "",
      partial_html: "",
      error: null,
      ...data,
      status: "queued",
      created_at: now(),
      updated_at: now(),
    });
  }
  template(templateId?: string | null, style?: string): Template | undefined {
    if (templateId) {
      const template = this.get<Template>("rewrite_templates", templateId);
      return template?.enabled ? template : undefined;
    }
    if (style)
      return this.rows<Template>(
        "SELECT * FROM rewrite_templates WHERE style_key=? AND enabled=1",
        style,
      )[0];
    return this.rows<Template>(
      "SELECT * FROM rewrite_templates WHERE enabled=1 ORDER BY created_at LIMIT 1",
    )[0];
  }
  createMedia(data: Row): Asset {
    const assetId = data.id ?? id();
    return this.insert("media_assets", {
      id: assetId,
      task_id: null,
      url: null,
      local_path: null,
      mime_type: null,
      alt_text: "",
      status: "ready",
      metadata_json: {},
      created_at: now(),
      ...data,
      ...(!data.url && data.local_path
        ? { url: `/api/media/${assetId}/content` }
        : {}),
    });
  }
  media(taskId: string): Asset[] {
    return this.rows(
      "SELECT * FROM media_assets WHERE task_id=? ORDER BY created_at",
      taskId,
    );
  }
  account(key: string): Account | undefined {
    return this.get("accounts_v2", key);
  }
  publicAccount(account: Account) {
    return {
      ...account,
      credentials: Object.fromEntries(
        Object.entries(account.credentials ?? {}).map(([key, v]) => [
          key,
          Boolean(v),
        ]),
      ),
    };
  }
  createAccount(data: Row) {
    const account = this.insert<Account>("accounts_v2", {
      id: id(),
      platform: "",
      name: "",
      adapter: "webhook",
      webhook_url: null,
      entry_url: null,
      credentials: {},
      status: "active",
      publish_policy: "manual",
      daily_slots: [],
      delay_min: 10,
      delay_max: 30,
      branding_enabled: true,
      header_html: null,
      footer_html: null,
      ...data,
      created_at: now(),
      updated_at: now(),
    });
    return this.publicAccount(account);
  }
  updateAccount(key: string, data: Row) {
    const existing = this.account(key);
    if (!existing) return undefined;
    const credentials = {
      ...existing.credentials,
      ...Object.fromEntries(
        Object.entries(data.credentials ?? {}).filter(
          ([, v]) => typeof v === "string" && v,
        ),
      ),
    };
    return this.publicAccount(
      this.update<Account>("accounts_v2", key, { ...data, credentials })!,
    );
  }
  createSchedule(data: Row): Schedule {
    return this.transaction(() => {
      const schedule = this.insert<Schedule>("publish_schedules", {
        id: id(),
        status: "scheduled",
        scheduled_at: now(),
        next_attempt_at: data.scheduled_at ?? now(),
        idempotency_key: id(),
        attempt_count: 0,
        last_error: null,
        created_at: now(),
        updated_at: now(),
        ...data,
      });
      this.update("tasks", schedule.task_id, { publish_status: "scheduled" });
      this.event(schedule.task_id, null, "status", {
        publish_status: "scheduled",
      });
      return schedule;
    });
  }
  recover() {
    this.transaction(() => {
      const interruptedBrowserSchedules = this.rows<Schedule>(
        "SELECT s.* FROM publish_schedules s JOIN accounts_v2 a ON a.id=s.account_id WHERE s.status IN ('publishing','paused_import') AND a.adapter='browser'",
      );
      this.db
        .prepare(
          "UPDATE generation_runs SET status='queued' WHERE status IN ('running','paused_import')",
        )
        .run();
      for (const schedule of interruptedBrowserSchedules)
        this.insert("publish_events", { id: id(), schedule_id: schedule.id, stage: "recovery", status: "needs_handoff",
          message: "应用退出时发布结果不明确，请先人工检查公众号状态，系统不会自动重试", summary: {}, created_at: now() });
      this.db
        .prepare(
          "UPDATE tasks SET generation_status='queued' WHERE generation_status IN ('running','paused_import')",
        )
        .run();
      this.db
        .prepare(
          "UPDATE publish_schedules SET status='needs_handoff',last_error='上次公众号操作被应用退出中断，发布结果不明确；请先检查平台状态，系统不会自动重试' WHERE status IN ('publishing','paused_import') AND account_id IN (SELECT id FROM accounts_v2 WHERE adapter='browser')",
        )
        .run();
      this.db
        .prepare("UPDATE tasks SET publish_status='needs_handoff' WHERE id IN (SELECT task_id FROM publish_schedules WHERE status='needs_handoff')")
        .run();
      this.db
        .prepare(
          "UPDATE publish_schedules SET status='scheduled',next_attempt_at=? WHERE status='publishing'",
        )
        .run(now());
      this.db
        .prepare(
          "UPDATE publish_schedules SET status='scheduled' WHERE status='paused_import'",
        )
        .run();
      this.db
        .prepare(
          "UPDATE tasks SET publish_status='scheduled' WHERE publish_status IN ('publishing','paused_import') AND id NOT IN (SELECT task_id FROM publish_schedules WHERE status='needs_handoff')",
        )
        .run();
      for (const asset of this.rows<Asset>(
        "SELECT * FROM media_assets WHERE status IN ('uploading','downloading','validating')",
      ))
        this.update("media_assets", asset.id, {
          status: "failed",
          metadata_json: {
            ...asset.metadata_json,
            error: "媒体处理因应用退出而中断，请重新导入",
          },
        });
    });
  }
}
