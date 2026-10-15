import { DataPagination } from "@/components/shared/data-pagination";
import { ArticleFilters } from "./ArticleFilters";
import { ArticleList } from "./ArticleList";
import { HOT_PAGE_SIZE, PAGE_SIZE } from "./model";
import { useResourceLibraryContext } from "./workspace-context";

export function ArticleFeedTab({ kind }: { kind: "hot" | "wechat" }) {
  const state = useResourceLibraryContext();
  const hot = kind === "hot";
  const category = hot ? state.hotCategory : state.wxCategory;
  const total = hot ? state.hotTotal : state.wxTotal;
  const pageSize = hot ? HOT_PAGE_SIZE : PAGE_SIZE;
  const load = hot ? state.loadHot : state.loadWx;

  return (
    <div className="min-w-0">
      <ArticleFilters
        categories={state.categories}
        category={category}
        total={total}
        label={hot ? "今日热点" : "微信爆文"}
        onChange={(value) => {
          (hot ? state.setHotCategory : state.setWxCategory)(value);
          void load(1, value);
        }}
      />
      <ArticleList
        articles={hot ? state.hotList : state.wxList}
        loading={hot ? state.hotLoading : state.wxLoading}
        withCover={!hot}
        emptyText={hot ? "今日暂无已分类热点" : "暂无已分类微信爆文"}
        onGenerate={state.handleGenerate}
      />
      <DataPagination
        total={total}
        page={hot ? state.hotPage : state.wxPage}
        pageSize={pageSize}
        onChange={(page) => void load(page)}
        className="pt-4"
      />
    </div>
  );
}
