import { EmptyState } from "@/components/shared/empty-state";
import { FileTextIcon } from "@radix-ui/react-icons";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import type { ResourceArticle } from "@/utils/resourceApi";
import { ArticleRow } from "./ArticleRow";

function ArticleListSkeleton({
  rows,
  withCover,
}: {
  rows: number;
  withCover: boolean;
}) {
  return (
    <div className="flex flex-col" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-3 py-3">
          {withCover && <Skeleton className="h-14 w-24 shrink-0 rounded-lg" />}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ArticleList({
  articles,
  loading,
  withCover,
  emptyText,
  onGenerate,
}: {
  articles: ResourceArticle[];
  loading: boolean;
  withCover: boolean;
  emptyText: string;
  onGenerate: (article: ResourceArticle) => void;
}) {
  if (loading) {
    return (
      <div aria-busy="true" role="status" aria-label="加载中">
        <ArticleListSkeleton rows={5} withCover={withCover} />
      </div>
    );
  }
  if (!articles.length) {
    return (
      <EmptyState
        icon={<FileTextIcon />}
        title={emptyText}
        description="换个分类看看，或稍后重试。"
      />
    );
  }
  return (
    <TooltipProvider>
      <div className="flex flex-col divide-y divide-border-subtle">
        {articles.map((article) => (
          <ArticleRow
            key={article.id}
            article={article}
            withCover={withCover}
            onGenerate={onGenerate}
          />
        ))}
      </div>
    </TooltipProvider>
  );
}
