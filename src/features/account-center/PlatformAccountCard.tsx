import { TrashIcon } from "@radix-ui/react-icons";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { AccountAvatar } from "./AccountAvatar";
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
import { removeAccount,type AccountItem } from "@/data/localStore";
import { DECLARATIONS } from "./model";
import { useAccountCenterContext } from "./workspace-context";

/** 设置行：文案 + 开关。 */
function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
      <span className="truncate">{label}</span>
      <Switch
        checked={checked}
        aria-label={label}
        onCheckedChange={onChange}
      />
    </label>
  );
}

/** 头条号 / 百家号 / 小红书账号卡片。 */
export function PlatformAccountCard({
  account,
}: {
  account: AccountItem;
}) {
  const { patchAccountSetting, openBackend, openEditAccount, refresh, messageApi, backendLoading } =
    useAccountCenterContext();
  const platform = account.platform;
  const busy = backendLoading === `backend:${account.id}`;
  const raw = account as unknown as Record<string, boolean | undefined>;

  return (
    <article className="flex min-w-0 flex-col gap-2.5 rounded-xl bg-card p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow hover:shadow-[0_4px_14px_rgba(16,24,40,0.08)]">
      <header className="flex min-w-0 items-start gap-2.5">
        <AccountAvatar account={account} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">
            {account.name || account.userId || "未命名账号"}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            ID: {account.userId || "—"}
          </div>
        </div>
        <Badge
          variant="secondary"
          className="shrink-0 bg-muted px-1.5 py-0 text-[10px] font-normal text-muted-foreground"
        >
          {platform}
        </Badge>
      </header>

      {platform === "头条号" && (
        <div className="flex flex-col gap-2">
          <ToggleRow
            label="首发"
            checked={!!account.claimExclusive}
            onChange={(checked) =>
              patchAccountSetting(account, { claimExclusive: checked })
            }
          />
          <Select
            value={account.contentDeclaration || "个人观点，仅供参考"}
            onValueChange={(value) =>
              patchAccountSetting(account, { contentDeclaration: value })
            }
          >
            <SelectTrigger
              className="h-8 w-full text-xs"
              aria-label="内容声明"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DECLARATIONS.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {platform === "百家号" && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          {(
            [
              ["bjhTtv", "自动视频", true],
              ["bjhAiTts", "自动播客", true],
              ["bjhAigc", "AI生成", false],
              ["bjhAutoGoods", "挂载商品", false],
            ] as const
          ).map(([field, label, defaultOn]) => (
            <ToggleRow
              key={field}
              label={label}
              checked={defaultOn ? raw[field] !== false : !!raw[field]}
              onChange={(checked) =>
                patchAccountSetting(account, {
                  [field]: checked,
                } as Partial<AccountItem>)
              }
            />
          ))}
        </div>
      )}

      {platform === "小红书" && (
        <div className="flex flex-col gap-2">
          <Select
            value={account.xhsOriginal || "none"}
            onValueChange={(value) =>
              patchAccountSetting(account, {
                xhsOriginal: value as AccountItem["xhsOriginal"],
              })
            }
          >
            <SelectTrigger className="h-8 w-full text-xs" aria-label="原创声明">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">无需原创声明</SelectItem>
              <SelectItem value="original">原创声明</SelectItem>
              <SelectItem value="repost">转载声明</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={account.xhsContentDeclaration || "不声明"}
            onValueChange={(value) =>
              patchAccountSetting(account, { xhsContentDeclaration: value })
            }
          >
            <SelectTrigger className="h-8 w-full text-xs" aria-label="内容声明">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                "不声明",
                "虚构演绎，仅供娱乐",
                "笔记含AI合成内容",
                "内容包含营销广告",
              ].map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <footer className="mt-auto flex items-center gap-2">
        <Switch
          checked={!!account.authed}
          aria-label={account.authed ? "停用该账号" : "启用该账号"}
          onCheckedChange={(checked) =>
            patchAccountSetting(account, {
              authed: checked,
              note: checked ? undefined : "已停用",
            })
          }
        />
        <span
          className={cn(
            "text-xs",
            account.authed ? "text-muted-foreground" : "text-amber-600",
          )}
        >
          {account.authed ? "已启用" : "已停用"}
        </span>
        <Button
          variant="secondary"
          size="sm"
          className="ml-auto"
          disabled={busy}
          onClick={() => void openBackend(account)}
        >
          {busy ? "打开中…" : "前往后台"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => openEditAccount(account)}
        >
          重新登录
        </Button>
        <ConfirmButton
          title="删除该账号？"
          description={account.name || account.userId}
          confirmText="删除"
          onConfirm={() => {
            removeAccount(account.id);
            refresh();
            messageApi.success("账号已删除");
          }}
        >
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="删除账号"
            className="text-muted-foreground hover:text-destructive"
          >
            <TrashIcon aria-hidden="true" />
          </Button>
        </ConfirmButton>
      </footer>
    </article>
  );
}
