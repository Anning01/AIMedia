import { createWorkspaceContext } from "@/components/shared/workspace-context";
import type { useAccountCenter as StateHook } from "./useAccountCenter";
export const [AccountCenterProvider, useAccountCenterContext] =
  createWorkspaceContext<ReturnType<typeof StateHook>>("AccountCenter");
