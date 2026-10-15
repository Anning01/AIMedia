import { ThunderboltOutlined } from "@/components/shared/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ResourceArticle } from "@/utils/resourceApi";
import { useState } from "react";
import { timeText } from "./model";

export function ArticleRow({
  article,
  withCover,
  onGenerate,
}: {
  article: ResourceArticle;
  withCover: boolean;
  onGenerate: (article: ResourceArticle) => void;
}) {
  const [coverFailed, setCoverFailed] = useState(false);
  const cover =
    withCover && !coverFailed && article.images?.length
      ? article.images[0]
      : "";

  return (
    <article className="group flex items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/40">
      {cover && (
        <div className="h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
          <img
            src={cover}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setCoverFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h3
          className="line-clamp-2 text-sm leading-snug font-medium text-foreground"
          title={article.title}
        >
          {article.title}
        </h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <Badge
            variant="secondary"
            className="bg-muted font-normal text-muted-foreground"
          >
            {article.category || "待分类"}
          </Badge>
          <span className="truncate">{article.platform}</span>
          <span aria-hidden="true">·</span>
          <time>{timeText(article.published_at || article.fetched_at)}</time>
        </div>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            onClick={() => onGenerate(article)}
          >
            <ThunderboltOutlined aria-hidden="true" />
            一键生成
          </Button>
        </TooltipTrigger>
        <TooltipContent>跳转到创作工坊并带入素材</TooltipContent>
      </Tooltip>
    </article>
  );
}
