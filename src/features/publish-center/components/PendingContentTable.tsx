import { Button as UIButton } from "@/components/ui/button";
import { Button } from "@/components/shared/controls";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ArticleHistoryItem } from "@/data/localStore";
import { TrashIcon, UploadIcon } from "@radix-ui/react-icons";
import { usePublishWorkspace } from "../workspace-context";
import { PublishStatusBadge } from "./PublishStatusBadge";
export function PendingContentTable({
  items,
}: {
  items: ArticleHistoryItem[];
}) {
  const { publishFromHistory, deletePending } = usePublishWorkspace();
  return (
    <Table className="publish-table publish-pending-table">
      <TableHeader>
        <TableRow>
          <TableHead>内容</TableHead>
          <TableHead className="publish-time-column">创建时间</TableHead>
          <TableHead className="publish-status-column">状态</TableHead>
          <TableHead className="publish-actions-column">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((work) => (
          <TableRow key={work.id}>
            <TableCell>
              <div className="publish-title">
                <Badge variant="secondary" className="publish-kind">
                  {work.kind === "sticker" ? "贴图" : "文章"}
                </Badge>
                <span title={work.title}>{work.title}</span>
              </div>
            </TableCell>
            <TableCell className="publish-date">
              {new Date(work.time).toLocaleString("zh-CN", { hour12: false })}
            </TableCell>
            <TableCell>
              <PublishStatusBadge status="待发布" />
            </TableCell>
            <TableCell>
              <div className="publish-row-actions">
                <Button
                  size="small"
                  icon={<UploadIcon />}
                  onClick={() => publishFromHistory(work)}
                >
                  平台发布
                </Button>
                <UIButton
                  variant="ghost"
                  size="sm"
                  className="publish-delete-button"
                  aria-label={`删除 ${work.title}`}
                  onClick={() => deletePending(work)}
                >
                  <TrashIcon />
                  删除
                </UIButton>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
