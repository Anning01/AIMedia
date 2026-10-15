export const STATUS_COLOR: Record<string, string> = {
  已发布: "green",
  已存草稿: "blue",
  失败: "red",
  待发布: "orange",
  草稿: "default",
};

export function stripTitleDup(html: string, title: string): string {
  const normalize = (s: string) =>
    String(s)
      .replace(/\*\*/g, "")
      .replace(/^\s*[*#>]+\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
  const t = normalize(title);
  if (!t) return html;
  const clean = (inner: string) =>
    normalize(
      String(inner)
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .trim(),
    );
  let out = String(html);
  // 标题只走平台标题字段，正文里去掉与标题相同的 <h1> / <p>
  out = out.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (all, inner) => {
    const txt = clean(inner);
    return txt === t || (txt.startsWith(t) && txt.length - t.length <= 20)
      ? ""
      : all;
  });
  out = out.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (all, inner) => {
    const txt = clean(inner);
    return txt === t || (txt.startsWith(t) && txt.length - t.length <= 20)
      ? ""
      : all;
  });
  return out;
}
