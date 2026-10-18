import { DataPagination } from "@/components/shared/data-pagination";
import { IMG_PAGE_SIZE } from "./model";
import { RemoteImageFilters } from "./RemoteImageFilters";
import { RemoteImageGrid } from "./RemoteImageGrid";
import { useResourceLibraryContext } from "./workspace-context";

export function RemoteImagesTab() {
  const { imgTotal, imgPage, loadImages } = useResourceLibraryContext();
  return (
    <div className="min-w-0">
      <RemoteImageFilters />
      <RemoteImageGrid />
      <DataPagination
        total={imgTotal}
        page={imgPage}
        pageSize={IMG_PAGE_SIZE}
        onChange={(page) => void loadImages(page)}
        className="pt-4"
      />
    </div>
  );
}
