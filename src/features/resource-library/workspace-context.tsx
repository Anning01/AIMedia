import { createWorkspaceContext } from "@/components/shared/workspace-context";
import type { useResourceLibrary as StateHook } from "./useResourceLibrary";
export const [ResourceLibraryProvider, useResourceLibraryContext] =
  createWorkspaceContext<ReturnType<typeof StateHook>>("ResourceLibrary");
