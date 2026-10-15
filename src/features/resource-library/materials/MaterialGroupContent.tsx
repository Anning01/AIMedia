import { TrashIcon } from "@radix-ui/react-icons";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { Button } from "@/components/ui/button";
import { MaterialItemList } from "./MaterialItemList";
import { useMaterialsContext } from "./workspace-context";

export function MaterialGroupContent() {
  const { active, deleteGroup } = useMaterialsContext();
  if (!active) return null;
  return (
    <section className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-foreground">
            {active.name}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            共 {active.materials.length} 条素材
          </p>
        </div>
        <ConfirmButton
          title="删除整个素材组？"
          description={`「${active.name}」及其 ${active.materials.length} 条素材都会被删除。`}
          confirmText="删除组"
          onConfirm={() => deleteGroup(active.id)}
        >
          <Button variant="destructiveOutline" size="sm">
            <TrashIcon aria-hidden="true" />
            删除组
          </Button>
        </ConfirmButton>
      </div>
      <MaterialItemList />
    </section>
  );
}
