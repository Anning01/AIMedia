import { saveToDraftOnly } from "@/utils/publishPolicy";
import { Modal, message } from "@/components/shared/controls";
import { ARTICLE_TEMPLATES } from "@/data/articleTemplates";
import type { ArticleHistoryItem, QueueItem } from "@/data/localStore";
import {
  addUsage,
  listAccounts,
  listDrafts,
  listQueue,
  loadArticleHistory,
  removeArticleHistory,
  removeQueueItem,
  resolveWechatAuth,
  saveAccount,
  saveDraft,
  saveQueueItem,
  uid,
  updateArticleHistoryStatus,
} from "@/data/localStore";
import { buildInlineHtml } from "@/utils/articleHtml";
import { wechatClaimConfig } from "@/utils/wechatClaim";
import { useEffect, useMemo, useState } from "react";
import { stripTitleDup } from "./model";

export function usePublishCenter({ active = true }: { active?: boolean }) {
  const [pubOpen, setPubOpen] = useState(false);
  const [pubItem, setPubItem] = useState<QueueItem | null>(null);
  const [pubPlatform, setPubPlatform] = useState("公众号");
  const [pubAccountId, setPubAccountId] = useState("");
  const [pubMode, setPubMode] = useState<"publish" | "draft">("draft");
  const [pubLoading, setPubLoading] = useState(false);
  const [pubWechatUsername, setPubWechatUsername] = useState("");
  const [detailItem, setDetailItem] = useState<QueueItem | null>(null);
  const [tick, setTick] = useState(0);
  const messageApi = message;

  // 页面常驻挂载（display:none），切回发布中心时重新读取最新账号/队列
  useEffect(() => {
    if (active) refresh();
  }, [active]);

  const refresh = () => setTick((x) => x + 1);
  const queue = useMemo(listQueue, [tick]);
  const accounts = useMemo(listAccounts, [tick]);
  const historyArticles = useMemo(loadArticleHistory, [tick]);
  // 待发布只展示「生成记录」中未发布的文章
  const pendingArticles = historyArticles.filter((h) => h.status === "待发布");
  const history = queue.filter(
    (q) =>
      q.status === "已发布" || q.status === "失败" || q.status === "已存草稿",
  );
  const retry = (item: QueueItem) => {
    openPlatformPublish(item);
    setPubPlatform(item.platform);
    setPubMode(item.platform === "公众号" ? "draft" : "publish");
    const account = accounts.find(
      (account) =>
        account.platform === item.platform &&
        account.name === item.account &&
        account.authed,
    );
    if (account) setPubAccountId(account.id);
  };
  const deletePending = (item: ArticleHistoryItem) =>
    Modal.confirm({
      title: "删除这篇待发布作品？",
      content: item.title,
      okText: "删除",
      cancelText: "取消",
      okType: "danger",
      onOk: () => {
        removeArticleHistory(item.id);
        listQueue()
          .filter(
            (queueItem) =>
              queueItem.status === "待发布" &&
              (queueItem.id === item.id ||
                (queueItem.title === item.title &&
                  historyArticles.filter((work) => work.title === item.title)
                    .length === 1)),
          )
          .forEach((queueItem) => removeQueueItem(queueItem.id));
        refresh();
        messageApi.success("已删除该生成记录");
      },
    });

  // 从生成记录发布：确保本地草稿存在（含排版 HTML），否则按模板即时生成
  const ensureDraftForHistory = (h: ArticleHistoryItem) => {
    const exist = listDrafts().find(
      (d) => d.title === h.title && d.platform === "公众号",
    );
    if (exist) return;
    const tpl =
      ARTICLE_TEMPLATES.find((t) => t.id === h.templateId) ||
      ARTICLE_TEMPLATES[0];
    const html = buildInlineHtml(
      (h.blocks || []) as unknown as Parameters<typeof buildInlineHtml>[0],
      tpl,
      tpl.accent,
      {},
    );
    const text = (h.blocks || [])
      .map((b) => (b.text ? b.text : b.items ? b.items.join("\n") : ""))
      .filter(Boolean)
      .join("\n\n");
    saveDraft({
      id: uid("draft"),
      platform: "公众号",
      title: h.title,
      content: text,
      html,
      templateId: h.templateId,
      status: "待发布",
      createdAt: h.time,
    });
  };

  const publishFromHistory = (h: ArticleHistoryItem) => {
    ensureDraftForHistory(h);
    openPlatformPublish({
      id: h.id,
      platform: "公众号",
      account: "",
      title: h.title,
      status: "待发布",
      createdAt: h.time,
    });
  };

  const openPlatformPublish = (item: QueueItem) => {
    setPubItem(item);
    setPubPlatform("公众号");
    setPubAccountId("");
    setPubWechatUsername("");
    setPubMode("draft");
    setPubOpen(true);
  };

  const updateResult = (
    title: string,
    status: NonNullable<ArticleHistoryItem["status"]>,
    error?: string,
  ) =>
    updateArticleHistoryStatus(
      title,
      status,
      error,
      historyArticles.some((item) => item.id === pubItem?.id)
        ? pubItem!.id
        : undefined,
    );
  const confirmPlatformPublish = async () => {
    if (!pubItem || pubLoading) return;
    const account = listAccounts().find((a) => a.id === pubAccountId);
    if (!account || account.platform !== pubPlatform) {
      messageApi.warning("请选择目标账号");
      return;
    }
    if (account.authed === false) {
      messageApi.error("该账号已停用，请先在账号中心启用");
      return;
    }
    const platformMap: Record<string, "wechat" | "toutiao" | "baijiahao"> = {
      公众号: "wechat",
      头条号: "toutiao",
      百家号: "baijiahao",
    };
    const platform = platformMap[account.platform];
    if (!platform) {
      messageApi.warning("该平台暂不支持直接发布");
      return;
    }
    const draft =
      listDrafts().find(
        (d) => d.title === pubItem.title && d.platform === pubItem.platform,
      ) || listDrafts().find((d) => d.title === pubItem.title);
    const html = stripTitleDup(
      draft?.html || draft?.content || pubItem.title,
      pubItem.title,
    );
    const coverMatch = html.match(/<img[^>]+src="([^"]+)"/);
    const plainLines = String(html)
      .replace(/<[^>]+>/g, "\n")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const sections0 = JSON.stringify(
      plainLines.map((t, i) => ({
        section_index: 1000000 + i,
        text_content: t,
        section_type: 9,
        ad_available: false,
      })),
    );
    const composeInfo = JSON.stringify({
      list: plainLines.map((t, i) => ({
        blockIdx: i + 1,
        imgList: [],
        text: t,
      })),
    });
    let pubAccountName = account.name;
    setPubLoading(true);
    try {
      let cookie = account.cookie;
      let token = account.token;
      let claimSourceType: number | undefined;
      let isUserNoClaim: number | undefined;
      let copyrightType: number | undefined;
      let wechatTarget = "";
      if (platform === "wechat") {
        wechatTarget =
          pubWechatUsername ||
          (account.wechatAccounts || []).find((w) => w.kind !== "wxa")
            ?.username ||
          "";
        const auth = resolveWechatAuth(account, wechatTarget);
        cookie = auth.cookie || account.cookie;
        token = auth.token || account.token;
        const sub = (account.wechatAccounts || []).find(
          (w) => w.username === wechatTarget,
        );
        pubAccountName = sub?.nickname || wechatTarget || account.name;
        if (sub && sub.enabled === false) {
          messageApi.error("该公众号已停用，请先在账号中心启用");
          return;
        }
        const claim = wechatClaimConfig(sub?.contentDeclaration);
        claimSourceType = claim.claimSourceType;
        isUserNoClaim = claim.isUserNoClaim;
        copyrightType = sub?.copyrightType ?? 0;
        const rr = await window.wangaohui?.wechatRefreshSession({
          token,
          cookie,
          username: wechatTarget || undefined,
          accounts: account.wechatAccounts,
          currentUsername: account.currentUsername,
          fingerprint: account.fingerprint,
        });
        if (rr?.ok && rr.cookies) {
          cookie = rr.cookies;
          token = rr.token || token;
          const nextWechatAccounts = (account.wechatAccounts || []).map((w) =>
            w.username === wechatTarget
              ? {
                  ...w,
                  appid: rr.appid || w.appid,
                  token: rr.token || token,
                  cookies: rr.cookies || cookie,
                }
              : w,
          );
          saveAccount({
            ...account,
            cookie,
            token,
            lastRefresh: rr.lastRefresh,
            currentUsername: rr.currentUsername || wechatTarget || undefined,
            wechatAccounts: nextWechatAccounts,
          });
        } else {
          saveQueueItem({
            ...pubItem,
            platform: account.platform,
            account: pubAccountName,
            status: "失败",
            error: rr?.error || "切换公众号登录态失败",
          });
          updateResult(
            pubItem.title,
            "发布失败",
            rr?.error || "切换公众号登录态失败",
          );
          setPubOpen(false);
          refresh();
          messageApi.error(rr?.error || "切换公众号登录态失败");
          return;
        }
      }
      const r = await window.wangaohui?.platformPublish({
        platform,
        cookie,
        token,
        fingerprint: account.fingerprint,
        title: pubItem.title,
        content: html,
        sections0: "",
        composeInfo: "",
        coverImageUrl: coverMatch?.[1] || undefined,
        saveDraftOnly: saveToDraftOnly(pubPlatform, pubMode),
        wechatUsername: wechatTarget || undefined,
        wechatAccounts: account.wechatAccounts,
        currentUsername: account.currentUsername,
        claimExclusive: account.claimExclusive,
        contentDeclaration: account.contentDeclaration,
        bjhTtv: account.bjhTtv,
        bjhAiTts: account.bjhAiTts,
        bjhAigc: account.bjhAigc,
        claimSourceType,
        isUserNoClaim,
        copyrightType,
      });
      if (r?.ok && (r?.cookies || r?.token)) {
        const nextWechatAccounts = (account.wechatAccounts || []).map((w) =>
          w.username === wechatTarget
            ? {
                ...w,
                token: r.token || w.token,
                cookies: r.cookies || w.cookies,
              }
            : w,
        );
        saveAccount({
          ...account,
          cookie: r.cookies || cookie,
          token: r.token || token,
          lastRefresh: r.lastRefresh || new Date().toISOString(),
          currentUsername: wechatTarget || account.currentUsername,
          wechatAccounts: nextWechatAccounts,
        });
      }
      if (r?.ok) {
        saveQueueItem({
          ...pubItem,
          platform: account.platform,
          account: pubAccountName,
          status: saveToDraftOnly(pubPlatform, pubMode) ? "已存草稿" : "已发布",
          error: undefined,
        });
        updateResult(
          pubItem.title,
          saveToDraftOnly(pubPlatform, pubMode) ? "已存草稿" : "已发布",
        );
        if (!saveToDraftOnly(pubPlatform, pubMode)) {
          try {
            addUsage("发布");
          } catch {
            messageApi.warning("发布已成功，统计记录保存失败");
          }
        }
        messageApi.success(
          saveToDraftOnly(pubPlatform, pubMode)
            ? "已保存到平台草稿箱"
            : `发布成功（${r.method || "publish"}）`,
        );
      } else {
        saveQueueItem({
          ...pubItem,
          platform: account.platform,
          account: pubAccountName,
          status: "失败",
          error: r?.error || "发布失败",
        });
        updateResult(pubItem.title, "发布失败", r?.error || "发布失败");
        messageApi.error(r?.error || "发布失败");
      }
      setPubOpen(false);
      refresh();
    } catch (error) {
      const reason = error instanceof Error ? error.message : "发布失败";
      saveQueueItem({
        ...pubItem,
        platform: account.platform,
        account: pubAccountName,
        status: "失败",
        error: reason,
      });
      updateResult(pubItem.title, "发布失败", reason);
      setPubOpen(false);
      refresh();
      messageApi.error(reason);
    } finally {
      setPubLoading(false);
    }
  };

  return {
    pendingArticles,
    history,
    queue,
    publishFromHistory,
    refresh,
    messageApi,
    retry,
    deletePending,
    detailItem,
    setDetailItem,
    pubOpen,
    setPubOpen,
    confirmPlatformPublish,
    pubMode,
    pubLoading,
    pubItem,
    pubPlatform,
    setPubPlatform,
    setPubAccountId,
    accounts,
    pubAccountId,
    pubWechatUsername,
    setPubWechatUsername,
    setPubMode,
  };
}
