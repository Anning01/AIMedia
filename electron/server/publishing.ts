import { DateTime } from "luxon";
import { gt, valid } from "semver";
import { sanitizeHtml } from "./content.js";
import { Store, id } from "./store.js";
import {
  type Account,
  type Policy,
  type Row,
  type Schedule,
  now,
  errorMessage,
  HttpError,
} from "./types.js";
import type { Fetch } from "./generation.js";

export function nextDailySlot(
  nowDate: Date,
  slots: string[],
  zone: string,
  occupied: Set<number> = new Set(),
): string {
  const local = DateTime.fromJSDate(nowDate, { zone });
  if (!local.isValid) throw new HttpError(422, "系统时区无效");
  if (!slots.length || slots.some((s) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(s)))
    throw new HttpError(422, "至少配置一个有效的每日时间槽（HH:mm）");
  for (let day = 0; day < 366; day++)
    for (const slot of [...new Set(slots)].sort()) {
      const [hour, minute] = slot.split(":").map(Number),
        candidate = local
          .plus({ days: day })
          .startOf("day")
          .set({ hour, minute });
      if (candidate > local && !occupied.has(candidate.toMillis()))
        return candidate.toUTC().toISO()!;
    }
  throw new HttpError(409, "一年内没有可用的发布时间槽");
}
export function createSchedule(
  store: Store,
  taskId: string,
  account: Account,
  policy: Policy,
): Schedule {
  let target = now();
  if (policy === "daily_slots")
    target = nextDailySlot(
      new Date(),
      account.daily_slots,
      store.config().timezone || "Asia/Shanghai",
      new Set(
        store
          .rows<Schedule>(
            "SELECT * FROM publish_schedules WHERE account_id=? AND status IN ('scheduled','publishing')",
            account.id,
          )
          .map((s) => Date.parse(s.scheduled_at)),
      ),
    );
  if (policy === "random_delay") {
    if (account.delay_min < 0 || account.delay_max < account.delay_min)
      throw new HttpError(422, "随机延迟范围无效");
    target = new Date(
      Date.now() +
        (account.delay_min +
          Math.floor(
            Math.random() * (account.delay_max - account.delay_min + 1),
          )) *
          60_000,
    ).toISOString();
  }
  return store.createSchedule({
    task_id: taskId,
    account_id: account.id,
    policy,
    scheduled_at: target,
  });
}
export class Publisher {
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  private abort = new AbortController();
  constructor(
    readonly store: Store,
    readonly request: Fetch = fetch,
    readonly mediaPath: (path: string) => string = (path) => path,
  ) {}
  start() {
    this.timer = setInterval(() => {
      if (!this.running) {
        this.running = this.tick()
          .catch((error) => console.error("发布调度失败", errorMessage(error)))
          .finally(() => {
            this.running = undefined;
          });
      }
    }, 5000);
    this.timer.unref();
  }
  async stop() {
    clearInterval(this.timer);
    this.abort.abort();
    await this.running;
  }
  async tick() {
    for (const schedule of this.store.rows<Schedule>(
      "SELECT * FROM publish_schedules WHERE status='scheduled' AND julianday(next_attempt_at)<=julianday(?)",
      now(),
    )) {
      if (this.abort.signal.aborted) break;
      await this.publish(schedule);
    }
  }
  async publish(schedule: Schedule) {
    const s = this.store,
      task = s.task(schedule.task_id),
      account = s.account(schedule.account_id);
    const state = (status: string, values: Row = {}) => {
      s.update("publish_schedules", schedule.id, { status, ...values });
      if (task) {
        s.update("tasks", task.id, { publish_status: status });
        s.event(task.id, null, "status", { publish_status: status });
      }
    };
    if (!task || !account) {
      state("failed", { last_error: "任务或账号不存在" });
      return;
    }
    if (account.status !== "active") {
      state("failed", { last_error: "发布账号已停用" });
      return;
    }
    if (!task.html || ["queued", "running"].includes(task.generation_status)) {
      state("scheduled", {
        next_attempt_at: new Date(Date.now() + 30_000).toISOString(),
      });
      return;
    }
    const media = s.media(task.id),
      unready = media.filter((a) => a.status !== "ready");
    if (unready.length) {
      state("scheduled", {
        next_attempt_at: new Date(Date.now() + 30_000).toISOString(),
        last_error: `存在 ${unready.length} 个失败或未完成媒体，请修复或删除后发布`,
      });
      return;
    }
    const c = s.config(),
      base = String(c.public_base_url || "").replace(/\/$/, "");
    if (
      !base &&
      (media.some((a) => a.url?.startsWith("/api/media/")) ||
        /(?:src|poster)="\/api\/media\//.test(task.html))
    ) {
      state("failed", {
        last_error:
          "发布包含本地媒体，请先在设置中配置接收方可访问的外部访问地址",
      });
      return;
    }
    const resolveUrl = (url: string) =>
      url.startsWith("/") && base ? `${base}${this.mediaPath(url)}` : url;
    const body = account.branding_enabled
      ? `${account.header_html || c.branding_header_html || ""}${task.html}${account.footer_html || c.branding_footer_html || ""}`
      : task.html;
    const html = sanitizeHtml(body).replace(
      /(src|poster)="(\/api\/media\/[^"]+)"/g,
      (_, attr, url) => `${attr}="${resolveUrl(url)}"`,
    );
    const payload = {
      publication_id: schedule.id,
      idempotency_key: schedule.idempotency_key,
      task_id: task.id,
      account_id: account.id,
      title:
        /<h1[^>]*>(.*?)<\/h1>/s.exec(task.html)?.[1]?.replace(/<[^>]+>/g, "") ||
        task.original_title,
      html,
      media: media.map((a) => ({
        id: a.id,
        type: a.media_type,
        url: resolveUrl(a.url || ""),
        alt: a.alt_text,
      })),
      source: { platform: task.platform, captured_at: task.created_at },
      scheduled_at: schedule.scheduled_at,
    };
    state("publishing");
    const summary = {
      task_id: task.id,
      account_id: account.id,
      idempotency_key: schedule.idempotency_key,
    };
    const retry = (message: string) =>
      state("scheduled", {
        attempt_count: schedule.attempt_count + 1,
        next_attempt_at: new Date(
          Date.now() +
            Math.min(3600, 2 ** Math.min(20, schedule.attempt_count + 1) * 30) *
              1000,
        ).toISOString(),
        last_error: message,
      });
    try {
      if (account.adapter !== "webhook" || !account.webhook_url)
        throw new Error("请为账号配置 Webhook 地址");
      const response = await this.request(account.webhook_url, {
        method: "POST",
        redirect: "error",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": schedule.idempotency_key,
          ...(account.credentials.token
            ? { Authorization: `Bearer ${account.credentials.token}` }
            : {}),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.any([
          this.abort.signal,
          AbortSignal.timeout(30_000),
        ]),
      });
      const error = response.ok ? null : (await response.text()).slice(0, 500);
      s.insert("publish_attempts", {
        id: id(),
        schedule_id: schedule.id,
        request_summary: summary,
        response_status: response.status,
        error,
        created_at: now(),
      });
      if (response.ok)
        state("published", {
          attempt_count: schedule.attempt_count + 1,
          last_error: null,
        });
      else if (response.status >= 500 || response.status === 429)
        retry(error || `HTTP ${response.status}`);
      else
        state("failed", {
          attempt_count: schedule.attempt_count + 1,
          last_error: error,
        });
    } catch (error) {
      s.insert("publish_attempts", {
        id: id(),
        schedule_id: schedule.id,
        request_summary: summary,
        response_status: null,
        error: errorMessage(error),
        created_at: now(),
      });
      retry(errorMessage(error));
    }
  }
}
export async function checkVersion(
  store: Store,
  currentVersion: string,
  request: Fetch = fetch,
  signal?: AbortSignal,
): Promise<Row> {
  const config = store.config(),
    repository = String(config.github_repository || "");
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository))
    return {
      status: "unconfigured",
      current_version: currentVersion,
      update_available: false,
    };
  try {
    const cache = config.version_cache;
    const timeout = AbortSignal.timeout(10_000);
    const response = await request(
      `https://api.github.com/repos/${repository}/releases/latest`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "ai-media-desktop",
          ...(config.github_etag && cache
            ? { "If-None-Match": config.github_etag }
            : {}),
          ...(config.github_token
            ? { Authorization: `Bearer ${config.github_token}` }
            : {}),
        },
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      },
    );
    if (response.status === 304 && cache)
      return {
        ...cache,
        status: "not_modified",
        current_version: currentVersion,
      };
    if (!response.ok) throw new Error(`GitHub 返回 ${response.status}`);
    const data = (await response.json()) as Row,
      latest = String(data.tag_name || "");
    const result = {
      status: "ok",
      current_version: currentVersion,
      latest_version: latest,
      release_url: data.html_url,
      update_available: Boolean(
        valid(latest) && valid(currentVersion) && gt(latest, currentVersion),
      ),
    };
    store.setConfig("version_cache", result);
    if (response.headers.get("etag"))
      store.setConfig("github_etag", response.headers.get("etag"));
    return result;
  } catch (error) {
    return {
      status: "unavailable",
      current_version: currentVersion,
      update_available: false,
      message: errorMessage(error),
    };
  }
}
