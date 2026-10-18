import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MaterialGroup } from "@/data/localStore";

export function MaterialGroupOption({
  group,
  selected,
  onSelect,
}: {
  group: MaterialGroup;
  selected: boolean;
  onSelect: () => void;
}) {
  const unused = group.materials.filter(
    (item) => item.status !== "used" && item.status !== "using",
  ).length;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "w-full rounded-[10px] px-3 py-2 text-left transition-colors",
        selected
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <div className="truncate text-[13px] font-medium">{group.name}</div>
      <div className="mt-1 flex items-center gap-2 text-[11px] opacity-80">
        <Badge
          variant="secondary"
          className="bg-card/70 px-1.5 py-0 font-normal"
        >
          {group.source === "ai" ? "AI" : "txt"}
        </Badge>
        <span>
          未用 {unused}/{group.materials.length}
        </span>
      </div>
    </button>
  );
}
