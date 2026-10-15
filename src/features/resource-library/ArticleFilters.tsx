import { FilterChips } from "@/components/shared/filter-chips";

export function ArticleFilters({
  categories,
  category,
  total,
  label,
  onChange,
}: {
  categories: string[];
  category: string;
  total: number;
  label: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <FilterChips
        value={category}
        allLabel="全部"
        ariaLabel={`${label}分类`}
        onChange={onChange}
        options={categories.map((value) => ({ value, label: value }))}
        className="min-w-0"
      />
      <span className="text-xs text-muted-foreground">
        {label} · 共 {total} 篇
      </span>
    </div>
  );
}
