import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";

function pageItems(page: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }
  const items: (number | "gap")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);
  if (start > 2) items.push("gap");
  for (let current = start; current <= end; current += 1) items.push(current);
  if (end < pageCount - 1) items.push("gap");
  items.push(pageCount);
  return items;
}

/** 列表分页：上一页 / 页码 / 下一页 + 总数。 */
export function DataPagination({
  total,
  page,
  pageSize,
  onChange,
  className,
}: {
  total: number;
  page: number;
  pageSize: number;
  onChange: (page: number) => void;
  className?: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  if (pageCount <= 1) return null;
  const current = Math.min(Math.max(1, page), pageCount);

  return (
    <nav
      aria-label="分页"
      className={cn(
        "flex flex-wrap items-center justify-center gap-1.5 pt-2",
        className,
      )}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="上一页"
        disabled={current <= 1}
        className="text-muted-foreground"
        onClick={() => onChange(current - 1)}
      >
        <ChevronLeftIcon />
      </Button>
      {pageItems(current, pageCount).map((item, index) =>
        item === "gap" ? (
          <span
            key={`gap-${index}`}
            aria-hidden="true"
            className="px-1 text-xs text-muted-foreground"
          >
            …
          </span>
        ) : (
          <Button
            key={item}
            variant={item === current ? "default" : "ghost"}
            size="icon-sm"
            aria-label={`第 ${item} 页`}
            aria-current={item === current ? "page" : undefined}
            className={item === current ? undefined : "text-muted-foreground"}
            onClick={() => onChange(item)}
          >
            {item}
          </Button>
        ),
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="下一页"
        disabled={current >= pageCount}
        className="text-muted-foreground"
        onClick={() => onChange(current + 1)}
      >
        <ChevronRightIcon />
      </Button>
      <span className="ml-1 text-xs text-muted-foreground">共 {total} 条</span>
    </nav>
  );
}
