import { Modal } from "@/components/shared/controls";
import { usePublishWorkspace } from "../workspace-context";
import { PublishStatusBadge } from "./PublishStatusBadge";
export function PublishDetailsDialog() {
  const { detailItem, setDetailItem } = usePublishWorkspace();
  return (
    <Modal
      open={!!detailItem}
      onCancel={() => setDetailItem(null)}
      title="发布详情"
      footer={null}
      width={560}
    >
      {detailItem && (
        <dl className="publish-detail">
          <div>
            <dt>内容标题</dt>
            <dd>{detailItem.title}</dd>
          </div>
          <div>
            <dt>目标平台</dt>
            <dd>{detailItem.platform}</dd>
          </div>
          <div>
            <dt>目标账号</dt>
            <dd>{detailItem.account || "—"}</dd>
          </div>
          <div>
            <dt>状态</dt>
            <dd>
              <PublishStatusBadge status={detailItem.status} />
            </dd>
          </div>
          <div>
            <dt>时间</dt>
            <dd>
              {new Date(detailItem.createdAt).toLocaleString("zh-CN", {
                hour12: false,
              })}
            </dd>
          </div>
          {detailItem.error && (
            <div>
              <dt>错误信息</dt>
              <dd className="publish-error">{detailItem.error}</dd>
            </div>
          )}
        </dl>
      )}
    </Modal>
  );
}
