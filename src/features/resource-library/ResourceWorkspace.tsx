import LibraryPanel from "@/components/LibraryPanel";
import MaterialLibraryPanel from "@/components/MaterialLibraryPanel";
import { AnimatedTabs,AnimatedTabsPanel } from "@/components/ui/animated-tabs";
import { Card,CardContent } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { ArticleFeedTab } from "./ArticleFeedTab";
import { RESOURCE_TAB_ORDER } from "./model";
import { RemoteImagesTab } from "./RemoteImagesTab";
import { ResourceErrorBanner } from "./ResourceErrorBanner";
import { ResourceTabBar } from "./ResourceTabBar";
import { useResourceLibraryContext } from "./workspace-context";

export function ResourceWorkspace() {
  const { tab, selectTab, libRefreshKey, matRefreshKey } =
    useResourceLibraryContext();
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ResourceErrorBanner />
      <Card className="gap-0 overflow-hidden rounded-2xl py-0 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <Tabs
          value={tab}
          onValueChange={(value) => selectTab(value)}
          className="gap-0"
        >
          <div className="px-4 pt-4 pb-2">
            <ResourceTabBar />
          </div>
          <CardContent className="min-w-0 px-4 pt-1 pb-4">
            <AnimatedTabs value={tab} order={RESOURCE_TAB_ORDER}>
              <AnimatedTabsPanel value="hot">
                <ArticleFeedTab kind="hot" />
              </AnimatedTabsPanel>
              <AnimatedTabsPanel value="wechat">
                <ArticleFeedTab kind="wechat" />
              </AnimatedTabsPanel>
              <AnimatedTabsPanel value="materials">
                <MaterialLibraryPanel key={matRefreshKey} />
              </AnimatedTabsPanel>
              <AnimatedTabsPanel value="images">
                <RemoteImagesTab />
              </AnimatedTabsPanel>
              <AnimatedTabsPanel value="library">
                <LibraryPanel refreshKey={libRefreshKey} />
              </AnimatedTabsPanel>
            </AnimatedTabs>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
