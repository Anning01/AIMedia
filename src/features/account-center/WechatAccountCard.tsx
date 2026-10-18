import { TrashIcon } from "@radix-ui/react-icons";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { AccountItem } from "@/data/localStore";
import { WECHAT_DECLARATIONS } from "@/utils/wechatClaim";
import { useAccountCenterContext } from "./workspace-context";

type WechatAccount = NonNullable<AccountItem["wechatAccounts"]>[number];

/** 单个公众号 / 小程序卡片。 */
export function WechatAccountCard({
  group,
  account,
}: {
  group: AccountItem;
  account: WechatAccount;
}) {
  const {
    patchWechatAccount,
    openWechatBackend,
    removeWechatAccount,
    backendLoading,
  } = useAccountCenterContext();
  const isWxa = account.kind === "wxa";
  const enabled = account.enabled !== false;
  const isCurrent = group.currentUsername === account.username;
  const busy = backendLoading === `${group.id}:${account.username}`;
  const title = account.nickname || account.username;

  return (
    <article className="flex min-w-0 flex-col gap-2.5 rounded-xl bg-card p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow hover:shadow-[0_4px_14px_rgba(16,24,40,0.08)]">
      <header className="flex min-w-0 items-start gap-2.5">
        {account.headImg ? (
          <img
            src={account.headImg}
            alt=""
            referrerPolicy="no-referrer"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
            className="size-9 shrink-0 rounded-[10px] bg-muted object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-muted text-xs font-medium text-muted-foreground"
          >
            {title.slice(0, 1)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className="truncate text-sm font-medium text-foreground"
              title={title}
            >
              {title}
            </span>
            {isCurrent && (
              <Badge className="shrink-0 bg-emerald-500/12 px-1.5 py-0 text-[10px] font-normal text-emerald-700">
                当前 Cookie
              </Badge>
            )}
          </div>
          <div
            className="truncate text-[11px] text-muted-foreground"
            title={account.username}
          >
            {isWxa && account.appid ? `${account.appid} · ` : ""}
            {account.username}
          </div>
        </div>
        <Badge
          variant="secondary"
          className="shrink-0 bg-muted px-1.5 py-0 text-[10px] font-normal text-muted-foreground"
        >
          {isWxa ? "小程序" : "公众号"}
        </Badge>
      </header>

      {!isWxa && (
        <div className="grid grid-cols-2 gap-2">
          <Select
            value={account.contentDeclaration || "个人观点，仅供参考"}
            onValueChange={(value) =>
              patchWechatAccount(group, account.username, {
                contentDeclaration: value,
              })
            }
          >
            <SelectTrigger
              className="h-8 w-full text-xs"
              aria-label={`${title}的内容声明`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WECHAT_DECLARATIONS.map((item) => (
                <SelectItem key={item.label} value={item.label}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(account.copyrightType ?? 0)}
            onValueChange={(value) =>
              patchWechatAccount(group, account.username, {
                copyrightType: Number(value),
              })
            }
          >
            <SelectTrigger
              className="h-8 w-full text-xs"
              aria-label={`${title}的原创声明`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">关闭原创</SelectItem>
              <SelectItem value="1">开启原创</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <footer className="mt-auto flex items-center gap-2">
        <Switch
          checked={enabled}
          aria-label={`${enabled ? "停用" : "启用"}${title}`}
          onCheckedChange={(checked) =>
            patchWechatAccount(group, account.username, { enabled: checked })
          }
        />
        <span
          className={cn(
            "text-xs",
            enabled ? "text-muted-foreground" : "text-amber-600",
          )}
        >
          {enabled ? "已启用" : "已停用"}
        </span>
        <Button
          variant="secondary"
          size="sm"
          className="ml-auto"
          disabled={busy}
          onClick={() => void openWechatBackend(group, account.username, account.appid)}
        >
          {busy ? "切换中…" : "前往后台"}
        </Button>
        <ConfirmButton
          title={isWxa ? "解绑该小程序？" : "解绑该公众号？"}
          description={title}
          confirmText="解绑"
          onConfirm={() => removeWechatAccount(group, account.username)}
        >
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`解绑${title}`}
            className="text-muted-foreground hover:text-destructive"
          >
            <TrashIcon aria-hidden="true" />
          </Button>
        </ConfirmButton>
      </footer>
    </article>
  );
}
