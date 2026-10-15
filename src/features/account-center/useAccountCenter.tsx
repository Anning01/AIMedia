import { message } from "@/components/shared/controls";
import type { AccountItem } from "@/data/localStore";
import {
listAccounts,
mergeWechatAccounts,
resolveWechatAuth,
saveAccount,
uid,
} from "@/data/localStore";
import { useEffect,useMemo,useRef,useState } from "react";
import { platformKey } from "./model";

const COLLAPSED_KEY = "wangaohui:account-collapsed";

/** 读取分组展开/收起状态（存储失败时退回全展开）。 */
function readCollapsedState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, boolean>)
      : {};
  } catch {
    return {};
  }
}

function writeCollapsedState(state: Record<string, boolean>) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(state));
  } catch {
    // 忽略写入失败（隐私模式 / 配额）
  }
}

export function useAccountCenter({ active = true }: { active?: boolean }) {
  const [tick, setTick] = useState(0);
  const accounts = useMemo(listAccounts, [tick]);
  const refresh = () => setTick((x) => x + 1);
  const [activeTab, setActiveTab] = useState<string>("公众号");
  // 分组展开/收起状态按账号 id 持久化，切页回来保持原样
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    readCollapsedState(),
  );
  // 账号列表的搜索与过滤（"all" | "enabled" | "disabled" / "all" | "mp" | "wxa"）
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");

  useEffect(() => {
    writeCollapsedState(collapsed);
  }, [collapsed]);

  const [addOpen, setAddOpen] = useState(false);
  const [accountModal, setAccountModal] = useState<AccountItem | null>(null);
  const [acctPlatform, setAcctPlatform] = useState<string>("公众号");
  const [acctName, setAcctName] = useState("");
  const [acctAppId, setAcctAppId] = useState("");
  const [acctSecret, setAcctSecret] = useState("");
  const [acctCookie, setAcctCookie] = useState("");
  const [acctToken, setAcctToken] = useState("");
  const [acctUserId, setAcctUserId] = useState("");
  const [acctAvatar, setAcctAvatar] = useState("");
  const [acctWechatAccounts, setAcctWechatAccounts] = useState<
    AccountItem["wechatAccounts"]
  >([]);
  const [syncingWechat, setSyncingWechat] = useState("");
  const [backendLoading, setBackendLoading] = useState("");

  const [loginOpen, setLoginOpen] = useState(false);
  const [loginSession, setLoginSession] = useState<PlatformLoginSession | null>(
    null,
  );
  const [loginStatus, setLoginStatus] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const pollTimerRef = useRef<number | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const clearPoll = () => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  useEffect(
    () => () => {
      clearPoll();
    },
    [],
  );

  // 页面常驻挂载（display:none），切回账号中心时必须重新读取最新账号数据
  useEffect(() => {
    if (active) refresh();
  }, [active]);

  const resetForm = () => {
    setAcctPlatform("公众号");
    setAcctName("");
    setAcctAppId("");
    setAcctSecret("");
    setAcctCookie("");
    setAcctToken("");
    setAcctUserId("");
    setAcctAvatar("");
    setAcctWechatAccounts([]);
  };

  const openAddAccount = () => {
    setAccountModal(null);
    resetForm();
    setAcctPlatform(activeTab);
    setAddOpen(true);
    if (activeTab !== "公众号") {
      // 头条/百家无需备注：点「添加账号」后直接自动打开登录窗口
      setTimeout(() => {
        startPlatformLogin(activeTab);
      }, 300);
    }
  };

  const openEditAccount = (a: AccountItem) => {
    setAccountModal(a);
    setAcctPlatform(a.platform);
    setAcctName(a.name);
    setAcctAppId(a.appId || "");
    setAcctSecret(a.secret || "");
    setAcctCookie(a.cookie || "");
    setAcctToken(a.token || "");
    setAcctUserId(a.userId || "");
    setAcctAvatar(a.avatar || "");
    setAcctWechatAccounts(a.wechatAccounts || []);
    setAddOpen(true);
  };

  const startPlatformLogin = async (platformOverride?: string) => {
    const platform = platformOverride || acctPlatform;
    setAcctPlatform(platform);
    if (platform === "公众号" && !acctName.trim()) {
      messageApi.warning("请先填写账号备注名");
      return;
    }
    setLoginLoading(true);
    setLoginError("");
    setLoginStatus("");
    setLoginMessage("");
    setAcctCookie("");
    setAcctToken("");
    setAcctUserId("");
    setAcctAvatar("");
    setAcctWechatAccounts([]);
    clearPoll();
    if (loginSession?.id) {
      window.wangaohui?.platformLoginCancel({ id: loginSession.id });
    }
    try {
      const r = await window.wangaohui?.platformLoginCreate({
        platform: platformKey(platform),
      });
      if (!r?.ok || !r.session) {
        throw new Error(r?.error || "创建登录会话失败");
      }
      setLoginSession(r.session);
      setLoginOpen(true);
      setLoginStatus(r.session.mode === "qr" ? "waiting" : "pending");
      setLoginMessage(r.session.message || "");
      const sessionId = r.session.id;
      pollTimerRef.current = window.setInterval(async () => {
        const pr = await window.wangaohui?.platformLoginPoll({ id: sessionId });
        if (!pr?.ok) {
          setLoginError(pr?.error || "轮询登录状态失败");
          clearPoll();
          return;
        }
        setLoginStatus(pr.status || "");
        setLoginMessage(pr.message || "");
        if (pr.status === "done") {
          clearPoll();
          const cookie = pr.cookie || "";
          const token = pr.token || "";
          const userId = pr.userId || "";
          const avatar = pr.avatar || "";
          const wechatAccounts = pr.wechatAccounts || [];
          const displayName = acctName.trim() || pr.accountName || "未命名账号";
          setAcctCookie(cookie);
          setAcctToken(token);
          setAcctUserId(userId);
          setAcctAvatar(avatar);
          if (wechatAccounts.length) setAcctWechatAccounts(wechatAccounts);
          setAcctName(displayName);
          const firstMp =
            (pr.wechatAccounts || []).find((w) => w.kind !== "wxa")?.username ||
            "";
          // 参考项目流程：登录成功后账号自动保存，无需手动点保存
          saveAccount({
            ...(accountModal || {}),
            id: accountModal?.id || uid("acct"),
            platform,
            name: displayName,
            token: token || undefined,
            userId: userId || undefined,
            avatar: avatar || undefined,
            wechatAccounts: mergeWechatAccounts(
              accountModal?.wechatAccounts,
              wechatAccounts.map((w) => ({
                ...w,
                enabled: w.enabled !== false,
              })),
            ),
            currentUsername: firstMp || undefined,
            cookie: cookie || undefined,
            authed: !!cookie,
            note: cookie ? undefined : "缺少凭证，未完成授权",
            createdAt: accountModal?.createdAt || new Date().toISOString(),
          });
          refresh();
          setAddOpen(false);
          messageApi.success("登录成功，账号已自动保存");
          closeLogin();
        } else if (["error", "expired", "closed"].includes(pr.status || "")) {
          clearPoll();
          setLoginError(pr.message || "登录失败");
        }
      }, 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLoginError(msg);
      messageApi.error(`创建登录会话失败：${msg}`);
    } finally {
      setLoginLoading(false);
    }
  };

  const closeLogin = () => {
    clearPoll();
    if (loginSession?.id) {
      window.wangaohui?.platformLoginCancel({ id: loginSession.id });
    }
    setLoginOpen(false);
    setLoginSession(null);
    setLoginStatus("");
    setLoginMessage("");
    setLoginError("");
  };

  const saveAccountModal = async () => {
    if (acctPlatform === "公众号" && !acctName.trim()) {
      messageApi.warning("请输入账号备注名");
      return;
    }
    const id = accountModal?.id || uid("acct");
    const base = {
      id,
      platform: acctPlatform,
      name:
        acctName.trim() ||
        accountModal?.name ||
        (acctUserId ? `账号-${acctUserId.slice(0, 6)}` : "未命名账号"),
      createdAt: accountModal?.createdAt || new Date().toISOString(),
    };
    const authed = !!acctCookie.trim();
    let wechatAccounts = mergeWechatAccounts(
      accountModal?.wechatAccounts,
      (acctWechatAccounts || []).map((w) => ({
        ...w,
        enabled: w.enabled !== false,
      })),
    );
    if (
      acctPlatform === "公众号" &&
      authed &&
      !wechatAccounts?.length &&
      acctToken &&
      acctCookie
    ) {
      try {
        const r = await window.wangaohui?.wechatSyncAccounts({
          token: acctToken,
          cookie: acctCookie,
        });
        if (r?.ok && r.accounts?.length) {
          wechatAccounts = mergeWechatAccounts(
            accountModal?.wechatAccounts,
            r.accounts.map((w) => ({ ...w, enabled: w.enabled !== false })),
          );
        }
      } catch {
        /* 同步失败不阻塞保存 */
      }
    }
    saveAccount({
      ...(accountModal || {}),
      ...base,
      token: acctToken.trim() || undefined,
      userId: acctUserId.trim() || undefined,
      avatar: acctAvatar.trim() || undefined,
      wechatAccounts,
      appId: acctAppId.trim() || undefined,
      secret: acctSecret.trim() || undefined,
      cookie: acctCookie.trim() || undefined,
      authed,
      note: authed ? undefined : "缺少凭证，未完成授权",
    });
    setAddOpen(false);
    refresh();
    messageApi.success(
      authed
        ? `「${acctName}」凭证已保存并标记为已认证`
        : `「${acctName}」已保存，请完成登录`,
    );
  };

  const patchAccountSetting = (a: AccountItem, patch: Partial<AccountItem>) => {
    // 始终基于最新存储的账号写入，避免页面缓存旧对象把已保存配置覆盖回默认
    const fresh = listAccounts().find((x) => x.id === a.id) || a;
    saveAccount({ ...fresh, ...patch });
    refresh();
  };

  const patchWechatAccount = (
    a: AccountItem,
    username: string,
    patch: Partial<NonNullable<AccountItem["wechatAccounts"]>[number]>,
  ) => {
    const fresh = listAccounts().find((x) => x.id === a.id) || a;
    const next = (fresh.wechatAccounts || []).map((w) =>
      w.username === username ? { ...w, ...patch } : w,
    );
    saveAccount({ ...fresh, wechatAccounts: next });
    refresh();
  };

  const removeWechatAccount = (a: AccountItem, username: string) => {
    saveAccount({
      ...a,
      wechatAccounts: (a.wechatAccounts || []).filter(
        (w) => w.username !== username,
      ),
    });
    refresh();
  };

  const openBackend = async (a: AccountItem) => {
    const key = `backend:${a.id}`;
    if (backendLoading) return;
    setBackendLoading(key);
    try {
      const fresh = listAccounts().find((x) => x.id === a.id) || a;
      const r = await window.wangaohui?.openAccountBackend({
        platform: platformKey(a.platform),
        cookie: fresh.cookie,
        token: fresh.token,
      });
      if (r && !r.ok) messageApi.error(r.error || "打开后台失败");
    } finally {
      setBackendLoading("");
    }
  };

  const openWechatBackend = async (
    a: AccountItem,
    username: string,
    appid?: string,
  ) => {
    const key = `${a.id}:${username}`;
    if (backendLoading) return;
    setBackendLoading(key);
    try {
      const fresh = listAccounts().find((x) => x.id === a.id) || a;
      const auth = resolveWechatAuth(fresh, username);
      let cookie = auth.cookie || fresh.cookie;
      let token = auth.token || fresh.token;
      // 进入后台前始终刷新一次会话：同步最新 token/cookie，避免发布后 token 轮换导致旧 token 失效
      const rr = await window.wangaohui?.wechatRefreshSession({
        token,
        cookie,
        username,
        appid,
        accounts: fresh.wechatAccounts,
        currentUsername: fresh.currentUsername,
        fingerprint: fresh.fingerprint,
      });
      if (!rr?.ok || !rr.cookies) {
        messageApi.error(rr?.error || "刷新公众号登录态失败");
        return;
      }
      cookie = rr.cookies;
      token = rr.token || token;
      const nextWechatAccounts = (fresh.wechatAccounts || []).map((w) =>
        w.username === username
          ? { ...w, appid: rr.appid || w.appid, token, cookies: cookie }
          : w,
      );
      saveAccount({
        ...fresh,
        cookie,
        token,
        lastRefresh: rr.lastRefresh,
        currentUsername: rr.currentUsername || username,
        wechatAccounts: nextWechatAccounts,
      });
      refresh();
      const r = await window.wangaohui?.openAccountBackend({
        platform: "wechat",
        cookie,
        token,
      });
      if (r && !r.ok) messageApi.error(r.error || "打开后台失败");
    } finally {
      setBackendLoading("");
    }
  };

  const syncWechatAccounts = async (a: AccountItem) => {
    const fresh = listAccounts().find((x) => x.id === a.id) || a;
    if (!fresh.cookie || !fresh.token) {
      messageApi.warning("该账号缺少 token / Cookie，请重新登录");
      return;
    }
    setSyncingWechat(a.id);
    try {
      const r = await window.wangaohui?.wechatSyncAccounts({
        token: fresh.token,
        cookie: fresh.cookie,
      });
      if (r?.ok) {
        const accs = r.accounts || [];
        const firstMp = accs.find((x) => x.kind !== "wxa")?.username || "";
        const current = fresh.currentUsername || firstMp || "";
        const merged = mergeWechatAccounts(fresh.wechatAccounts, accs).map(
          (w) =>
            w.username === current
              ? {
                  ...w,
                  token: r.token || w.token,
                  cookies: r.cookies || w.cookies,
                }
              : w,
        );
        saveAccount({
          ...fresh,
          wechatAccounts: merged,
          token: r.token || fresh.token,
          cookie: r.cookies || fresh.cookie,
          currentUsername: fresh.currentUsername || firstMp || undefined,
        });
        refresh();
        messageApi.success(`已同步 ${r.accounts?.length || 0} 个公众号`);
      } else {
        messageApi.error(r?.error || "同步失败");
      }
    } finally {
      setSyncingWechat("");
    }
  };

  const selectTab = (tab: string) => {
    setActiveTab(tab);
    setKindFilter("all");
  };

  const clearFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setKindFilter("all");
  };

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: prev[id] === false }));
  };

  const wechatAccountsList = accounts.filter((a) => a.platform === "公众号");
  const toutiaoAccounts = accounts.filter((a) => a.platform === "头条号");
  const baijiahaoAccounts = accounts.filter((a) => a.platform === "百家号");
  const xhsAccounts = accounts.filter((a) => a.platform === "小红书");

  return {
    contextHolder,
    openAddAccount,
    activeTab,
    setActiveTab: selectTab,
    query,
    setQuery,
    statusFilter,
    setStatusFilter,
    kindFilter,
    setKindFilter,
    clearFilters,
    toutiaoAccounts,
    baijiahaoAccounts,
    xhsAccounts,
    accountModal,
    addOpen,
    setAddOpen,
    saveAccountModal,
    acctPlatform,
    acctName,
    setAcctName,
    loginLoading,
    startPlatformLogin,
    loginOpen,
    closeLogin,
    loginStatus,
    loginSession,
    setLoginError,
    loginMessage,
    loginError,
    wechatAccountsList,
    syncingWechat,
    syncWechatAccounts,
    openEditAccount,
    refresh,
    messageApi,
    collapsed,
    toggleCollapse,
    patchWechatAccount,
    backendLoading,
    openWechatBackend,
    removeWechatAccount,
    openBackend,
    patchAccountSetting,
  };
}
