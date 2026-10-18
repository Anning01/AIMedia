import { createWorkspaceContext } from "@/components/shared/workspace-context";
import type { useArticleStudio } from "./useArticleStudio";
export const [ArticleWorkspaceProvider, useArticleWorkspace] =
  createWorkspaceContext<ReturnType<typeof useArticleStudio>>(
    "ArticleWorkspace",
  );
