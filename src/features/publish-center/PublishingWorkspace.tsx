import { usePublishLayout } from "./usePublishLayout";
import { Pagination } from "@/components/shared/controls";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PendingContentTable } from "./components/PendingContentTable";
import { PublishedHistoryTable } from "./components/PublishedHistoryTable";
import { PublishEmptyState } from "./components/PublishEmptyState";
import { PublishFilters } from "./components/PublishFilters";
import { PublishStats } from "./components/PublishStats";
import "./publish-center.css";
import { usePublishBrowser } from "./usePublishBrowser";
import { usePublishWorkspace } from "./workspace-context";
export function PublishingWorkspace() {
  const browser = usePublishBrowser();
  const root = usePublishLayout();
  const { pendingArticles, history } = usePublishWorkspace();
  return (
    <div className="publish-workspace" ref={root}>
      <PublishStats />
      <Card className="publish-board">
        <CardContent>
          <Tabs
            value={browser.tab}
            onValueChange={(value) =>
              browser.setTab(value as "pending" | "history")
            }
          >
            <div className="publish-board-heading">
              <TabsList aria-label="发布列表">
                <TabsTrigger value="pending">
                  待发布 <span>{pendingArticles.length}</span>
                </TabsTrigger>
                <TabsTrigger value="history">
                  发布历史 <span>{history.length}</span>
                </TabsTrigger>
              </TabsList>
              <span className="publish-result-count">
                {browser.hasFilters ? "筛选结果" : "全部内容"} · {browser.total}{" "}
                条
              </span>
            </div>
            <PublishFilters browser={browser} />
            <div className="publish-table-area">
              <TabsContent value="pending">
                {browser.pending.length ? (
                  <PendingContentTable items={browser.pending} />
                ) : (
                  <PublishEmptyState
                    tab="pending"
                    filtered={browser.hasFilters}
                    onReset={browser.reset}
                  />
                )}
              </TabsContent>
              <TabsContent value="history">
                {browser.published.length ? (
                  <PublishedHistoryTable items={browser.published} />
                ) : (
                  <PublishEmptyState
                    tab="history"
                    filtered={browser.hasFilters}
                    onReset={browser.reset}
                  />
                )}
              </TabsContent>
            </div>
            <div className="publish-pagination">
              <Pagination
                total={browser.total}
                current={browser.page}
                pageSize={browser.pageSize}
                onChange={browser.setPage}
                showTotal={(total, range) =>
                  total ? `${range[0]}–${range[1]} / 共 ${total} 条` : "共 0 条"
                }
              />
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
