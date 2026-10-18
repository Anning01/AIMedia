export const PLATFORMS = ["公众号", "头条号", "百家号", "小红书"] as const;

export const DECLARATIONS = [
  "无需声明",
  "引用站内",
  "自行拍摄",
  "AI生成",
  "取材网络",
  "个人观点，仅供参考",
  "虚构演绎，故事经历",
  "投资观点，仅供参考",
  "健康医疗分享，仅供参考",
];

export function platformKey(
  p: string,
): "wechat" | "toutiao" | "baijiahao" | "xiaohongshu" {
  if (p === "头条号") return "toutiao";
  if (p === "百家号") return "baijiahao";
  if (p === "小红书") return "xiaohongshu";
  return "wechat";
}

export function fmtTime(s?: string): string {
  if (!s) return "";
  const d = new Date(s);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
