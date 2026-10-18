import { Button } from "@/components/shared/controls";
import { SyncOutlined } from "@/components/shared/icons";
import { ResourceWorkspace } from "@/features/resource-library/ResourceWorkspace";
import {
useResourceLibrary,
type ResourceLibraryProps,
} from "@/features/resource-library/useResourceLibrary";
import { ResourceLibraryProvider } from "@/features/resource-library/workspace-context";
import { PageActions } from "@/layout/page-actions";
export default function ResourceLibrary({
  active = true,
  ...rest
}: ResourceLibraryProps) {
  const state = useResourceLibrary({ active, ...rest });
  const refreshing =
    state.tab === "hot"
      ? state.hotLoading
      : state.tab === "wechat"
        ? state.wxLoading
        : state.tab === "images"
          ? state.imgLoading
          : false;
  return (
    <ResourceLibraryProvider value={state}>
      <PageActions when={active}>
        <Button
          icon={<SyncOutlined />}
          loading={refreshing}
          onClick={() => state.refresh()}
        >
          刷新
        </Button>
      </PageActions>
      <ResourceWorkspace />
    </ResourceLibraryProvider>
  );
}
