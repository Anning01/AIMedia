import { EmptyState } from "@/components/shared/empty-state";
import { FileTextIcon } from "@radix-ui/react-icons";
import { MaterialItemCard } from "./MaterialItemCard";
import { useMaterialsContext } from "./workspace-context";

export function MaterialItemList() {
  const { active, openEdit, resetMaterial, deleteMaterial } =
    useMaterialsContext();
  if (!active) return null;
  if (!active.materials.length) {
    return (
      <EmptyState
        icon={<FileTextIcon />}
        title="这个素材组还没有内容"
        description="可以通过「AI 生成素材」补充，或导入 txt 后选择该组。"
      />
    );
  }
  return (
    <div className="flex flex-col divide-y divide-border-subtle">
      {active.materials.map((item) => (
        <MaterialItemCard
          key={item.id}
          item={item}
          onEdit={() => openEdit(active.id, item)}
          onReset={() => resetMaterial(active.id, item)}
          onDelete={() => deleteMaterial(active.id, item.id)}
        />
      ))}
    </div>
  );
}
