"use strict";
const { app, safeStorage } = require("electron");
const fs = require("fs");
const path = require("path");
const { chatUrl } = require("./ai-client.cjs");
const { BASE, CHAT_PATH, isQilingUrl } = require("./qiling-api.cjs");
const {
  DEFAULT_OUTPUT_TOKENS,
  DEFAULT_FEE_LIMIT,
  validateBudget,
} = require("./qiling-budget.cjs");
const LEGACY = path.join(__dirname, "..", "config", "ai.env");
const DEFAULTS = {
  provider: "custom",
  service: "custom",
  qilingModel: "",
  qilingMaxTokens: DEFAULT_OUTPUT_TOKENS,
  qilingModelLimit: 100000,
  qilingMaxFee: DEFAULT_FEE_LIMIT,
  qilingBudgetConfigured: false,
  baseUrl: "",
  apiPath: "",
  model: "",
  timeout: 180,
  vision: false,
  translationProvider: "llm",
  imageProvider: "seedream",
  imageBaseUrl: "https://ark.cn-beijing.volces.com/api/v3/images/generations",
  imageModel: "doubao-seedream-4-5-251128",
};
const SECRET_FIELDS = [
  "apiKey",
  "youdaoKey",
  "youdaoSecret",
  "imageApiKey",
  "qilingKey",
];
function legacy() {
  const out = {};
  if (!fs.existsSync(LEGACY)) return out;
  for (const line of fs.readFileSync(LEGACY, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}
function filePath() {
  return path.join(app.getPath("userData"), "ai-config.json");
}
function readStored() {
  try {
    const value = JSON.parse(fs.readFileSync(filePath(), "utf8"));
    if (value.version !== 1 || !value.settings || !value.secrets)
      throw Error("AI 配置文件格式不支持");
    return value;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw Error("AI 配置文件无法读取，请检查本机配置文件");
  }
}
function decrypt(value) {
  if (!value) return "";
  if (
    !safeStorage.isEncryptionAvailable() ||
    safeStorage.getSelectedStorageBackend?.() === "basic_text"
  )
    throw Error("系统安全存储不可用，无法读取 API Key");
  return safeStorage.decryptString(Buffer.from(value, "base64"));
}
function readSettings() {
  const stored = readStored();
  if (stored) return { ...DEFAULTS, ...stored.settings };
  const env = legacy();
  if (!env.DEEPSEEK_API_KEY && !env.MINIMAX_API_KEY && !env.PROVIDER)
    return { ...DEFAULTS };
  const provider = env.PROVIDER === "minimax" ? "minimax" : "deepseek";
  return {
    ...DEFAULTS,
    provider,
    baseUrl:
      provider === "minimax"
        ? env.MINIMAX_API_URL || ""
        : env.DEEPSEEK_BASE_URL || "",
    apiPath:
      provider === "minimax" ? "/text/chatcompletion_v2" : "/chat/completions",
    model:
      provider === "minimax"
        ? env.MINIMAX_MODEL || ""
        : env.DEEPSEEK_MODEL || "",
    timeout:
      Number(
        provider === "minimax" ? env.MINIMAX_TIMEOUT : env.DEEPSEEK_TIMEOUT,
      ) || 180,
    translationProvider: env.TRANSLATION_PROVIDER || "llm",
    imageProvider: env.ARK_API_KEY
      ? "seedream"
      : env.MINIMAX_API_KEY
        ? "minimax"
        : DEFAULTS.imageProvider,
    imageBaseUrl: env.ARK_API_KEY
      ? DEFAULTS.imageBaseUrl
      : env.MINIMAX_API_KEY
        ? "https://api.minimaxi.com/v1/image_generation"
        : DEFAULTS.imageBaseUrl,
    imageModel: env.ARK_API_KEY
      ? DEFAULTS.imageModel
      : env.MINIMAX_API_KEY
        ? "image-01"
        : DEFAULTS.imageModel,
  };
}
function getSecrets() {
  const stored = readStored();
  if (stored)
    return Object.fromEntries(
      SECRET_FIELDS.map((key) => [key, decrypt(stored.secrets[key])]),
    );
  const env = legacy();
  return {
    apiKey:
      env.PROVIDER === "minimax"
        ? env.MINIMAX_API_KEY || ""
        : env.DEEPSEEK_API_KEY || "",
    youdaoKey: env.YOUDAO_APP_KEY || "",
    youdaoSecret: env.YOUDAO_APP_SECRET || "",
    imageApiKey: env.ARK_API_KEY || env.MINIMAX_API_KEY || "",
  };
}
function publicConfig() {
  const settings = readSettings();
  const stored = readStored();
  const env = stored ? {} : legacy();
  const flags = stored
    ? Object.fromEntries(
        SECRET_FIELDS.map((key) => [key, !!stored.secrets[key]]),
      )
    : {
        apiKey: !!(settings.provider === "minimax"
          ? env.MINIMAX_API_KEY
          : env.DEEPSEEK_API_KEY),
        youdaoKey: !!env.YOUDAO_APP_KEY,
        youdaoSecret: !!env.YOUDAO_APP_SECRET,
        imageApiKey: !!(env.ARK_API_KEY || env.MINIMAX_API_KEY),
      };
  return {
    ok: true,
    ...settings,
    baseUrl: settings.baseUrl
      ? chatUrl(settings.baseUrl, settings.apiPath)
      : "",
    apiPath: "",
    hasApiKey: flags.apiKey,
    hasYoudaoKey: flags.youdaoKey,
    hasYoudaoSecret: flags.youdaoSecret,
    hasImageKey: flags.imageApiKey,
    hasMinimaxKey:
      (settings.provider === "minimax" && flags.apiKey) ||
      !!env.MINIMAX_API_KEY,
    hasArkKey:
      (settings.imageProvider === "seedream" && flags.imageApiKey) ||
      !!env.ARK_API_KEY,
    service:
      settings.service === "qiling" || isQilingUrl(settings.baseUrl)
        ? "qiling"
        : "custom",
    qilingConfigured: !!stored?.secrets.qilingKey,
    qilingModel: settings.qilingModel || "",
    quickConfig: { status: "available" },
  };
}
function text(value, label, max = 2000) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > max ||
    /[\r\n\0]/.test(value)
  )
    throw Error(`${label}不正确`);
  return value.trim();
}
function validUrl(value, label) {
  const raw = text(value, label);
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw Error(`${label}必须是完整的 HTTP(S) 地址`);
  }
  if (
    !["https:", "http:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  )
    throw Error(`${label}必须是无账号、参数和片段的 HTTP(S) 地址`);
  return raw;
}
function normalize(payload, settings) {
  const apiPath = payload.apiPath ?? settings.apiPath ?? "";
  const next = {
    ...settings,
    service: isQilingUrl(payload.baseUrl) ? "qiling" : "custom",
    baseUrl: validUrl(payload.baseUrl, "接口地址"),
    apiPath: apiPath === "" ? "" : text(apiPath, "接口路径", 300),
    model: text(payload.model, "模型", 200),
    timeout: Number(payload.timeout ?? settings.timeout) || 180,
    translationProvider: "llm",
  };
  if (
    next.apiPath &&
    (!next.apiPath.startsWith("/") ||
      /[?#\\]/.test(next.apiPath) ||
      next.apiPath.startsWith("//"))
  )
    throw Error("接口路径必须以 / 开头");
  if (!Number.isFinite(next.timeout) || next.timeout < 10 || next.timeout > 600)
    throw Error("请求超时须在 10–600 秒之间");
  if (payload.apiKey) text(payload.apiKey, "凭据", 10000);
  return next;
}
function saveConfig(payload) {
  const current = readSettings();
  const settings = normalize(payload, current);
  const previous = getSecrets();
  const secrets = { ...previous };
  if (typeof payload.apiKey === "string" && payload.apiKey.trim())
    secrets.apiKey = payload.apiKey.trim();
  if (!secrets.apiKey) throw Error("请填写 API Key");
  return persist(settings, secrets);
}
function persist(settings, secrets) {
  if (
    !safeStorage.isEncryptionAvailable() ||
    safeStorage.getSelectedStorageBackend?.() === "basic_text"
  )
    throw Error("系统安全存储不可用，暂时无法保存凭据");
  const encrypted = Object.fromEntries(
    SECRET_FIELDS.map((field) => [
      field,
      secrets[field]
        ? safeStorage.encryptString(secrets[field]).toString("base64")
        : "",
    ]),
  );
  const file = filePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + ".tmp";
  fs.writeFileSync(
    temporary,
    JSON.stringify({ version: 1, settings, secrets: encrypted }, null, 2),
    { encoding: "utf8", mode: 0o600 },
  );
  try {
    fs.renameSync(temporary, file);
    fs.chmodSync(file, 0o600);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  return publicConfig();
}
function saveQiling({ apiKey, models, model, maxTokens, maxFee }) {
  const settings = readSettings(),
    secrets = getSecrets();
  if (typeof apiKey !== "string" || !apiKey.startsWith("qk_"))
    throw Error("器灵 API Key 不正确");
  secrets.qilingKey = apiKey;
  const selected = models.find(
    (item) => item.code === (model ?? settings.qilingModel),
  );
  settings.service = "qiling";
  settings.qilingModel = selected?.code || "";
  if (model !== undefined) {
    if (!selected) throw Error("所选文本模型已停用，请刷新模型清单");
    const budget = validateBudget(maxTokens, maxFee, selected.maxTokens);
    settings.qilingMaxTokens = budget.maxTokens;
    settings.qilingMaxFee = budget.maxFee;
    settings.qilingModelLimit = selected.maxTokens;
    settings.qilingBudgetConfigured = true;
  } else if (!selected || settings.qilingMaxTokens > selected.maxTokens) {
    settings.qilingBudgetConfigured = false;
  }
  return persist(settings, secrets);
}
function authorizationSiteCode() {
  return readSettings().qilingAuthSiteCode || "";
}
function saveAuthorizationSiteCode(value) {
  if (typeof value !== "string" || !/^[a-z0-9_-]{0,80}$/.test(value.trim()))
    throw Error("授权来源不正确，请使用原软件授权返回的分站标识");
  const siteCode = value.trim();
  const settings = readSettings();
  // Source metadata is independent of the browser account's Key and model settings.
  persist({ ...settings, qilingAuthSiteCode: siteCode,
    qilingWebsiteOrigin: siteCode === authorizationSiteCode() ? settings.qilingWebsiteOrigin || "" : "",
  }, getSecrets());
  return siteCode;
}
function saveAuthorizationWebsite(siteCode, verificationUrl) {
  const url = new URL(verificationUrl);
  if (url.protocol !== "https:" || url.username || url.password)
    throw Error("器灵授权地址不正确");
  if (siteCode !== authorizationSiteCode()) throw Error("授权来源已切换，请重新操作");
  // Keep only the server-selected origin; never persist browser/device codes.
  persist({ ...readSettings(), qilingWebsiteOrigin: url.origin }, getSecrets());
  return url.origin;
}
function authorizationWebsite() {
  const settings = readSettings();
  if (settings.qilingWebsiteOrigin)
    return new URL(validUrl(settings.qilingWebsiteOrigin, "器灵站点地址")).origin;
  return !authorizationSiteCode() || authorizationSiteCode() === "platform" ? BASE : "";
}
function runtimeConfig() {
  const env = legacy();
  const settings = readSettings();
  const secrets = getSecrets();
  const qiling = settings.service === "qiling" || isQilingUrl(settings.baseUrl);
  return {
    ...env,
    AI_SERVICE: qiling ? "qiling" : "custom",
    QILING_API_KEY:
      secrets.qilingKey ||
      (isQilingUrl(settings.baseUrl) ? secrets.apiKey : ""),
    QILING_MODEL: settings.qilingModel,
    QILING_MAX_TOKENS: settings.qilingMaxTokens,
    QILING_MODEL_LIMIT: settings.qilingModelLimit,
    QILING_MAX_FEE: settings.qilingBudgetConfigured
      ? settings.qilingMaxFee
      : "",
    AI_PROVIDER: settings.provider,
    AI_BASE_URL: qiling ? BASE + CHAT_PATH : settings.baseUrl,
    AI_API_PATH: qiling ? "" : settings.apiPath,
    AI_MODEL: qiling ? settings.qilingModel : settings.model,
    AI_API_KEY: qiling ? secrets.qilingKey || secrets.apiKey : secrets.apiKey,
    AI_TIMEOUT: settings.timeout,
    AI_VISION: qiling ? false : settings.vision,
    TRANSLATION_PROVIDER: "llm",
    TRANSLATION_LLM_PROVIDER: settings.provider,
    YOUDAO_APP_KEY: secrets.youdaoKey,
    YOUDAO_APP_SECRET: secrets.youdaoSecret,
    IMAGE_PROVIDER: settings.imageProvider,
    IMAGE_BASE_URL: settings.imageBaseUrl,
    IMAGE_MODEL: settings.imageModel,
    IMAGE_API_KEY: secrets.imageApiKey,
  };
}
function testConfig(payload) {
  const current = readSettings();
  const settings = normalize({ ...current, ...payload }, current);
  const secrets = getSecrets();
  const key =
    typeof payload.apiKey === "string" && payload.apiKey.trim()
      ? payload.apiKey.trim()
      : current.provider === settings.provider
        ? secrets.apiKey
        : "";
  return {
    ...runtimeConfig(),
    AI_PROVIDER: settings.provider,
    AI_BASE_URL: settings.baseUrl,
    AI_API_PATH: settings.apiPath,
    AI_MODEL: settings.model,
    AI_TIMEOUT: settings.timeout,
    AI_API_KEY: key,
  };
}
module.exports = {
  publicConfig,
  saveConfig,
  runtimeConfig,
  testConfig,
  validUrl,
  saveQiling,
  authorizationSiteCode,
  saveAuthorizationSiteCode,
  saveAuthorizationWebsite,
  authorizationWebsite,
};
