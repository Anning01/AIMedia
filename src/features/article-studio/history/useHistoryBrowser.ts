import { useMemo, useState } from "react";
import { Modal } from "@/components/shared/controls";
import { clearArticleHistory, removeArticleHistory } from "@/data/localStore";
import { useArticleWorkspace } from "../workspace-context";
import { filterHistory, HISTORY_PAGE_SIZE } from "./history-query";
export function useHistoryBrowser() {
  const { history, setHistory, messageApi } = useArticleWorkspace();
  const [query, setQuery] = useState("");
  const [requestedPage, setRequestedPage] = useState(1);
  const filtered = useMemo(
    () => filterHistory(history, query),
    [history, query],
  );
  const page = Math.min(
    requestedPage,
    Math.max(1, Math.ceil(filtered.length / HISTORY_PAGE_SIZE)),
  );
  const results = filtered.slice(
    (page - 1) * HISTORY_PAGE_SIZE,
    page * HISTORY_PAGE_SIZE,
  );
  const search = (value: string) => {
    setQuery(value);
    setRequestedPage(1);
  };
  const remove = (id: string) => {
    try {
      setHistory(removeArticleHistory(id));
      setRequestedPage(page);
      messageApi.success("已删除该记录");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "删除失败");
    }
  };
  const clear = () =>
    Modal.confirm({
      title: `清空全部 ${history.length} 篇历史作品？`,
      content: "将删除所有文章和贴图历史，无法恢复。",
      okText: "清空全部",
      okType: "danger",
      cancelText: "取消",
      onOk: () => {
        setHistory(clearArticleHistory());
        setRequestedPage(1);
        messageApi.success("已清空全部历史作品");
      },
    });
  return {
    history,
    query,
    search,
    page,
    setPage: setRequestedPage,
    results,
    total: filtered.length,
    pageSize: HISTORY_PAGE_SIZE,
    remove,
    clear,
  };
}
