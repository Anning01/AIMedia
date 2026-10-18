import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FilterChipOption {
  value: string;
  label: string;
}

/**
 * 单选筛选胶囊（分类、标签、规则切换等）。
 * 传 allLabel 时会在最前面插入一个「全部」选项（值 = 空字符串）。
 */
export function FilterChips({
  value,
  options,
  onChange,
  allLabel,
  ariaLabel,
  className,
}: {
  value: string;
  options: FilterChipOption[];
  onChange: (value: string) => void;
  allLabel?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const items = allLabel ? [{ value: "", label: allLabel }, ...options] : options;
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("flex flex-wrap items-center gap-1.5", className)}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <Button
            key={item.value || "__all__"}
            type="button"
            role="radio"
            aria-checked={active}
            variant="ghost"
            size="xs"
            onClick={() => onChange(item.value)}
            className={cn(
              "h-7 rounded-full px-3 text-xs font-normal text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              active &&
                "bg-accent font-medium text-accent-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {item.label}
          </Button>
        );
      })}
    </div>
  );
}
