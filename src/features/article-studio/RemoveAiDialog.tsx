import {
  Alert,
  Button,
  Checkbox,
  Input,
  Modal,
} from "@/components/shared/controls";
import { QilingAccountLinks } from "@/features/ai-config/QilingAccountLinks";
import type { useRemoveAi } from "./useRemoveAi";
export function RemoveAiDialog({
  flow,
}: {
  flow: ReturnType<typeof useRemoveAi>;
}) {
  const { job } = flow;
  const fresh = !job || ["adopted", "failed"].includes(job.state);
  return (
    <Modal
      title="去 AI · 降低 AI 痕迹"
      open={flow.open}
      width={840}
      onCancel={() => void flow.close()}
      footer={
        <>
          <Button onClick={() => void flow.close()}>关闭</Button>
          {job?.state === "running" && (
            <Button onClick={() => void flow.pause()}>停止等待</Button>
          )}
          {job?.state === "paused" && (
            <Button onClick={() => void flow.resume()}>
              {job.parts.some((part) => !part.taskId)
                ? `继续处理分段（尚有 ${job.parts.filter((part) => !part.taskId).length} 次提交）`
                : "继续查询原任务"}
            </Button>
          )}
          {job?.state === "completed" && (
            <>
              <Button onClick={() => void flow.discard()}>放弃候选</Button>
              <Button
                type="primary"
                disabled={flow.changed && !flow.replaceChanged}
                onClick={() => void flow.adopt()}
              >
                采用候选
              </Button>
            </>
          )}
          {fresh && (
            <Button
              type="primary"
              loading={flow.busy}
              disabled={!flow.price || (flow.count > 1 && !flow.allowSplit)}
              onClick={() => void flow.start()}
            >
              确认并处理{flow.count > 1 ? `（${flow.count} 次调用）` : ""}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="m-0 text-xs leading-relaxed text-muted-foreground">
          仅处理当前文案，不会在生成后自动运行。器灵按当前接口规则结算；停止等待不会取消上游任务。
        </p>
        {flow.error && <Alert type="error" message={flow.error} />}
        {flow.price && (
          <Alert
            type="info"
            message={`当前报价：${flow.price.price === null ? "以器灵为准" : `${flow.price.price} 元 / 次`} · 调用余额：${flow.price.balance ?? "以器灵为准"}`}
            description={`当前接口公布免费额度：${flow.price.freeQuota ?? "以器灵为准"} 次；此额度不代表剩余次数，免费额度耗尽后按接口规则结算。最终费用以使用记录为准。`}
          />
        )}
        {fresh && flow.count > 1 && (
          <label className="flex items-start gap-2 text-xs">
            <Checkbox
              checked={flow.allowSplit}
              onChange={(e) => flow.setAllowSplit(e.target.checked)}
            />
            <span>
              文案超过 2000 字，将分为 {flow.count} 段，最多提交 {flow.count}{" "}
              次。确认按此次数及接口规则处理。
            </span>
          </label>
        )}
        {job && (
          <div role="status" className="text-xs leading-relaxed">
            <strong>
              {(
                {
                  running: "正在处理",
                  paused: "已停止等待",
                  completed: "候选已完成",
                  failed: "任务失败",
                  uncertain: "提交结果待核对，请勿重复提交",
                } as Record<string, string>
              )[job.state] || job.state}
            </strong>
            {job.error && <p>{job.error}</p>}
            {job.parts.map((part, index) => (
              <p key={index} className="m-0 break-all">
                分段 {index + 1}：
                {(
                  {
                    new: "待提交",
                    submitting: "提交中",
                    queued: "排队中",
                    processing: "处理中",
                    completed: "已完成",
                    failed: "失败",
                  } as Record<string, string>
                )[part.status] || part.status}
                {part.taskId ? ` · 任务号 ${part.taskId}` : ""}
                {part.charged !== undefined
                  ? ` · 已计费 ${part.charged} 元`
                  : ""}
              </p>
            ))}
          </div>
        )}
        {job?.candidate && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs">
              提交时文案
              <Input.TextArea
                aria-label="去 AI 原文"
                readOnly
                value={job.source}
                rows={10}
                className="h-48 max-h-64 [field-sizing:fixed]"
              />
            </label>
            <label className="text-xs">
              候选文案
              <Input.TextArea
                aria-label="去 AI 候选"
                readOnly
                value={job.candidate}
                rows={10}
                className="h-48 max-h-64 [field-sizing:fixed]"
              />
            </label>
          </div>
        )}
        {job?.candidate && flow.changed && (
          <label className="flex items-start gap-2 text-xs">
            <Checkbox
              checked={flow.replaceChanged}
              onChange={(e) => flow.setReplaceChanged(e.target.checked)}
            />
            <span>
              提交后正文已被修改，确认用候选覆盖当前文案（图片与模板保留）。
            </span>
          </label>
        )}
        <QilingAccountLinks />
      </div>
    </Modal>
  );
}
