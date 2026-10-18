"use strict";
const { fault } = require("./qiling-api.cjs");
const API_TOKEN_LIMIT = 100000;
const DEFAULT_OUTPUT_TOKENS = 16384;
const DEFAULT_FEE_LIMIT = "0.50";
function moneyUnits(value) {
  const text = String(value);
  if (!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,9})?$/.test(text))
    throw fault("单次预估费用上限须为有效金额，最多 9 位小数", "QILING_BUDGET");
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole) * 1000000000n + BigInt(fraction.padEnd(9, "0"));
}
function validateBudget(maxTokens, maxFee, modelLimit = API_TOKEN_LIMIT) {
  const limit = Math.min(API_TOKEN_LIMIT, Number(modelLimit));
  if (
    !Number.isSafeInteger(maxTokens) ||
    maxTokens < 1 ||
    !Number.isSafeInteger(limit) ||
    maxTokens > limit
  )
    throw fault(
      `请在 AI 配置中设置最大输出量，范围为 1–${limit} Token`,
      "QILING_BUDGET",
    );
  if (
    maxFee === undefined ||
    maxFee === null ||
    maxFee === "" ||
    moneyUnits(maxFee) <= 0n
  )
    throw fault("请在 AI 配置中保存单次预估费用上限", "QILING_BUDGET");
  return { maxTokens, maxFee: String(maxFee) };
}
function checkQuote(quote, maxFee) {
  if (
    quote?.currency !== "CNY" ||
    quote.estimated_fee === undefined ||
    quote.estimated_fee === null
  )
    throw fault(
      "器灵未返回有效人民币费用预估，本次未提交生成",
      "QILING_BUDGET",
    );
  let estimated;
  try {
    estimated = moneyUnits(quote.estimated_fee);
  } catch {
    throw fault("器灵费用预估格式异常，本次未提交生成", "QILING_BUDGET");
  }
  if (estimated > moneyUnits(maxFee))
    throw fault(
      `本次预估 ¥${quote.estimated_fee}，超过单次预估费用上限 ¥${maxFee}，未提交生成。请在 AI 配置中调整预算。`,
      "QILING_BUDGET",
    );
}
function validateThinking(mode, modes = []) {
  if (mode === undefined || mode === "")
    return "";
  if (!["enabled", "disabled"].includes(mode) || !modes.includes(mode))
    throw fault("当前模型不支持所选思考模式，请刷新模型并重新保存", "QILING_THINKING");
  return mode;
}
module.exports = {
  API_TOKEN_LIMIT,
  DEFAULT_OUTPUT_TOKENS,
  DEFAULT_FEE_LIMIT,
  validateBudget,
  checkQuote,
  validateThinking,
};
