import { PersonIcon } from "@radix-ui/react-icons";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import type { AccountItem } from "@/data/localStore";
import { PlatformAccountCard } from "./PlatformAccountCard";
import { WechatGroupSection } from "./WechatGroupSection";
import { useAccountCenterContext } from "./workspace-context";

type WechatAccount = NonNullable<AccountItem["wechatAccounts"]>[number];

function matchQuery(query: string, ...values: (string | undefined)[]) {
  if (!query) return true;
  return values.some((value) => (value || "").toLowerCase().includes(query));
}

function matchStatus(enabled: boolean, filter: string) {
  if (filter === "enabled") return enabled;
  if (filter === "disabled") return !enabled;
  return true;
}

/** 账号卡片网格：搜索/过滤 + 2~3 列自适应。 */
export function AccountGrid() {
  const {
    activeTab,
    wechatAccountsList,
    toutiaoAccounts,
    baijiahaoAccounts,
    xhsAccounts,
    query,
    statusFilter,
    kindFilter,
    clearFilters,
  } = useAccountCenterContext();
  const normalized = query.trim().toLowerCase();

  const filterWechat = (list: WechatAccount[]) =>
    list.filter((account) => {
      if (kindFilter === "mp" && account.kind === "wxa") return false;
      if (kindFilter === "wxa" && account.kind !== "wxa") return false;
      if (!matchStatus(account.enabled !== false, statusFilter)) return false;
      return matchQuery(
        normalized,
        account.nickname,
        account.username,
        account.appid,
      );
    });

  const groups = wechatAccountsList
    .map((group) => ({
      group,
      accounts: filterWechat(group.wechatAccounts || []),
    }))
    .filter(
      ({ group, accounts }) =>
        accounts.length > 0 ||
        (normalized &&
          matchQuery(normalized, group.name, group.note)),
    );

  const platformAccounts = (
    activeTab === "头条号"
      ? toutiaoAccounts
      : activeTab === "百家号"
        ? baijiahaoAccounts
        : xhsAccounts
  ).filter(
    (account) =>
      matchStatus(!!account.authed, statusFilter) &&
      matchQuery(normalized, account.name, account.userId, account.note),
  );

  if (activeTab === "公众号") {
    if (!wechatAccountsList.length) {
      return (
        <EmptyState
          icon={<PersonIcon />}
          title="尚无微信账号"
          description="点右上角「添加账号」扫码登录，登录后可同步名下公众号与小程序。"
        />
      );
    }
    if (!groups.length) {
      return (
        <EmptyState
          icon={<PersonIcon />}
          title="没有匹配的账号"
          description="换个关键词，或重置筛选条件。"
          action={
            <Button variant="secondary" size="sm" onClick={clearFilters}>
              重置筛选
            </Button>
          }
        />
      );
    }
    return (
      <div className="flex min-w-0 flex-col gap-4">
        {groups.map(({ group, accounts }) => (
          <WechatGroupSection
            key={group.id}
            group={group}
            accounts={accounts}
          />
        ))}
      </div>
    );
  }

  if (!platformAccounts.length) {
    const label = activeTab === "公众号" ? "微信账号" : activeTab;
    return (
      <EmptyState
        icon={<PersonIcon />}
        title={`暂无${label}授权`}
        description="点右上角「添加账号」完成登录授权；已有账号可调整筛选条件。"
        action={
          query.trim() || statusFilter !== "all" ? (
            <Button variant="secondary" size="sm" onClick={clearFilters}>
              重置筛选
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {platformAccounts.map((account) => (
        <PlatformAccountCard key={account.id} account={account} />
      ))}
    </div>
  );
}
