import { DownloadIcon,ReloadIcon } from "@radix-ui/react-icons";
import { MediaImage } from "@/components/shared/media-image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ResourceImageItem } from "@/utils/resourceApi";
import { FALLBACK_IMG, thumbUrl } from "./model";

export function RemoteImageCard({
  image,
  saving,
  onSave,
}: {
  image: ResourceImageItem;
  saving: boolean;
  onSave: (image: ResourceImageItem) => void;
}) {
  const visibleTags = image.tags.slice(0, 3);
  const restCount = image.tags.length - visibleTags.length;
  const tags = visibleTags.join(" · ");

  return (
    <div className="group flex min-w-0 flex-col">
      <div
        data-testid="remote-image"
        className="aspect-[4/3] overflow-hidden rounded-xl bg-muted"
      >
        <MediaImage
          src={thumbUrl(image.url)}
          previewSrc={image.url}
          alt={image.title || "素材图片"}
          fallback={FALLBACK_IMG}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </div>
      <div
        className={cn(
          "mt-2 truncate px-0.5 text-[11px] text-muted-foreground",
          !tags && "opacity-0",
        )}
        title={image.tags.join(" · ")}
      >
        {tags}
        {restCount > 0 ? ` · +${restCount}` : ""}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="mt-1.5 w-full bg-muted/60 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        disabled={saving}
        onClick={() => onSave(image)}
      >
        {saving ? (
          <ReloadIcon className="animate-spin" aria-hidden="true" />
        ) : (
          <DownloadIcon aria-hidden="true" />
        )}
        存入图片库
      </Button>
    </div>
  );
}
