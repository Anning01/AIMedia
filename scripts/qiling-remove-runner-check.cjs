"use strict";
// 托管任务去 AI 味后台执行器回归检查：仅本地 mock，不产生任何真实付费调用。
const fs = require("fs");
const os = require("os");
const path = require("path");
const assert = require("assert/strict");
const source = path.resolve(__dirname, "..");
const { createRemoveRunner, PART_LIMIT } = require(path.join(source, "electron/qiling-remove-runner.cjs"));
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "wgh-remove-runner-check-"));
const calls = [];
let taskStatus = "auto";
let pollCount = 0;
let taskCount = 0;
let submitThrows = null;
let pollThrows = null;
let submitTaskId = null;
let apiKey = "qk_check_user_key";
const api = {
  request: async (route, options = {}) => {
    calls.push({ route, body: options.body, key: options.key });
    if (route === "/api/v1/open/endpoints")
      return { balance: "10.00", items: [{ code: "remove_ai", enabled: true }] };
    if (route === "/api/v1/open/remove-ai") {
      if (submitThrows)
        throw Object.assign(new Error("器灵连接中断"), { code: "QILING_NETWORK", retryable: false });
      return { task_id: submitTaskId || "task-" + ++taskCount, status: "processing", charged: "0.25" };
    }
    if (route.startsWith("/api/v1/open/tasks/")) {
      pollCount += 1;
      if (pollThrows)
        throw Object.assign(new Error("查询中断"), { code: "QILING_NETWORK", retryable: false });
      if (taskStatus === "auto" && pollCount >= 2)
        return { task_id: route.split("/").at(-1), status: "completed", text: "处理后的正文" };
      if (taskStatus === "failed")
        return { task_id: route.split("/").at(-1), status: "failed", message: "上游处理失败" };
      return { task_id: route.split("/").at(-1), status: taskStatus === "auto" ? "processing" : taskStatus };
    }
    throw new Error("unknown route " + route);
  },
  removePrice: async (key) => {
    calls.push({ route: "/api/v1/open/endpoints", key });
    return { price: "0.25", freeQuota: 2, balance: "10.00", enabled: true };
  },
  models: async () => [],
};
const config = { runtimeConfig: () => ({ QILING_API_KEY: apiKey }) };
const create = (overrides = {}) =>
  createRemoveRunner({
    config,
    directory,
    api,
    pollIntervalMs: 1,
    timeoutMs: 60000,
    sleep: async () => {},
    ...overrides,
  });
