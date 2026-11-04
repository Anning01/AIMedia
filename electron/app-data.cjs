/**
 * 关键业务数据磁盘存储（账号 / 素材库）：
 * - 数据落在 {userData}/app-data.json，不再只依赖渲染进程 localStorage
 * - 凭证字段（token / cookie / secret 等）用 safeStorage 递归加密后入库
 * - 原子写：先写 .tmp 再 rename，避免写到一半掉电导致文件损坏
 * - 老版本数据（localStorage）由渲染进程读取后通过 IPC 回灌到这里
 */
const { app, safeStorage } = require("electron");
const fs = require("fs");
const path = require("path");

const FILE_NAME = "app-data.json";
const VERSION = 1;

// 需要加密的字段名（账号凭证相关），命中即加密；递归处理嵌套结构
const SECRET_FIELDS = new Set([
  "token",
  "cookie",
  "secret",
  "cookies",
  "appSecret",
  "password",
]);

function filePath() {
  return path.join(app.getPath("userData"), FILE_NAME);
}

// 系统安全存储不可用时退回明文，保证数据不丢
function encryptionAvailable() {
  try {
    return (
      safeStorage.isEncryptionAvailable() &&
      safeStorage.getSelectedStorageBackend?.() !== "basic_text"
    );
  } catch {
    return false;
  }
}
function encodeSecret(value) {
  const text = String(value);
  if (!text) return text;
  if (!encryptionAvailable()) return text;
  try {
    return safeStorage.encryptString(text).toString("base64");
  } catch {
    return text;
  }
}

function decodeSecret(value) {
  const text = String(value);
  if (!text) return text;
  if (!encryptionAvailable()) return text;
  try {
    return safeStorage.decryptString(Buffer.from(text, "base64"));
  } catch {
    return text;
  }
}

// recursively encrypt/decrypt sensitive fields
function mapSecrets(value, transform) {
  if (Array.isArray(value))
    return value.map((item) => mapSecrets(item, transform));
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_FIELDS.has(key) && typeof item === "string") {
      out[key] = transform(item);
    } else {
      out[key] = mapSecrets(item, transform);
    }
  }
  return out;
}

function encryptSecrets(data) {
  return mapSecrets(data, encodeSecret);
}

function decryptSecrets(data) {
  return mapSecrets(data, decodeSecret);
}

function readStore() {
  try {
    const raw = fs.readFileSync(filePath(), "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || typeof parsed.data !== "object")
      throw Error("data file format unsupported");
    return { data: parsed.data || {}, corrupted: false };
  } catch (error) {
    if (error.code === "ENOENT") return { data: {}, corrupted: false };
    // keep existing file, report corrupted instead of wiping it
    return { data: {}, corrupted: true };
  }
}

function writeStore(data) {
  const payload = {
    version: VERSION,
    updatedAt: new Date().toISOString(),
    data: encryptSecrets(data && typeof data === "object" ? data : {}),
  };
  const target = filePath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = target + ".tmp";
  fs.writeFileSync(temporary, JSON.stringify(payload, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  try {
    fs.renameSync(temporary, target);
    fs.chmodSync(target, 0o600);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

// read: main process decrypts before returning plain text
function readAppData() {
  const { data, corrupted } = readStore();
  return { ok: true, data: decryptSecrets(data), corrupted };
}

// write: only the given keys are replaced, the rest of the file is kept
function writeAppData(payload) {
  const data = payload && typeof payload === "object" ? payload : null;
  if (!data || Array.isArray(data))
    return { ok: false, error: "invalid data payload" };
  try {
    // 关键：必须先取解密后的明文再合并，避免未修改的敏感字段在多次保存时被二次/多次加密
    const { data: currentPlain } = readAppData();
    writeStore({ ...(currentPlain || {}), ...data });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error && error.message ? error.message : String(error),
    };
  }
}

module.exports = { readAppData, writeAppData, filePath };
