import { FilterChips } from "@/components/shared/filter-chips";
import { useImageLibraryContext } from "./workspace-context";

export function ImageLibraryCategories() {
  const { tag, setTag, tags } = useImageLibraryContext();
  if (!tags.length) return null;
  return (
    <FilterChips
      className="mb-3"
      value={tag}
      allLabel="全部"
      ariaLabel="图片分类"
      onChange={setTag}
      options={tags.map((item) => ({ value: item, label: item }))}
    />
  );
}
