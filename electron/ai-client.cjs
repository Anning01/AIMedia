"use strict";
const { qilingChat } = require("./qiling-chat.cjs");
function chatUrl(baseUrl, apiPath) {
  const url = new URL(baseUrl);
  if (apiPath === "") {
    const pathname = url.pathname.replace(/\/+$/, "");
    if (!pathname) url.pathname = "/v1/chat/completions";
    else if (/\/v\d+(?:beta\d*)?$/.test(pathname))
      url.pathname = pathname + "/chat/completions";
    return url.toString();
  }
  const suffix = apiPath || "/v1/chat/completions";
  if (
    url.pathname.endsWith("/chat/completions") ||
    url.pathname.endsWith("/text/chatcompletion_v2")
  )
    return url.toString();
  const base = url.toString().replace(/\/+$/, "");
  if (
    url.pathname.replace(/\/+$/, "").endsWith("/v1") &&
    suffix.startsWith("/v1/")
  )
    return base + suffix.slice(3);
  return base + suffix;
}
async function requestChat(messages, env, temperature = 0.3) {
  env.signal?.throwIfAborted();
  if (env.service === "qiling") return qilingChat(messages, env, temperature);
  if (!env.key)
    throw Error("尚未配置 AI API Key，请到「AI 配置」保存接口和模型");
  if (!env.url || !env.model)
    throw Error("AI 接口地址或模型未配置，请到「AI 配置」补全");
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    (env.timeout || 180) * 1000,
  );
  try {
    const response = await fetch(env.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.model,
        messages,
        temperature,
        stream: false,
      }),
      signal: env.signal
        ? AbortSignal.any([env.signal, controller.signal])
        : controller.signal,
      redirect: "error",
    });
    const body = await response.text();
    if (!response.ok) {
      const safe = body.split(env.key).join("[已隐藏]").slice(0, 300);
      throw Error(
        `AI 接口返回 HTTP ${response.status}${response.status === 404 ? "：请检查接口地址和路径，服务端未找到该接口" : ""}${safe ? `: ${safe}` : ""}`,
      );
    }
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      throw Error("AI 接口返回了无法解析的响应");
    }
    if (data?.base_resp && Number(data.base_resp.status_code) !== 0)
      throw Error(
        `AI 接口调用失败：${String(
          data.base_resp.status_msg || data.base_resp.status_code,
        )
          .split(env.key)
          .join("[已隐藏]")}`,
      );
    const rawContent = data?.choices?.[0]?.message?.content;
    const content = Array.isArray(rawContent)
      ? rawContent
          .map((block) =>
            typeof block === "string" ? block : block?.text || "",
          )
          .join("\n")
      : rawContent;
    if (typeof content !== "string" || !content.trim())
      throw Error("AI 模型没有返回文本内容，请检查模型和接口路径");
    return content.trim();
  } catch (error) {
    if (error.name === "AbortError")
      throw Error("AI 请求超时，请检查网络或增加请求超时");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
module.exports = { chatUrl, requestChat };
