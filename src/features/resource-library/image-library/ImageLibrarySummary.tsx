import { useImageLibraryContext } from "./workspace-context";

export function ImageLibrarySummary() {
  const { assets, filtered } = useImageLibraryContext();
  if (!assets.length) return null;
  return (
    <div className="pt-4 text-center text-xs text-muted-foreground">
      共 {assets.length} 张 · 当前筛选 {filtered.length} 张
    </div>
  );
}
