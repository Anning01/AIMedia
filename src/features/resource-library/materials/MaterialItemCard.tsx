import { Pencil1Icon,ReloadIcon,TrashIcon } from "@radix-ui/react-icons";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MaterialItem } from "@/data/localStore";

const statuses: Record<
  MaterialItem["status"],
  { label: string; className: string }
> = {
  pending: { label: "未使用", className: "bg-amber-500/12 text-amber-700" },
  using: { label: "使用中", className: "bg-accent text-accent-foreground" },
  used: { label: "已使用", className: "bg-emerald-500/12 text-emerald-700" },
  failed: { label: "失败", className: "bg-destructive/10 text-destructive" },
};

export function MaterialItemCard({
  item,
  onReset,
  onEdit,
  onDelete,
}: {
  item: MaterialItem;
  onReset: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const status = statuses[item.status];
  return (
    <article className="group px-3 py-3 transition-colors hover:bg-muted/40">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="min-w-0 flex-1 truncate text-sm font-medium text-foreground"
          title={item.title}
        >
          {item.title}
        </span>
        {item.isOutline && (
          <Badge
            variant="secondary"
            className="bg-muted font-normal text-muted-foreground"
          >
            大纲
          </Badge>
        )}
        <Badge
          variant="secondary"
          className={cn("font-normal", status.className)}
        >
          {status.label}
        </Badge>
        <div className="flex items-center gap-0.5">
          {item.status !== "pending" && (
            <Button
              variant="ghost"
              size="xs"
              className="text-muted-foreground hover:text-foreground"
              onClick={onReset}
            >
              <ReloadIcon aria-hidden="true" />
              重置
            </Button>
          )}
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground hover:text-foreground"
            onClick={onEdit}
          >
            <Pencil1Icon aria-hidden="true" />
            编辑
          </Button>
          <ConfirmButton
            title="删除该素材？"
            description={item.title}
            confirmText="删除"
            onConfirm={onDelete}
          >
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`删除${item.title}`}
              className="text-muted-foreground hover:text-destructive"
            >
              <TrashIcon aria-hidden="true" />
            </Button>
          </ConfirmButton>
        </div>
      </div>
      <p className="mt-2 line-clamp-3 text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
        {item.content.slice(0, 200)}
      </p>
    </article>
  );
}
