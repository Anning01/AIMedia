import type { ArticleHistoryItem, QueueItem } from "@/data/localStore";
export const PUBLISH_PAGE_SIZE = 10;
export type PublishTab = "pending" | "history";
export function filterPending(
  items: ArticleHistoryItem[],
  query: string,
  kind: string,
) {
  const keyword = query.trim().toLocaleLowerCase();
  return [...items]
    .filter(
      (item) =>
        (!kind || (item.kind || "article") === kind) &&
        (!keyword ||
          [
            item.title,
            item.text || "",
            ...(item.blocks || []).map((block) =>
              [block.text, ...(block.items || [])].join(" "),
            ),
          ]
            .join("\n")
            .toLocaleLowerCase()
            .includes(keyword)),
    )
    .sort((a, b) => (Date.parse(b.time) || 0) - (Date.parse(a.time) || 0));
}
export function filterPublished(
  items: QueueItem[],
  query: string,
  platform: string,
  account: string,
  status: string,
) {
  const keyword = query.trim().toLocaleLowerCase();
  return [...items]
    .filter(
      (item) =>
        (!platform || item.platform === platform) &&
        (!account || item.account === account) &&
        (!status || item.status === status) &&
        (!keyword ||
          [item.title, item.account, item.error || ""]
            .join("\n")
            .toLocaleLowerCase()
            .includes(keyword)),
    )
    .sort(
      (a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0),
    );
}
