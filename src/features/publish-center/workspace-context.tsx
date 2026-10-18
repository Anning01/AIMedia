import { createWorkspaceContext } from "@/components/shared/workspace-context";
import type { usePublishCenter } from "./usePublishCenter";
export const [PublishWorkspaceProvider, usePublishWorkspace] =
  createWorkspaceContext<ReturnType<typeof usePublishCenter>>("PublishCenter");
