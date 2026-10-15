import { Button } from "@/components/shared/controls";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { QueueItem } from "@/data/localStore";
import { ReloadIcon } from "@radix-ui/react-icons";
import { usePublishWorkspace } from "../workspace-context";
import { PublishStatusBadge } from "./PublishStatusBadge";
export function PublishedHistoryTable({ items }: { items: QueueItem[] }) {
  const { retry, setDetailItem } = usePublishWorkspace();
  return (
    <Table className="publish-table publish-history-table">
      <TableHeader>
        <TableRow>
          <TableHead>内容</TableHead>
          <TableHead className="publish-platform-column">平台 / 账号</TableHead>
          <TableHead className="publish-status-column">状态</TableHead>
          <TableHead className="publish-time-column">时间</TableHead>
          <TableHead className="publish-actions-column">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              <div className="publish-history-title" title={item.title}>
                {item.title}
              </div>
              {item.error && (
                <p className="publish-error" title={item.error}>
                  {item.error}
                </p>
              )}
            </TableCell>
            <TableCell>
              <div className="publish-platform">{item.platform}</div>
              <span className="publish-account">{item.account || "—"}</span>
            </TableCell>
            <TableCell>
              <PublishStatusBadge status={item.status} />
            </TableCell>
            <TableCell className="publish-date">
              {new Date(item.createdAt).toLocaleString("zh-CN", {
                hour12: false,
              })}
            </TableCell>
            <TableCell>
              <div className="publish-row-actions">
                {item.status === "失败" && (
                  <Button
                    size="small"
                    icon={<ReloadIcon />}
                    onClick={() => retry(item)}
                  >
                    重试
                  </Button>
                )}
                <Button
                  size="small"
                  type="text"
                  onClick={() => setDetailItem(item)}
                >
                  详情
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
