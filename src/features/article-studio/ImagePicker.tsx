import ImageLibraryModal from "@/components/ImageLibraryModal";
import { useArticleWorkspace } from "./workspace-context";

export function ImagePicker() {
  const { libOpen, libSelectedIds, setLibOpen, handleLibraryConfirm } =
    useArticleWorkspace();

  return (
    <ImageLibraryModal
      open={libOpen}
      maxCount={3}
      initialSelected={libSelectedIds}
      onClose={() => setLibOpen(false)}
      onConfirm={handleLibraryConfirm}
    />
  );
}
