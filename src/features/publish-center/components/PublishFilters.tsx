import { Button, Input, Select } from "@/components/shared/controls";
import {
  MagnifyingGlassIcon,
  ReloadIcon,
  ResetIcon,
} from "@radix-ui/react-icons";
import type { usePublishBrowser } from "../usePublishBrowser";
import { usePublishWorkspace } from "../workspace-context";
export function PublishFilters({
  browser,
}: {
  browser: ReturnType<typeof usePublishBrowser>;
}) {
  const { refresh } = usePublishWorkspace();
  return (
    <div className="publish-filters">
      <Input
        allowClear
        prefix={<MagnifyingGlassIcon />}
        aria-label="搜索发布内容"
        placeholder={
          browser.tab === "pending"
            ? "搜索标题或正文"
            : "搜索标题、账号或错误信息"
        }
        value={browser.query}
        onChange={(e) => browser.search(e.target.value)}
      />
      {browser.tab === "pending" ? (
        <Select
          placeholder="全部类型"
          value={browser.kind || undefined}
          allowClear
          options={[
            { value: "article", label: "文章" },
            { value: "sticker", label: "贴图" },
          ]}
          onChange={(value: string | undefined) =>
            browser.changeKind(value || "")
          }
        />
      ) : (
        <>
          <Select
            placeholder="全部平台"
            allowClear
            value={browser.platform || undefined}
            options={["公众号", "头条号", "百家号", "小红书"].map((value) => ({
              value,
              label: value,
            }))}
            onChange={(value: string | undefined) =>
              browser.changePlatform(value || "")
            }
          />
          <Select
            placeholder="全部账号"
            allowClear
            value={browser.account || undefined}
            options={browser.accounts.map((value) => ({ value, label: value }))}
            onChange={(value: string | undefined) =>
              browser.changeAccount(value || "")
            }
          />
          <Select
            placeholder="全部状态"
            allowClear
            value={browser.status || undefined}
            options={["已发布", "已存草稿", "失败"].map((value) => ({
              value,
              label: value,
            }))}
            onChange={(value: string | undefined) =>
              browser.changeStatus(value || "")
            }
          />
        </>
      )}
      {browser.hasFilters && (
        <Button
          size="small"
          type="text"
          icon={<ResetIcon />}
          onClick={browser.reset}
        >
          重置
        </Button>
      )}
      <Button
        size="small"
        aria-label="刷新发布列表"
        icon={<ReloadIcon />}
        onClick={refresh}
      >
        刷新
      </Button>
    </div>
  );
}
