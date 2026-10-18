"use strict";
const BASE = "https://toolsoul.daniu7.cn";
const CHAT_PATH = "/v1/chat/completions";
function isQilingUrl(value) {
  try {
    return new URL(value).origin === BASE;
  } catch {
    return false;
  }
}
function fault(message, code = "QILING_ERROR", status = 0) {
  return Object.assign(new Error(message), { code, status, retryable: false });
}
function createQilingApi({
  base = BASE,
  fetcher = (...args) => fetch(...args),
} = {}) {
  async function request(path, { key, method = "GET", body, signal } = {}) {
    signal?.throwIfAborted();
    let response;
    try {
      response = await fetcher(base + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(key
            ? path.startsWith("/v1/")
              ? { Authorization: `Bearer ${key}` }
              : { "x-api-key": key }
            : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: signal
          ? AbortSignal.any([
              signal,
              AbortSignal.timeout(
                method === "GET" || path.includes("/auth/") ? 30000 : 180000,
              ),
            ])
          : AbortSignal.timeout(
              method === "GET" || path.includes("/auth/") ? 30000 : 180000,
            ),
        redirect: "error",
      });
    } catch (error) {
      if (signal?.aborted)
        throw fault(
          "已停止等待；已提交的器灵请求保留原记录，请核对使用记录，勿重复提交",
          "QILING_CANCELLED",
        );
      throw fault(
        error.name === "AbortError"
          ? "请求已停止或超时；如已提交任务，请查询原任务"
          : "器灵连接中断，请先核对使用记录，避免重复提交",
        "QILING_NETWORK",
      );
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw fault("器灵返回格式异常，请核对原调用记录", "QILING_RESPONSE");
    }
    if (!data || typeof data !== "object")
      throw fault("器灵返回格式异常，请核对原调用记录", "QILING_RESPONSE");
    if (!response.ok) {
      const detail =
        typeof data.detail === "string"
          ? data.detail
          : data.error?.message || data.message || `HTTP ${response.status}`;
      const message =
        response.status === 402
          ? "器灵调用余额不足，请充值后再操作"
          : String(detail)
              .replace(/qk_[A-Za-z0-9_-]+/g, "[已隐藏]")
              .split(key || "\0")
              .join("[已隐藏]")
              .split(body?.device_code || "\0")
              .join("[已隐藏]")
              .slice(0, 350);
      const error = fault(
        message,
        response.status === 402 ? "QILING_BALANCE" : "QILING_HTTP",
        response.status,
      );
      error.taskId =
        typeof data.task_id === "string"
          ? data.task_id
          : typeof data.detail?.task_id === "string"
            ? data.detail.task_id
            : undefined;
      error.retryAfter = Math.max(
        3,
        Number(response.headers.get("retry-after")) || 6,
      );
      throw error;
    }
    return data;
  }
  async function models(key, signal) {
    const data = await request("/v1/models", { key, signal });
    if (!Array.isArray(data.data)) throw fault("器灵模型清单格式异常");
    return data.data
      .map((item) => ({ ...item.qiling, code: item.id }))
      .filter((item) => item.kind === "text" && item.enabled === true)
      .map((item) => ({
        code: item.code,
        name: item.name,
        maxTokens: Math.min(
          100000,
          Math.max(1, Number(item.config?.max_output_tokens) || 4096),
        ),
        thinkingModes: item.config?.supports_thinking === true && Array.isArray(item.config.thinking_modes)
          ? [...new Set(item.config.thinking_modes.filter((mode) => ["enabled", "disabled"].includes(mode)))]
          : [],
        pricing: item.config
          ? {
              input: item.config.input_price,
              output: item.config.output_price,
              cache: item.config.cache_price,
            }
          : {},
      }))
      .filter(
        (item) =>
          typeof item.code === "string" && typeof item.name === "string",
      );
  }
  async function removePrice(key) {
    const data = await request("/api/v1/open/endpoints", { key });
    const endpoint = data.items?.find(
      (item) =>
        item.code === "remove_ai" ||
        item.path === "/api/v1/open/remove-ai" ||
        item.path === "/remove-ai",
    );
    if (!endpoint || endpoint.enabled === false)
      throw fault("器灵去 AI 服务当前未启用");
    return {
      price: endpoint.effective_price ?? endpoint.price ?? null,
      freeQuota: endpoint.free_quota ?? null,
      balance: data.balance ?? null,
      enabled: true,
    };
  }
  return { request, models, removePrice };
}
module.exports = { BASE, CHAT_PATH, isQilingUrl, fault, createQilingApi };
