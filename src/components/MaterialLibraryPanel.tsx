import { MaterialEditDialog } from "@/features/resource-library/materials/MaterialEditDialog";
import { MaterialGenerateDialog } from "@/features/resource-library/materials/MaterialGenerateDialog";
import { MaterialGroups } from "@/features/resource-library/materials/MaterialGroups";
import { MaterialImportDialog } from "@/features/resource-library/materials/MaterialImportDialog";
import { MaterialPromptDialog } from "@/features/resource-library/materials/MaterialPromptDialog";
import { MaterialsToolbar } from "@/features/resource-library/materials/MaterialsToolbar";
import { useMaterials } from "@/features/resource-library/materials/useMaterials";
import { MaterialsProvider } from "@/features/resource-library/materials/workspace-context";

export default function MaterialLibraryPanel() {
  const state = useMaterials();
  return (
    <MaterialsProvider value={state}>
      <div className="min-w-0">
        <MaterialsToolbar />
        <MaterialGroups />
        <MaterialImportDialog />
        <MaterialGenerateDialog />
        <MaterialPromptDialog />
        <MaterialEditDialog />
      </div>
    </MaterialsProvider>
  );
}
