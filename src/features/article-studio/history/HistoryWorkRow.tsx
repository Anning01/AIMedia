import { Button, Tag } from "@/components/shared/controls";
import { TrashIcon } from "@radix-ui/react-icons";
import type { ArticleHistoryItem } from "@/data/localStore";
import { HISTORY_STATUS_COLOR } from "../model";
export function HistoryWorkRow({
  work,
  onLoad,
  onRemove,
}: {
  work: ArticleHistoryItem;
  onLoad: () => void;
  onRemove: () => void;
}) {
  return (
    <article className="ui-list-item history-work-row">
      <button
        type="button"
        className="history-work-open"
        data-history-load
        aria-label={`载入 ${work.title}`}
        onClick={onLoad}
      >
        <div className="history-work-heading">
          <span className="history-work-title">
            {work.title || "未命名作品"}
          </span>
          <Tag color={work.kind === "sticker" ? "purple" : "blue"}>
            {work.kind === "sticker" ? "贴图" : "文章"}
          </Tag>
          {work.status && (
            <Tag color={HISTORY_STATUS_COLOR[work.status] || "default"}>
              {work.status}
            </Tag>
          )}
        </div>
        <div className="history-work-meta">
          <time dateTime={work.time}>
            {new Date(work.time).toLocaleString("zh-CN", { hour12: false })}
          </time>
          {work.status === "发布失败" && work.error && (
            <span>{work.error}</span>
          )}
        </div>
      </button>
      <Button
        type="text"
        size="small"
        danger
        aria-label={`删除 ${work.title}`}
        icon={<TrashIcon />}
        onClick={onRemove}
      />
    </article>
  );
}
