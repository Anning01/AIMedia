"use strict";
// 托管任务（无人值守）专用的「去 AI 味」后台执行器。
// 与创作工坊里的人工交互流程（qiling-service.cjs）彼此独立：
// 人工流程需要暂停/继续查询等交互，托管任务则一次调用跑到底。
// 这里复用器灵 open 接口的既有语义：
//   1. 按 2000 字分段；
//   2. 提交后按 task_id 轮询，绝不重新提交已付费的分段；
//   3. 提交结果不明时保留任务号，不自动重试；
//   4. 器灵 Key 变更后不再查询原任务。
const fs = require("fs");
const path = require("path");
const { randomUUID, createHash } = require("crypto");
const { fault, createQilingApi } = require("./qiling-api.cjs");
const fingerprint = (key) => createHash("sha256").update(key).digest("hex");

function splitText(text) {
  const chars = Array.from(text),
    parts = [];
  while (chars.length) parts.push(chars.splice(0, 2000).join(""));
  return parts;
}

const PART_LIMIT = 2000;

function createRemoveRunner({
  config,
  directory,
  api = createQilingApi(),
  now = Date.now,
  pollIntervalMs = 3000,
  timeoutMs = 600000,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  const file = path.join(directory, "qiling-remove-runs.json");
  const busy = new Set();
  const readRuns = () => {
    try {
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      return Array.isArray(data) ? data : [];
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw fault("本机去 AI 后台记录无法读取，请保留文件并检查");
    }
  };
  const writeRuns = (runs) => {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(file + ".tmp", JSON.stringify(runs), { mode: 0o600 });
    fs.renameSync(file + ".tmp", file);
  };
  const updateRun = (run) => {
    const runs = readRuns();
    const index = runs.findIndex((item) => item.id === run.id);
    if (index >= 0) runs[index] = run;
    else runs.push(run);
    writeRuns(runs);
    return run;
  };
  const credentials = () => {
    const cfg = config.runtimeConfig();
    if (!cfg.QILING_API_KEY)
      throw fault("请先在 AI 配置中授权器灵或填写器灵 API Key");
    return cfg.QILING_API_KEY;
  };
  // 提交后立刻落盘任务号：即使中途退出，也能凭 task_id 查询原任务，不重复付费。
  const remember = (run) => updateRun(run);

  const safeRun = (run) =>
    run
      ? {
          ...run,
          keyHash: undefined,
        }
      : null;

  async function submitPart(run, key) {
    const part = run.parts.find((item) => !item.text);
    if (!part || part.taskId) return;
    part.status = "submitting";
    remember(run);
    let data;
    try {
      data = await api.request("/api/v1/open/remove-ai", {
        key,
        method: "POST",
        body: { text: part.source },
      });
    } catch (error) {
      // 提交结果不明（网络中断等）时保留已有任务号，绝不自动重投。
      if (error.taskId) part.taskId = String(error.taskId);
      run.error = error.message;
      // 提交失败也可能已在上游收到并计费：没有任务号也要记 uncertain，
      // 防止下一次提交重复付费（已付费分段绝不重投）。
      run.state = "uncertain";
      remember(run);
      throw error;
    }
    if (!data.task_id) {
      run.state = "uncertain";
      run.error = "去 AI 提交未返回任务号，请核对使用记录，勿重复提交";
      remember(run);
      throw fault(run.error, "QILING_UNCERTAIN");
    }
    part.taskId = String(data.task_id);
    part.status = data.status || "queued";
    part.charged = data.charged;
    part.balance = data.balance;
    remember(run);
    if (data.status === "failed") {
      run.state = "failed";
      run.error = data.message || data.error_code || "去 AI 任务失败";
      remember(run);
      throw fault(run.error, "QILING_REMOVE_FAILED");
    }
  }

  async function pollPart(part, key) {
    const data = await api.request(
      "/api/v1/open/tasks/" + encodeURIComponent(part.taskId),
      { key },
    );
    if (data.status === "completed") {
      if (typeof data.text !== "string" || !data.text.trim())
        throw fault("任务标记完成但未返回文本，请保留原任务号核对");
      part.text = data.text;
      part.status = "completed";
      return true;
    }
    if (data.status === "failed") {
      // 上游明确返回失败：记为失败状态（不是不明），不再重投该分段
      part.status = "failed";
      throw Object.assign(
        new Error(
          data.message || data.error_code || "去 AI 处理失败，费用结算请查看器灵记录",
        ),
        { code: "QILING_REMOVE_FAILED", failed: true },
      );
    }
    if (["queued", "processing"].includes(data.status)) {
      part.status = data.status;
      return false;
    }
    throw fault("任务状态待核对，请保留任务号，勿重复提交", "QILING_UNCERTAIN");
  }

  /**
   * 后台跑完一整篇「去 AI 味」：分段提交 + 按 task_id 轮询，直到拿到候选正文。
   * 成功返回 { ok:true, text }；失败抛出带中文提示的错误，由调用方决定如何记录。
   */
  async function runRemove({ text, allowSplit = false } = {}, owner = "") {
    if (typeof text !== "string" || !text.trim())
      throw fault("去 AI 处理内容为空，请先生成正文");
    if (Array.from(text).length > PART_LIMIT && !allowSplit)
      throw fault(`正文超过 ${PART_LIMIT} 字，请确认分段及调用次数后再提交`);
    if (busy.has("run"))
      throw fault("已有去 AI 后台任务正在执行，请勿重复操作");
    busy.add("run");
    try {
      const key = credentials();
      const keyHash = fingerprint(key);
      const allRuns = readRuns();
      const STALE_MS = 15 * 60 * 1000;
      for (const item of allRuns) {
        if (
          item.keyHash === keyHash &&
          !["completed", "failed"].includes(item.state) &&
          now() - (item.updatedAt || item.createdAt || 0) > STALE_MS
        ) {
          item.state = "failed";
          item.error = "历史去 AI 任务已超时，自动释放";
          item.updatedAt = now();
          updateRun(item);
        }
      }
      const pending = readRuns().find(
        (item) =>
          item.keyHash === keyHash &&
          !["completed", "failed"].includes(item.state),
      );
      // 同一 Key 下已有未完成的后台任务时不再提交新任务，避免重复付费。
      if (pending)
        throw fault(
          `已有未完成的去 AI 后台任务（${pending.id.slice(0, 8)}），请先处理原任务，避免重复付费`,
          "QILING_PENDING",
        );
      // 先查报价与余额，服务不可用时不必付费提交。
      await api.removePrice(key);
      const run = {
        id: randomUUID(),
        owner: String(owner || ""),
        source: text,
        parts: splitText(text).map((source) => ({ source, status: "new" })),
        state: "running",
        keyHash,
        createdAt: now(),
        updatedAt: now(),
      };
      remember(run);
      const deadline = now() + timeoutMs;
      for (;;) {
        const part = run.parts.find((item) => !item.text);
        if (!part) {
          run.state = "completed";
          run.candidate = run.parts.map((item) => item.text).join("");
          run.error = "";
          run.updatedAt = now();
          remember(run);
          return { ok: true, text: run.candidate, run: safeRun(run) };
        }
        if (now() >= deadline) {
          run.state = "uncertain";
          run.error = part.taskId
            ? "去 AI 等待超时，任务号已保留，可稍后继续查询原任务"
            : "去 AI 等待超时，提交结果不明，请核对使用记录";
          run.updatedAt = now();
          remember(run);
          throw fault(run.error, "QILING_TIMEOUT");
        }
        // Key 变更后不能继续查询原任务（会查到别的账号）。
        if (fingerprint(credentials()) !== run.keyHash)
          throw fault("器灵 Key 已变更，请使用提交任务时的 Key 查询", "QILING_KEY_CHANGED");
        if (!part.taskId) await submitPart(run, key);
        else {
          let done;
          try {
            done = await pollPart(part, key);
          } catch (error) {
            if (error.failed) {
              // 上游明确失败：记为终止状态，避免卡住后续提交。
              run.state = "failed";
              run.error = error.message;
              run.updatedAt = now();
              remember(run);
            }
            throw error;
          }
          run.updatedAt = now();
          remember(run);
          if (done) continue;
        }
        await sleep(pollIntervalMs);
      }
    } finally {
      busy.delete("run");
    }
  }

  return {
    runRemove,
    splitText,
    getRun: (id) => safeRun(readRuns().find((item) => item.id === id)),
  };
}

module.exports = { createRemoveRunner, splitText, PART_LIMIT };
