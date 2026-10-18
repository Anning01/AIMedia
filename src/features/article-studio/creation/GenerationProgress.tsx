import {
  CheckCircledIcon,
  ClockIcon,
  CrossCircledIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import { FLOW_STEPS } from "../model";
import { useArticleWorkspace } from "../workspace-context";
export function GenerationProgress() {
  const { flow, setFlowOpen, contentType, generating } = useArticleWorkspace();
  if (contentType === "sticker")
    return generating ? (
      <p className="creation-progress-message" role="status">
        <ReloadIcon className="animate-spin" />
        正在生成贴图，完成后可直接编辑内容。
      </p>
    ) : null;
  return (
    <ol className="creation-progress" aria-label="内容生成进度">
      {FLOW_STEPS.map((item) => {
        const status = flow[item.key];
        return (
          <li key={item.key}>
            <button
              type="button"
              disabled={status !== "done"}
              onClick={() => setFlowOpen(item.key)}
              data-status={status}
            >
              {status === "done" ? (
                <CheckCircledIcon />
              ) : status === "error" ? (
                <CrossCircledIcon />
              ) : status === "active" ? (
                <ReloadIcon className="animate-spin" />
              ) : (
                <ClockIcon />
              )}
              <span>{item.label}</span>
              <small>
                {status === "done"
                  ? "查看结果"
                  : status === "error"
                    ? "生成失败"
                    : status === "active"
                      ? "处理中"
                      : "等待生成"}
              </small>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
