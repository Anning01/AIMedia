import { useMemo, useState } from "react";
import {
  filterPending,
  filterPublished,
  PUBLISH_PAGE_SIZE,
  type PublishTab,
} from "./publish-query";
import { usePublishWorkspace } from "./workspace-context";
export function usePublishBrowser() {
  const { pendingArticles, history } = usePublishWorkspace();
  const [tab, setTab] = useState<PublishTab>("pending");
  const [queries, setQueries] = useState({ pending: "", history: "" });
  const [pages, setPages] = useState({ pending: 1, history: 1 });
  const [kind, setKind] = useState("");
  const [platform, setPlatform] = useState("");
  const [account, setAccount] = useState("");
  const [status, setStatus] = useState("");
  const pending = useMemo(
    () => filterPending(pendingArticles, queries.pending, kind),
    [pendingArticles, queries.pending, kind],
  );
  const published = useMemo(
    () => filterPublished(history, queries.history, platform, account, status),
    [history, queries.history, platform, account, status],
  );
  const accounts = Array.from(
    new Set(
      history
        .filter((item) => !platform || item.platform === platform)
        .map((item) => item.account)
        .filter(Boolean),
    ),
  );
  const total = tab === "pending" ? pending.length : published.length;
  const page = Math.min(
    pages[tab],
    Math.max(1, Math.ceil(total / PUBLISH_PAGE_SIZE)),
  );
  const start = (page - 1) * PUBLISH_PAGE_SIZE;
  const resetPage = () => setPages((previous) => ({ ...previous, [tab]: 1 }));
  const search = (value: string) => {
    setQueries((previous) => ({ ...previous, [tab]: value }));
    resetPage();
  };
  const changeKind = (value: string) => {
    setKind(value);
    resetPage();
  };
  const changePlatform = (value: string) => {
    setPlatform(value);
    setAccount("");
    resetPage();
  };
  const changeAccount = (value: string) => {
    setAccount(value);
    resetPage();
  };
  const changeStatus = (value: string) => {
    setStatus(value);
    resetPage();
  };
  const reset = () => {
    setQueries((previous) => ({ ...previous, [tab]: "" }));
    if (tab === "pending") setKind("");
    else {
      setPlatform("");
      setAccount("");
      setStatus("");
    }
    resetPage();
  };
  return {
    tab,
    setTab,
    query: queries[tab],
    search,
    kind,
    changeKind,
    platform,
    changePlatform,
    account,
    changeAccount,
    status,
    changeStatus,
    accounts,
    total,
    page,
    pageSize: PUBLISH_PAGE_SIZE,
    setPage: (value: number) =>
      setPages((previous) => ({ ...previous, [tab]: value })),
    pending: pending.slice(start, start + PUBLISH_PAGE_SIZE),
    published: published.slice(start, start + PUBLISH_PAGE_SIZE),
    reset,
    hasFilters: !!(
      queries[tab].trim() ||
      (tab === "pending" ? kind : platform || account || status)
    ),
  };
}
