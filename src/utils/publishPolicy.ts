export function saveToDraftOnly(platform: string, mode: "draft" | "publish") {
  return platform === "公众号" || platform === "wechat" || mode === "draft";
}
