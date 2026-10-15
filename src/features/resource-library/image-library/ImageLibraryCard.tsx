import { BookmarkIcon, TrashIcon } from "@radix-ui/react-icons";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { MediaImage } from "@/components/shared/media-image";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { AssetItem } from "@/data/localStore";
import { FALLBACK_IMG, timeText } from "../model";

export function ImageLibraryCard({
  asset,
  selected,
  previewable = true,
  onToggle,
  onEditTags,
  onDelete,
}: {
  asset: AssetItem;
  selected: boolean;
  /** 图片本身是否可点开预览；选图模式下点击整张卡片即选中。 */
  previewable?: boolean;
  onToggle: () => void;
  onEditTags: () => void;
  onDelete: () => void;
}) {
  const meta = [
    (asset.tags || []).slice(0, 2).join(" · "),
    timeText(asset.createdAt),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle();
        }
      }}
      className="group min-w-0 rounded-xl outline-none"
    >
      <div
        className={cn(
          "relative aspect-[4/3] overflow-hidden rounded-xl bg-muted transition-shadow",
          selected
            ? "ring-2 ring-primary"
            : "group-hover:shadow-[0_6px_16px_rgba(16,24,40,0.10)]",
        )}
        onClick={previewable ? (event) => event.stopPropagation() : undefined}
      >
        <MediaImage
          src={asset.dataUrl || FALLBACK_IMG}
          fallback={FALLBACK_IMG}
          alt={asset.name}
          preview={previewable}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <Checkbox
          aria-label={`选择${asset.name}`}
          checked={selected}
          onClick={(event) => event.stopPropagation()}
          onCheckedChange={onToggle}
          className={cn(
            "absolute top-2 left-2 bg-card/95",
            !selected && "opacity-0 group-hover:opacity-100",
          )}
        />
      </div>
      <div className="mt-1.5 flex items-center gap-1">
        <span
          className="truncate px-0.5 text-xs font-medium text-foreground"
          title={asset.name}
        >
          {asset.name}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`编辑${asset.name}的标签`}
            className="text-muted-foreground hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              onEditTags();
            }}
          >
            <BookmarkIcon aria-hidden="true" />
          </Button>
          <ConfirmButton
            title="删除这张图片？"
            description={asset.name}
            confirmText="删除"
            onConfirm={onDelete}
          >
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`删除${asset.name}`}
              className="text-muted-foreground hover:text-destructive"
              onClick={(event) => event.stopPropagation()}
            >
              <TrashIcon aria-hidden="true" />
            </Button>
          </ConfirmButton>
        </span>
      </div>
      <div
        className={cn(
          "truncate px-0.5 text-[11px] text-muted-foreground",
          !meta && "opacity-0",
        )}
      >
        {meta}
      </div>
    </div>
  );
}
