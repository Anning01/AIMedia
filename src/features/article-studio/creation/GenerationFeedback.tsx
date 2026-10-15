import { useEffect, useState } from "react";
import { Button, message } from "@/components/shared/controls";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  CheckCircledIcon,
  Cross2Icon,
  ExclamationTriangleIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import { useArticleWorkspace } from "../workspace-context";

export function GenerationFeedback({ onRetry }: { onRetry: () => void }) {
  const {
    generationFeedback,
    dismissGenerationFeedback,
    stopGeneration,
    generating,
    topic,
  } = useArticleWorkspace();
  const { status, message: detail, canRetry, code } = generationFeedback;
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (status !== "running" || !generationFeedback.startedAt) {
      setElapsed(0);
      return;
    }
    const update = () =>
      setElapsed(
        Math.floor((Date.now() - generationFeedback.startedAt!) / 1000),
      );
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [status, generationFeedback.startedAt]);
  if (status === "idle" || generationFeedback.dismissed) return null;
  const running = status === "running",
    failed = status === "error";
  const accountPage =
    code === "QILING_BALANCE"
      ? "recharge"
      : code === "QILING_REVIEW" ||
          code === "QILING_NETWORK" ||
          code === "QILING_CANCELLED"
        ? "usage"
        : null;
  return (
    <Alert
      data-generation-state={status}
      aria-live={failed ? "assertive" : "polite"}
      aria-atomic="true"
      variant={failed ? "destructive" : running ? "info" : "default"}
      className="shrink-0 pr-14 [&_[data-slot=alert-title]]:line-clamp-none"
    >
      {running ? (
        <ReloadIcon aria-hidden="true" className="animate-spin" />
      ) : failed ? (
        <ExclamationTriangleIcon aria-hidden="true" />
      ) : (
        <CheckCircledIcon aria-hidden="true" className="text-success" />
      )}
      {!running && (
        <Button
          type="text"
          aria-label="关闭生成提示"
          title="关闭提示"
          icon={<Cross2Icon aria-hidden="true" />}
          className="absolute right-2 top-2 size-8 p-0 text-current"
          onClick={dismissGenerationFeedback}
        />
      )}
      <AlertTitle>
        {running
          ? `正在生成 · 已等待 ${elapsed} 秒`
          : failed
            ? "生成未完成"
            : "生成完成"}
      </AlertTitle>
      <AlertDescription className="min-w-0 text-inherit">
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <p className="m-0 min-w-0 flex-1 break-words">{detail}</p>
          {running && (
            <Button
              size="small"
              disabled={generationFeedback.stopping}
              onClick={() => void stopGeneration()}
            >
              {generationFeedback.stopping ? "正在停止…" : "停止等待"}
            </Button>
          )}
          {failed && canRetry && (
            <Button
              size="small"
              disabled={generating || !topic.trim()}
              onClick={onRetry}
            >
              重新尝试
            </Button>
          )}
          {failed && accountPage && (
            <Button
              size="small"
              onClick={() =>
                void window.wangaohui
                  ?.qilingOpenAccount({ page: accountPage })
                  .then((result) => {
                    if (!result.ok) message.error(result.error || "打开失败");
                  })
                  .catch(() => message.error("打开器灵页面失败"))
              }
            >
              {accountPage === "recharge" ? "充值余额" : "查看使用记录"}
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
