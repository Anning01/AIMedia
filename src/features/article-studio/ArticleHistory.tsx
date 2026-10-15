import { Pagination } from "@/components/shared/controls";
import { HistoryFilters } from "./history/HistoryFilters";
import { HistoryWorkList } from "./history/HistoryWorkList";
import { useHistoryBrowser } from "./history/useHistoryBrowser";
import { useArticleWorkspace } from "./workspace-context";
export function ArticleHistory({ onLoad }: { onLoad?: () => void } = {}) {
  const { loadArticle } = useArticleWorkspace();
  const browser = useHistoryBrowser();
  return (
    <section className="creation-history">
      <HistoryFilters
        query={browser.query}
        total={browser.total}
        allCount={browser.history.length}
        onSearch={browser.search}
        onClear={browser.clear}
      />
      <HistoryWorkList
        works={browser.results}
        searching={!!browser.query.trim()}
        onLoad={(work) => {
          loadArticle(work);
          onLoad?.();
        }}
        onRemove={browser.remove}
      />
      <div className="history-pagination">
        <Pagination
          total={browser.total}
          current={browser.page}
          pageSize={browser.pageSize}
          onChange={browser.setPage}
          showTotal={(total, range) =>
            total ? `${range[0]}–${range[1]} / 共 ${total} 篇` : "共 0 篇"
          }
        />
      </div>
    </section>
  );
}