const submits = () => calls.filter((call) => call.route === "/api/v1/open/remove-ai");
const polls = () => calls.filter((call) => call.route.startsWith("/api/v1/open/tasks/"));
const runs = () => JSON.parse(fs.readFileSync(path.join(directory, "qiling-remove-runs.json"), "utf8"));
const reset = () => {
  calls.length = 0;
  taskCount = 0;
  taskStatus = "auto";
  pollCount = 0;
  submitThrows = null;
  pollThrows = null;
  submitTaskId = null;
  apiKey = "qk_check_user_key";
  // 每个用例前清掉磁盘上的历史运行记录，避免残留的未完成任务拦截后续用例
  try {
    fs.unlinkSync(path.join(directory, "qiling-remove-runs.json"));
  } catch {}
};
(async () => {
  let code = 0;
  try {
    // 1) 单段文本：只提交一次，轮询用 task_id。
    reset();
    let runner = create();
    const one = await runner.runRemove({ text: "正文内容", allowSplit: true }, "host:1");
    assert.equal(one.text, "处理后的正文");
    assert.equal(submits().length, 1, "单段文本只提交一次");
    assert.equal(taskCount, 1);
    assert(polls().length >= 1, "按 task_id 轮询");
    assert(polls().every((call) => call.route.endsWith("/task-1")), "轮询用原任务号");
    // 2) 超过 2000 字：分段数 == 提交总次数。
    reset();
    runner = create();
    const long = "文".repeat(PART_LIMIT * 2 + 10);
    const many = await runner.runRemove({ text: long, allowSplit: true }, "host:1");
    assert.equal(submits().length, 3, "三段文本提交三次");
    assert.equal(submits().length, Math.ceil(Array.from(long).length / PART_LIMIT), "提交次数等于分段数");
    assert(submits().every((call) => Array.from(call.body.text).length <= PART_LIMIT), "每段不超过 2000 字");
    assert.equal(many.text.length, "处理后的正文".length * 3, "各段结果顺序拼接");
    // 未确认分段时不得提交。
    reset();
    runner = create();
    await assert.rejects(runner.runRemove({ text: "文".repeat(PART_LIMIT + 1) }, "host:1"), /2000/);
    assert.equal(submits().length, 0, "超长未确认分段时零提交");
    // 3) 提交结果不明（无 task_id）：状态 uncertain，绝不自动重投。
    reset();
    runner = create();
    submitThrows = true;
    await assert.rejects(runner.runRemove({ text: "不明的正文", allowSplit: true }, "host:1"), /器灵连接中断/);
    assert.equal(submits().length, 1, "提交失败后不自动重投");
    const uncertain = runs().filter((run) => run.state === "uncertain");
    assert.equal(uncertain.length, 1, "提交结果不明记为 uncertain");
    assert.equal(uncertain[0].parts[0].taskId, undefined, "没有任务号时不伪造");
    submitThrows = false;
    await assert.rejects(runner.runRemove({ text: "不明的正文", allowSplit: true }, "host:1"), /重复付费/);
    assert.equal(submits().length, 1, "未完成任务阻止新的付费提交");
    // 4) 已拿到 task_id 后查询失败：保留任务号，不重新提交。
    reset();
    runner = create();
    pollThrows = true;
    await assert.rejects(runner.runRemove({ text: "查询失败的正文", allowSplit: true }, "host:1"), /查询中断/);
    assert.equal(submits().length, 1, "查询失败不重新提交");
    const kept = runs().filter((run) => run.parts[0].taskId === "task-1");
    assert.equal(kept.length, 1, "任务号已落盘，可继续查询原任务");
    assert(kept[0].state !== "completed", "查询失败不标记完成");
    // 5) Key 在处理中被换掉：报错且不再查原任务。
    reset();
    runner = create({ sleep: async () => { apiKey = "qk_other_key"; } });
    await assert.rejects(runner.runRemove({ text: "换 Key 的正文", allowSplit: true }, "host:1"), /Key 已变更/);
    assert.equal(polls().length, 0, "Key 变更后不再查询原任务");
    // 6) 去 AI 返回 failed：抛中文错误，不返回半成品文本。
    reset();
    runner = create();
    taskStatus = "failed";
    await assert.rejects(runner.runRemove({ text: "上游失败的正文", allowSplit: true }, "host:1"), /上游处理失败/);
    assert.equal(submits().length, 1, "上游失败不重复提交");
    assert.equal(runs().filter((run) => run.state === "failed").length, 1, "记为失败状态");
    // 7) 同一 Key 下已有未完成任务时再调：拒绝。
    reset();
    runner = create();
    submitThrows = true;
    await assert.rejects(runner.runRemove({ text: "占位的正文", allowSplit: true }, "host:1"));
    submitThrows = false;
    await assert.rejects(runner.runRemove({ text: "另一篇正文", allowSplit: true }, "host:1"), /重复付费/);
    assert.equal(submits().length, 1, "被拒绝后不产生新的付费提交");
    // 8) 未配置器灵 Key 时报中文提示，且零提交。
    reset();
    apiKey = "";
    runner = create();
    await assert.rejects(runner.runRemove({ text: "正文", allowSplit: true }, "host:1"), /API Key/);
    assert.equal(submits().length, 0, "未配置 Key 时零提交");
    // 9) 空内容直接报错。
    reset();
    runner = create();
    await assert.rejects(runner.runRemove({ text: "   ", allowSplit: true }, "host:1"), /内容为空/);
    assert.equal(submits().length, 0);
    console.log("PASS: 托管去 AI 味后台执行器——分段数与提交次数相等、按 task_id 轮询、提交不明不重投、任务号落盘、Key 变更停止、上游失败不返回半成品、未完成任务阻止新提交。无真实付费调用。");
  } catch (error) {
    code = 1;
    console.error("FAIL:", error && error.message ? error.message : error);
  }
  process.exit(code);
})();
