import { ImageIcon } from "@radix-ui/react-icons";
import { EmptyState } from "@/components/shared/empty-state";
import { MediaImageGroup } from "@/components/shared/media-image";
import { Skeleton } from "@/components/ui/skeleton";
import { RemoteImageCard } from "./RemoteImageCard";
import { useResourceLibraryContext } from "./workspace-context";

export function RemoteImageGrid() {
  const { imgLoading, imgList, savingId, saveImage } =
    useResourceLibraryContext();

  if (imgLoading) {
    return (
      <div
        className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3"
        aria-busy="true"
        role="status"
        aria-label="加载中"
      >
        {Array.from({ length: 12 }).map((_, index) => (
          <Skeleton key={index} className="aspect-[4/3] rounded-lg" />
        ))}
      </div>
    );
  }

  if (!imgList.length) {
    return (
      <EmptyState
        icon={<ImageIcon />}
        title="暂无已打标签的图片"
        description="图片素材会按 AI 标签展示，稍后刷新再试。"
      />
    );
  }

  return (
    <MediaImageGroup>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
        {imgList.map((image) => (
          <RemoteImageCard
            key={image.id}
            image={image}
            saving={savingId === image.id}
            onSave={(item) => void saveImage(item)}
          />
        ))}
      </div>
    </MediaImageGroup>
  );
}
