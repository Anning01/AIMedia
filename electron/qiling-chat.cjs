"use strict";
const fs = require("fs");
const path = require("path");
const { randomUUID, createHash } = require("crypto");
const { createQilingApi, CHAT_PATH, fault } = require("./qiling-api.cjs");
const { validateBudget, checkQuote, validateThinking } = require("./qiling-budget.cjs");
function createQilingChat({ directory, api = createQilingApi() }) {
  const file = path.join(directory, "qiling-model-requests.json"),
    inflight = new Map();
  function read() {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw fault("本机模型请求记录无法读取，请检查后再调用");
    }
  }
  function write(items) {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(file + ".tmp", JSON.stringify(items), { mode: 0o600 });
    fs.renameSync(file + ".tmp", file);
  }
  return async function chat(messages, env, temperature) {
    env.signal?.throwIfAborted();
    if (!env.key) throw fault("请先授权器灵或配置器灵 API Key");
    if (!env.model) throw fault("请在 AI 配置中选择一个器灵文本模型");
    const budget = validateBudget(env.maxTokens, env.feeLimit, env.modelLimit);
    const thinkingMode = validateThinking(env.thinkingMode, env.thinkingModes);
    const hash = createHash("sha256")
      .update(JSON.stringify([env.key, env.model, messages, temperature]))
      .digest("hex");
    const records = read();
    const unresolved = records.find(
      (item) =>
        item.hash === hash &&
        ["submitting", "unknown", "review", "queued", "running"].includes(
          item.status,
        ),
    );
    if (unresolved)
      throw fault(
        `原调用待核对，请查看器灵使用记录。请求号：${unresolved.requestId}`,
        "QILING_REVIEW",
      );
    const requestId = env.requestId
      ? `${env.requestId.slice(0, 70)}-${hash.slice(0, 16)}`
      : randomUUID();
    if (inflight.has(requestId)) return inflight.get(requestId);
    const prior = records.find((item) => item.requestId === requestId);
    if (prior?.status === "succeeded")
      throw fault(
        "此请求已完成，请使用原结果或发起新的修改",
        "QILING_DUPLICATE",
      );
    const record = {
      requestId,
      hash,
      model: env.model,
      status: "submitting",
      createdAt: Date.now(),
    };
    let submitted = false;
    function patch(value) {
      const list = read(),
        index = list.findIndex((item) => item.requestId === requestId);
      list[index] = { ...list[index], ...value };
      write(list);
    }
    const promise = (async () => {
      try {
        const options = {
          key: env.key,
          signal: env.signal,
          method: "POST",
          body: {
            model: env.model,
            request_id: requestId,
            messages,
            max_tokens: budget.maxTokens,
            temperature,
            ...(thinkingMode ? { thinking: { type: thinkingMode } } : {}),
          },
        };
        const quote = await api.request("/v1/models/estimate", {
          key: env.key,
          signal: env.signal,
          method: "POST",
          body: { kind: "text", request: options.body },
        });
        env.signal?.throwIfAborted();
        checkQuote(quote, budget.maxFee);
        record.maxTokens = budget.maxTokens;
        record.maxFee = budget.maxFee;
        record.estimatedFee = quote.estimated_fee;
        record.thinkingMode = thinkingMode;
        const latest = read();
        latest.push(record);
        write(latest);
        submitted = true;
        const data = await api.request(CHAT_PATH, options);
        const details = data.qiling || {};
        const choice = data.choices?.[0];
        patch({
          status: details.status || "unknown",
          id: details.id,
          fee: details.billing?.fee,
          finishReason: choice?.finish_reason,
          outputTokens: data.usage?.completion_tokens,
          reasoningTokens: data.usage?.completion_tokens_details?.reasoning_tokens,
        });
        const errorMessage = data.error?.message || data.error;
        const failureDetail =
          typeof errorMessage === "string"
            ? errorMessage
                .split(env.key)
                .join("[已隐藏]")
                .replace(/qk_[A-Za-z0-9_-]+/g, "[已隐藏]")
                .slice(0, 300)
            : "";
        if (details.status !== "succeeded")
          throw fault(
            `器灵调用${details.status === "failed" ? "失败" : "待核对"}${failureDetail ? `：${failureDetail}` : ""}，请查看使用记录。请求号：${requestId}`,
            "QILING_REVIEW",
          );
        if (
          typeof choice?.message?.content !== "string" ||
          !choice.message.content.trim()
        ) {
          patch({ status: "review" });
          throw fault(
            `器灵未返回正文，可能达到输出预算；原调用已保留待核对，请查看使用记录，勿重复提交。请求号：${requestId}`,
            "QILING_REVIEW",
          );
        }
        return choice.message.content.trim();
      } catch (error) {
        if (submitted && error.code !== "QILING_REVIEW")
          patch({
            status:
              error.status >= 400 &&
              error.status < 500 &&
              ![408, 409].includes(error.status)
                ? "failed"
                : "review",
          });
        throw Object.assign(error, { retryable: false });
      } finally {
        inflight.delete(requestId);
      }
    })();
    inflight.set(requestId, promise);
    return promise;
  };
}
let client;
function qilingChat(messages, env, temperature) {
  if (!client)
    client = createQilingChat({
      directory: require("electron").app.getPath("userData"),
    });
  return client(messages, env, temperature);
}
module.exports = { createQilingChat, qilingChat };
