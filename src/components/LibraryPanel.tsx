import { ImageLibraryCategories } from "@/features/resource-library/image-library/ImageLibraryCategories";
import { ImageLibraryGrid } from "@/features/resource-library/image-library/ImageLibraryGrid";
import { ImageLibrarySummary } from "@/features/resource-library/image-library/ImageLibrarySummary";
import { ImageLibraryToolbar } from "@/features/resource-library/image-library/ImageLibraryToolbar";
import { ImageTagsDialog } from "@/features/resource-library/image-library/ImageTagsDialog";
import { ImageUploadDialog } from "@/features/resource-library/image-library/ImageUploadDialog";
import type { Props } from "@/features/resource-library/image-library/model";
import { EMPTY_SELECTION } from "@/features/resource-library/image-library/model";
import { useImageLibrary } from "@/features/resource-library/image-library/useImageLibrary";
import { ImageLibraryProvider } from "@/features/resource-library/image-library/workspace-context";

export default function LibraryPanel({
  selectable = false,
  maxCount = 9,
  selectedIds = EMPTY_SELECTION,
  onSelectedChange,
  refreshKey = 0,
}: Props) {
  const state = useImageLibrary({
    selectable,
    maxCount,
    selectedIds,
    onSelectedChange,
    refreshKey,
  });
  return (
    <ImageLibraryProvider value={state}>
      <div className="min-w-0">
        <ImageLibraryToolbar />
        <ImageLibraryCategories />
        <ImageLibraryGrid />
        <ImageLibrarySummary />
        <ImageUploadDialog />
        <ImageTagsDialog />
      </div>
    </ImageLibraryProvider>
  );
}
