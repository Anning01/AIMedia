import { Button, Empty } from "@/components/shared/controls";
import type { PublishTab } from "../publish-query";
export function PublishEmptyState({
  tab,
  filtered,
  onReset,
}: {
  tab: PublishTab;
  filtered: boolean;
  onReset: () => void;
}) {
  return (
    <Empty
      description={
        filtered
          ? "未找到匹配的内容，调整搜索或筛选条件试试"
          : tab === "pending"
            ? "暂无待发布内容，在创作工坊生成文章或贴图后会显示在这里"
            : "暂无发布记录，发布结果会显示在这里"
      }
    >
      {filtered && <Button onClick={onReset}>清除筛选</Button>}
    </Empty>
  );
}
