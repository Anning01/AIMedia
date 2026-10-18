import { ChevronDownIcon, ChevronUpIcon, ReloadIcon } from "@radix-ui/react-icons";
import { AccountAvatar } from "./AccountAvatar";
import { TrashIcon } from "@radix-ui/react-icons";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { Button } from "@/components/ui/button";
import { removeAccount,type AccountItem } from "@/data/localStore";
import { fmtTime } from "./model";
import { WechatAccountCard } from "./WechatAccountCard";
import { useAccountCenterContext } from "./workspace-context";

/** 微信登录账号（一组公众号/小程序）的分组头 + 卡片网格。 */
export function WechatGroupSection({
  group,
  accounts,
}: {
  group: AccountItem;
  accounts: NonNullable<AccountItem["wechatAccounts"]>;
}) {
  const {
    syncingWechat,
    syncWechatAccounts,
    openEditAccount,
    refresh,
    messageApi,
    collapsed,
    toggleCollapse,
  } = useAccountCenterContext();
  const expanded = collapsed[group.id] !== false;
  const mpCount = (group.wechatAccounts || []).filter(
    (item) => item.kind !== "wxa",
  ).length;
  const wxaCount = (group.wechatAccounts || []).filter(
    (item) => item.kind === "wxa",
  ).length;

  return (
    <section className="flex min-w-0 flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-card px-3 py-2.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <AccountAvatar account={group} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">
            {group.name}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {mpCount} 个公众号
            {wxaCount ? ` · ${wxaCount} 个小程序` : ""} · 更新{" "}
            {fmtTime(group.lastRefresh)}
            {group.note ? ` · ${group.note}` : ""}
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={syncingWechat === group.id}
          onClick={() => void syncWechatAccounts(group)}
        >
          {syncingWechat === group.id && (
            <ReloadIcon className="animate-spin" aria-hidden="true" />
          )}
          同步公众号
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => openEditAccount(group)}
        >
          重新登录 / 配置
        </Button>
        <ConfirmButton
          title="删除该微信账号？"
          description="删除后需要重新扫码登录才能管理名下公众号。"
          confirmText="删除"
          onConfirm={() => {
            removeAccount(group.id);
            refresh();
            messageApi.success("账号已删除");
          }}
        >
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="删除微信账号"
            className="text-muted-foreground hover:text-destructive"
          >
            <TrashIcon aria-hidden="true" />
          </Button>
        </ConfirmButton>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={expanded ? "收起账号列表" : "展开账号列表"}
          aria-expanded={expanded}
          className="text-muted-foreground"
          onClick={() => toggleCollapse(group.id)}
        >
          {expanded ? (
            <ChevronUpIcon aria-hidden="true" />
          ) : (
            <ChevronDownIcon aria-hidden="true" />
          )}
        </Button>
      </div>

      {expanded && (
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => (
            <WechatAccountCard
              key={account.username}
              group={group}
              account={account}
            />
          ))}
        </div>
      )}
    </section>
  );
}
