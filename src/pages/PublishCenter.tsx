import { PlatformPublishDialog } from "@/features/publish-center/PlatformPublishDialog";
import { PublishingWorkspace } from "@/features/publish-center/PublishingWorkspace";
import { PublishDetailsDialog } from "@/features/publish-center/components/PublishDetailsDialog";
import { usePublishCenter } from "@/features/publish-center/usePublishCenter";
import { PublishWorkspaceProvider } from "@/features/publish-center/workspace-context";
export default function PublishCenter({ active = true }: { active?: boolean }) {
  const state = usePublishCenter({ active });
  return (
    <PublishWorkspaceProvider value={state}>
      <PublishingWorkspace />
      <PlatformPublishDialog />
      <PublishDetailsDialog />
    </PublishWorkspaceProvider>
  );
}
