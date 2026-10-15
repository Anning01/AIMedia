import { createWorkspaceContext } from "@/components/shared/workspace-context";
import type { useImageLibrary } from "./useImageLibrary";
export const [ImageLibraryProvider, useImageLibraryContext] =
  createWorkspaceContext<ReturnType<typeof useImageLibrary>>("image-library");
