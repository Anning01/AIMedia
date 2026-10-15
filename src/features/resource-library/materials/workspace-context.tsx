import { createWorkspaceContext } from "@/components/shared/workspace-context";
import type { useMaterials } from "./useMaterials";
export const [MaterialsProvider, useMaterialsContext] =
  createWorkspaceContext<ReturnType<typeof useMaterials>>("materials");
