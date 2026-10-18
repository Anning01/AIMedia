import { ImageIcon } from "@radix-ui/react-icons";
import { EmptyState } from "@/components/shared/empty-state";
import { ImageLibraryCard } from "./ImageLibraryCard";
import { useImageLibraryContext } from "./workspace-context";

export function ImageLibraryGrid() {
  const { filtered, selected, toggle, openTags, deleteImages, selectable } =
    useImageLibraryContext();

  if (!filtered.length) {
    return (
      <EmptyState
        icon={<ImageIcon />}
        title="图库还是空的"
        description="点「上传图片」，或到「图片素材」把喜欢的图存入图库。"
      />
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-3">
      {filtered.map((asset) => (
        <ImageLibraryCard
          key={asset.id}
          asset={asset}
          selected={selected.includes(asset.id)}
          // 选图模式（弹窗里）点图片就是选中，不弹预览。
          previewable={!selectable}
          onToggle={() => toggle(asset.id)}
          onEditTags={() => openTags(asset)}
          onDelete={() => deleteImages([asset.id])}
        />
      ))}
    </div>
  );
}
