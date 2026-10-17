"use strict";
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
function createQilingService({
  config,
  directory,
  openExternal,
  api = createQilingApi(),
  now = Date.now,
  windowMs = 120000,
}) {
  const auth = new Map(),
    busyJobs = new Set();
  const file = path.join(directory, "qiling-remove-tasks.json");
  const readJobs = () => {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw fault("本机去 AI 任务记录无法读取，请保留文件并检查");
    }
  };
  function writeJobs(jobs) {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(file + ".tmp", JSON.stringify(jobs), { mode: 0o600 });
    fs.renameSync(file + ".tmp", file);
  }
  const credentials = () => {
    const cfg = config.runtimeConfig();
    if (!cfg.QILING_API_KEY)
      throw fault("请先在 AI 配置中授权器灵或填写器灵 API Key");
    return cfg.QILING_API_KEY;
  };
  const safeAuth = (session) => ({
    status: session.status,
    expiresAt: session.expiresAt,
    interval: session.interval,
    error: session.error,
    models: session.models,
  });
  async function connect(key, isCurrent = () => true, signal) {
    if (typeof key !== "string" || !/^qk_[A-Za-z0-9_-]+$/.test(key))
      throw fault("请填写有效的器灵 qk_ API Key");
    const models = await api.models(key, signal);
    if (!isCurrent()) throw fault("授权已取消");
    config.saveQiling({ apiKey: key, models });
    return { models, config: config.publicConfig() };
  }
  function cancelAuth(owner) {
    const current = auth.get(owner);
    if (current) {
      current.status = "cancelled";
      current.controller.abort();
      auth.delete(owner);
    }
    return { status: "cancelled" };
  }
  const currentAuth = (owner, session) =>
    auth.get(owner) === session && config.authorizationSiteCode() === session.siteCode;
  const discardAuth = (owner, session) => auth.get(owner) === session
    ? cancelAuth(owner)
    : { status: "cancelled" };
  async function startAuth(owner, source = {}) {
    cancelAuth(owner);
    const session = {
      status: "starting",
      controller: new AbortController(),
      interval: 3000,
      expiresAt: 0,
      busy: false,
    };
    auth.set(owner, session);
    try {
      session.siteCode = Object.hasOwn(source, "site_code")
        ? config.saveAuthorizationSiteCode(source.site_code)
        : config.authorizationSiteCode();
      const data = await api.request("/api/v1/auth/api-key/requests", {
        method: "POST",
        body: {
          client_name: "万稿汇",
          ...(session.siteCode ? { site_code: session.siteCode } : {}),
        },
        signal: session.controller.signal,
      });
      if (!currentAuth(owner, session)) return discardAuth(owner, session);
      const url = new URL(data.verification_url);
      if (
        url.protocol !== "https:" || url.username || url.password ||
        typeof data.device_code !== "string" || !data.device_code ||
        !Number.isFinite(data.expires_in) ||
        data.expires_in <= 0
      )
        throw fault("器灵授权地址或有效期异常");
      session.code = data.device_code;
      session.interval = Math.max(3000, (Number(data.interval) || 3) * 1000);
      session.expiresAt = now() + Math.min(600, data.expires_in) * 1000;
      session.nextPoll = now() + session.interval;
      session.status = "pending";
      await openExternal(data.verification_url);
      return safeAuth(session);
    } catch (error) {
      if (auth.get(owner) === session) {
        session.status = "failed";
        session.error = [404, 409].includes(error.status)
          ? `${error.message}；请联系分站管理员检查分站状态和域名配置`
          : error.message;
        delete session.code;
      }
      return safeAuth(session);
    }
  }
  async function pollAuth(owner) {
    const session = auth.get(owner);
    if (!session) return { status: "cancelled" };
    if (session.status !== "pending" || session.busy) return safeAuth(session);
    if (!currentAuth(owner, session)) return discardAuth(owner, session);
    if (now() >= session.expiresAt) {
      session.status = "expired";
      delete session.code;
      return safeAuth(session);
    }
    if (now() < session.nextPoll) return safeAuth(session);
    session.busy = true;
    session.nextPoll = now() + session.interval;
    try {
      const data = await api.request("/api/v1/auth/api-key/token", {
        method: "POST",
        body: { device_code: session.code },
        signal: session.controller.signal,
      });
      if (!currentAuth(owner, session)) return discardAuth(owner, session);
      if (data.status === "authorized") {
        delete session.code;
        session.status = "saving";
        // Claim exactly once. A failed save is reported, never retried with this device code.
        const result = await connect(
          data.api_key,
          () => currentAuth(owner, session),
          session.controller.signal,
        );
        if (!currentAuth(owner, session)) return discardAuth(owner, session);
        session.models = result.models;
        session.status = "authorized";
      } else if (["denied", "consumed"].includes(data.status)) {
        session.status = data.status;
        delete session.code;
      } else if (data.status !== "pending")
        throw fault("器灵返回未知授权状态，请重新发起");
    } catch (error) {
      if (auth.get(owner) !== session) return { status: "cancelled" };
      if (!currentAuth(owner, session)) return discardAuth(owner, session);
      if (error.status === 429) {
        session.nextPoll =
          now() + Math.max(session.interval, error.retryAfter * 1000);
      } else {
        session.status = error.status === 410 ? "expired" : "failed";
        session.error = error.message;
        delete session.code;
      }
    } finally {
      session.busy = false;
    }
    return safeAuth(session);
  }
  async function selectModel(model, budget = {}) {
    const key = credentials(),
      models = await api.models(key),
      selected = models.find((item) => item.code === model);
    if (!selected) throw fault("所选文本模型已停用，请刷新模型清单");
    config.saveQiling({
      apiKey: key,
      models,
      model: selected.code,
      maxTokens: budget.maxTokens,
      maxFee: budget.maxFee,
    });
    return { models, config: config.publicConfig() };
  }
  const safeJob = (job) =>
    job
      ? {
          ...job,
          keyHash: undefined,
          nextPoll: undefined,
          runStarted: undefined,
        }
      : null;
  function getJob(id) {
    return safeJob(
      id
        ? readJobs().find((job) => job.id === id)
        : readJobs().findLast((job) => job.state !== "adopted"),
    );
  }
  function update(job) {
    const jobs = readJobs();
    const index = jobs.findIndex((item) => item.id === job.id);
    if (index >= 0) jobs[index] = job;
    else jobs.push(job);
    writeJobs(jobs);
    return safeJob(job);
  }
  async function submitPart(job, key) {
    const part = job.parts.find((part) => !part.text);
    if (!part || part.taskId) return;
    part.status = "submitting";
    update(job);
    try {
      const data = await api.request("/api/v1/open/remove-ai", {
        key,
        method: "POST",
        body: { text: part.source },
      });
      if (!data.task_id)
        throw fault(
          "去 AI 提交未返回任务号，请核对使用记录，勿重复提交",
          "QILING_UNCERTAIN",
        );
      if (readJobs().find((item) => item.id === job.id)?.state === "paused")
        job.state = "paused";
      part.taskId = String(data.task_id);
      part.status = data.status;
      part.charged = data.charged;
      part.balance = data.balance;
      if (
        !["queued", "processing", "completed", "failed"].includes(data.status)
      )
        throw fault("去 AI 返回未知任务状态，请核对原任务");
      if (data.status === "failed") {
        part.status = "failed";
        job.state = "failed";
        job.error = data.message || data.error_code || "去 AI 任务失败";
      }
      // Even an immediate completed submission is queried by task_id for its final text.
      job.nextPoll = now() + 3000;
      update(job);
    } catch (error) {
      if (error.taskId) part.taskId = error.taskId;
      job.state = part.taskId
        ? "paused"
        : error.status >= 400 &&
            error.status < 500 &&
            ![408, 409].includes(error.status)
          ? "failed"
          : "uncertain";
      job.error = error.message;
      update(job);
      throw error;
    }
  }
  async function startRemove({ text, allowSplit = false }, owner) {
    if (busyJobs.has("start"))
      throw fault("已有去 AI 提交正在进行，请勿重复操作");
    busyJobs.add("start");
    try {
      if (typeof text !== "string" || !text.trim())
        throw fault("请先填写需要处理的文案");
      if (Array.from(text).length > 2000 && !allowSplit)
        throw fault("超过 2000 字，请确认分段及调用次数后再提交");
      const key = credentials();
      const existing = readJobs().find(
        (job) =>
          job.keyHash === fingerprint(key) &&
          !["adopted", "failed"].includes(job.state),
      );
      if (existing)
        throw fault("已有候选或未完成任务，请先查看并处理原任务，避免重复付费");
      await api.removePrice(key);
      const job = {
        id: randomUUID(),
        owner,
        source: text,
        parts: splitText(text).map((source) => ({ source, status: "new" })),
        state: "running",
        runStarted: now(),
        nextPoll: now() + 3000,
        keyHash: fingerprint(key),
        createdAt: now(),
      };
      update(job);
      busyJobs.add(job.id);
      try {
        await submitPart(job, key);
      } finally {
        busyJobs.delete(job.id);
      }
      return safeJob(readJobs().find((item) => item.id === job.id));
    } finally {
      busyJobs.delete("start");
    }
  }
  async function pollRemove(id) {
    const job = readJobs().find((item) => item.id === id);
    if (!job) throw fault("未找到去 AI 任务");
    if (job.state !== "running" || busyJobs.has(id)) return safeJob(job);
    if (now() - job.runStarted >= windowMs) {
      job.state = "paused";
      job.error = "本轮等待已结束，任务号已保留，可稍后继续查询原任务";
      return update(job);
    }
    if (now() < job.nextPoll) return safeJob(job);
    let key;
    try {
      key = credentials();
      if (fingerprint(key) !== job.keyHash)
        throw fault("器灵 Key 已变更，请使用提交任务时的 Key 查询");
    } catch (error) {
      job.state = "paused";
      job.error = error.message;
      return update(job);
    }
    busyJobs.add(id);
    try {
      const part = job.parts.find((item) => !item.text);
      if (!part.taskId) await submitPart(job, key);
      else {
        const data = await api.request(
          "/api/v1/open/tasks/" + encodeURIComponent(part.taskId),
          { key },
        );
        const latest = readJobs().find((item) => item.id === id);
        const paused = latest.state !== "running";
        if (data.status === "completed") {
          if (typeof data.text !== "string" || !data.text.trim())
            throw fault("任务标记完成但未返回文本，请保留原任务号核对");
          part.text = data.text;
          part.status = "completed";
          if (job.parts.every((item) => item.text)) {
            job.candidate = job.parts.map((item) => item.text).join("");
            job.state = "completed";
            job.error = "";
          } else job.state = paused ? "paused" : "running";
        } else if (data.status === "failed") {
          part.status = "failed";
          job.state = "failed";
          job.error =
            data.message ||
            data.error_code ||
            "去 AI 处理失败，费用结算请查看器灵记录";
        } else if (["queued", "processing"].includes(data.status)) {
          part.status = data.status;
          job.state = paused ? "paused" : "running";
        } else throw fault("任务状态待核对，请保留任务号，勿重复提交");
        job.nextPoll = now() + 3000;
        update(job);
      }
    } catch (error) {
      job.state = "paused";
      job.error = error.message;
      update(job);
    } finally {
      busyJobs.delete(id);
    }
    return safeJob(readJobs().find((item) => item.id === id));
  }
  function pauseRemove(id, owner) {
    const job = id
      ? readJobs().find((item) => item.id === id)
      : readJobs().findLast(
          (item) => item.owner === owner && item.state === "running",
        );
    if (job?.state === "running") {
      job.state = "paused";
      job.error = "已停止等待；上游任务可能仍在处理，可继续查询原任务";
      return update(job);
    }
    return safeJob(job);
  }
  function resumeRemove(id) {
    const job = readJobs().find((item) => item.id === id);
    if (!job || job.state !== "paused") throw fault("该任务不能继续查询");
    job.state = "running";
    job.runStarted = now();
    job.nextPoll = now() + 3000;
    job.error = "";
    return update(job);
  }
  function adoptRemove(id) {
    const job = readJobs().find((item) => item.id === id);
    if (job?.state !== "completed") throw fault("任务尚未完成");
    job.state = "adopted";
    return update(job);
  }
  function stopOwner(owner) {
    cancelAuth(owner);
    for (const job of readJobs().filter(
      (job) => job.owner === owner && job.state === "running",
    ))
      pauseRemove(job.id);
  }
  const previous = readJobs();
  if (previous.some((job) => job.state === "running")) {
    for (const job of previous)
      if (job.state === "running") {
        job.state = job.parts.some(
          (part) => part.status === "submitting" && !part.taskId,
        )
          ? "uncertain"
          : "paused";
        job.error =
          "应用已重启，请继续查询原任务；提交结果不明时请核对使用记录";
      }
    writeJobs(previous);
  }
  return {
    connect,
    startAuth,
    pollAuth,
    cancelAuth,
    selectModel,
    models: () => api.models(credentials()),
    price: () => api.removePrice(credentials()),
    getJob,
    startRemove,
    pollRemove,
    pauseRemove,
    resumeRemove,
    adoptRemove,
    stopOwner,
  };
}
module.exports = { createQilingService, splitText };
