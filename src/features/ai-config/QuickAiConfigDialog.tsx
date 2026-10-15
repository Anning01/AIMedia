import { Alert, Button, Modal } from "@/components/shared/controls";
import type { useQilingConfig } from "./useQilingConfig";
export function QuickAiConfigDialog({
  qiling,
}: {
  qiling: ReturnType<typeof useQilingConfig>;
}) {
  const labels: Record<string, string> = {
    starting: "正在创建授权请求…",
    pending: "请在系统浏览器登录器灵并确认授权",
    saving: "正在安全保存 Key…",
    authorized: "授权成功，请返回配置页选择文本模型",
    denied: "你已拒绝授权",
    consumed: "此授权已被领取，请重新发起",
    expired: "授权已过期，请重新发起",
    failed: "授权失败",
    cancelled: "授权已取消",
  };
  return (
    <Modal
      open={qiling.open}
      title="器灵一键授权"
      onCancel={() => void qiling.cancel()}
      width={500}
      footer={
        <>
          <Button onClick={() => void qiling.cancel()}>
            {qiling.auth.status === "authorized" ? "完成" : "取消等待"}
          </Button>
          {!["starting", "pending", "saving", "authorized"].includes(
            qiling.auth.status,
          ) && (
            <Button type="primary" onClick={() => void qiling.start()}>
              重新授权
            </Button>
          )}
        </>
      }
    >
      <div role="status">
        <Alert
          type={
            ["failed", "expired", "denied", "consumed"].includes(
              qiling.auth.status,
            )
              ? "error"
              : "info"
          }
          message={labels[qiling.auth.status] || "准备授权"}
          description={qiling.auth.error}
        />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        浏览器确认后，万稿汇自动领取并加密保存你的默认 API
        Key。关闭此窗口会停止领取。授权不会启用软件激活门禁；后续模型调用由器灵按当前规则结算。
      </p>
    </Modal>
  );
}
