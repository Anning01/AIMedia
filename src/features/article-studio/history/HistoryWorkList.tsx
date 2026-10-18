import { Empty } from "@/components/shared/controls";
import type { ArticleHistoryItem } from "@/data/localStore";
import { HistoryWorkRow } from "./HistoryWorkRow";
export function HistoryWorkList({
  works,
  searching,
  onLoad,
  onRemove,
}: {
  works: ArticleHistoryItem[];
  searching: boolean;
  onLoad: (work: ArticleHistoryItem) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="history-work-list">
      {works.length ? (
        works.map((work) => (
          <HistoryWorkRow
            key={work.id}
            work={work}
            onLoad={() => onLoad(work)}
            onRemove={() => onRemove(work.id)}
          />
        ))
      ) : (
        <Empty
          description={
            searching
              ? "未找到匹配的作品，试试其他关键词"
              : "暂无历史作品，生成的文章和贴图会保存在这里"
          }
        />
      )}
    </div>
  );
}
