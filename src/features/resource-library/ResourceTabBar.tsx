import { SegmentedTabs } from "@/components/shared/segmented-tabs";
import { RESOURCE_TABS } from "./model";
import { useResourceLibraryContext } from "./workspace-context";

export function ResourceTabBar() {
  const { tab } = useResourceLibraryContext();
  return (
    <SegmentedTabs
      value={tab}
      ariaLabel="资源分类"
      options={RESOURCE_TABS.map(({ value, label, Icon }) => ({
        value,
        label,
        icon: <Icon aria-hidden="true" />,
      }))}
    />
  );
}
