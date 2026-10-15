import { FileTextIcon } from "@radix-ui/react-icons";
import { EmptyState } from "@/components/shared/empty-state";
import { MaterialGroupContent } from "./MaterialGroupContent";
import { MaterialGroupSidebar } from "./MaterialGroupSidebar";
import { useMaterialsContext } from "./workspace-context";

export function MaterialGroups() {
  const { groups } = useMaterialsContext();
  if (!groups.length) {
    return (
      <EmptyState
        icon={<FileTextIcon />}
        title="还没有素材"
        description="导入 txt 或使用 AI 生成大纲素材，之后可以在这里按组管理。"
      />
    );
  }
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <MaterialGroupSidebar />
      <MaterialGroupContent />
    </div>
  );
}
