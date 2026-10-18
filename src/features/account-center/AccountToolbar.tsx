import { MagnifyingGlassIcon, ReloadIcon } from "@radix-ui/react-icons";
import { SegmentedTabs } from "@/components/shared/segmented-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PLATFORMS } from "./model";
import { useAccountCenterContext } from "./workspace-context";

const PLATFORM_OPTIONS = PLATFORMS.map((platform) => ({
  value: platform,
  label: platform === "公众号" ? "微信账号" : platform,
}));

/** 账号中心工具条：平台分段切换 + 搜索 + 状态/类型下拉过滤（「添加账号」在页面头）。 */
export function AccountToolbar() {
  const {
    activeTab,
    wechatAccountsList,
    toutiaoAccounts,
    baijiahaoAccounts,
    xhsAccounts,
    query,
    setQuery,
    statusFilter,
    setStatusFilter,
    kindFilter,
    setKindFilter,
    clearFilters,
  } = useAccountCenterContext();

  const filtered = Boolean(
    query.trim() || statusFilter !== "all" || kindFilter !== "all",
  );
  const total =
    activeTab === "公众号"
      ? wechatAccountsList.reduce(
          (sum, group) => sum + (group.wechatAccounts || []).length,
          0,
        )
      : (
          activeTab === "头条号"
            ? toutiaoAccounts
            : activeTab === "百家号"
              ? baijiahaoAccounts
              : xhsAccounts
        ).length;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedTabs
          value={activeTab}
          ariaLabel="平台"
          options={PLATFORM_OPTIONS}
        />
        <span className="ml-auto text-xs text-muted-foreground">
          共 {total} 个账号
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <MagnifyingGlassIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            className="w-[240px] pl-9"
            placeholder="搜索账号名称 / 微信号"
            aria-label="搜索账号"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setQuery("");
            }}
          />
        </div>

        {activeTab === "公众号" && (
          <Select value={kindFilter} onValueChange={setKindFilter}>
            <SelectTrigger className="w-[132px]" aria-label="账号类型">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              <SelectItem value="mp">公众号</SelectItem>
              <SelectItem value="wxa">小程序</SelectItem>
            </SelectContent>
          </Select>
        )}

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[132px]" aria-label="启用状态">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="enabled">已启用</SelectItem>
            <SelectItem value="disabled">已停用</SelectItem>
          </SelectContent>
        </Select>

        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={clearFilters}
          >
            <ReloadIcon aria-hidden="true" />
            重置筛选
          </Button>
        )}
      </div>
    </div>
  );
}
