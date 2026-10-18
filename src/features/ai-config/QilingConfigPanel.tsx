import { useEffect } from "react";
import {
  Alert,
  Button,
  Card,
  Input,
  InputNumber,
} from "@/components/shared/controls";
import { CheckCircledIcon } from "@radix-ui/react-icons";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QilingConnectionPanel } from "./QilingConnectionPanel";
import { QilingAccountLinks } from "./QilingAccountLinks";
import { ThinkingModeField } from "./ThinkingModeField";
import type { useQilingConfig } from "./useQilingConfig";
export function QilingConfigPanel({
  qiling,
  info,
}: {
  qiling: ReturnType<typeof useQilingConfig>;
  info: AiConfigInfo | null;
}) {
  useEffect(() => {
    qiling.setModel(info?.qilingModel || "");
  }, [info?.qilingModel]);
  useEffect(() => {
    qiling.setThinkingMode(info?.qilingThinkingMode || "");
  }, [info?.qilingModel, info?.qilingThinkingMode]);
  useEffect(() => {
    qiling.setMaxTokens(
      info?.qilingBudgetConfigured ? (info.qilingMaxTokens ?? 16384) : 16384,
    );
    qiling.setMaxFee(
      info?.qilingBudgetConfigured ? (info.qilingMaxFee ?? "0.50") : "0.50",
    );
  }, [info?.qilingMaxTokens, info?.qilingMaxFee, info?.qilingBudgetConfigured]);
  const selectedModel = qiling.models.find(
    (item) => item.code === qiling.model,
  );
  useEffect(() => {
    if (info?.qilingConfigured) void qiling.loadModels();
  }, [info?.qilingConfigured]);
  return (
    <Card>
      <div className="mb-6">
        <h2 className="m-0 text-base font-semibold">器灵文本服务</h2>
        <p className="m-0 mt-1 text-xs leading-relaxed text-muted-foreground">选择文本模型，调整生成偏好，按实际用量结算。</p>
      </div>
      {(qiling.error || qiling.feedback) && (
        <div className="mb-4 space-y-3" role="status" aria-live="polite">
          {qiling.error && <Alert type="error" message={qiling.error} />}
          {qiling.feedback && (
            <p className="m-0 flex items-center gap-2 text-xs text-success">
              <CheckCircledIcon className="size-4 shrink-0" />{qiling.feedback}
            </p>
          )}
        </div>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,1fr)] lg:gap-8">
        <div className="min-w-0 space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="qiling-text-model" className="text-[13px] font-medium">器灵文本模型</label>
              <Button type="text" size="small" disabled={!info?.qilingConfigured}
                loading={qiling.busy} onClick={() => void qiling.loadModels()}>
                刷新模型
              </Button>
            </div>
            <Select value={qiling.model || ""}
              disabled={qiling.busy || !qiling.models.length}
              onValueChange={qiling.selectModel}>
              <SelectTrigger id="qiling-text-model" aria-label="器灵文本模型" className="w-full">
                <SelectValue placeholder="接入服务后选择文本模型" />
              </SelectTrigger>
              <SelectContent>
                {qiling.models.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.name === item.code ? item.name : `${item.name} · ${item.code}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ThinkingModeField model={selectedModel} value={qiling.thinkingMode}
            disabled={qiling.busy} onChange={qiling.setThinkingMode} />
          <div className="grid gap-4 border-t border-border/70 pt-5 sm:grid-cols-2">
            <label className="flex min-w-0 flex-col gap-2 text-[13px] font-medium">
              <span>最大输出量 <span className="font-normal text-muted-foreground">· Token</span></span>
              <InputNumber aria-label="最大输出量" min={1} max={selectedModel?.maxTokens || 100000}
                step={1024} value={qiling.maxTokens} disabled={qiling.busy} onChange={qiling.setMaxTokens} />
              <span className="text-xs font-normal leading-relaxed text-muted-foreground">
                含思考与正文，最多 {selectedModel?.maxTokens?.toLocaleString() || "100,000"} Token。
              </span>
            </label>
            <label className="flex min-w-0 flex-col gap-2 text-[13px] font-medium">
              <span>单次费用上限 <span className="font-normal text-muted-foreground">· 元</span></span>
              <Input aria-label="单次预估费用上限" type="number" min="0.000000001" step="0.01"
                value={qiling.maxFee} disabled={qiling.busy} onChange={(event) => qiling.setMaxFee(event.target.value)} />
              <span className="text-xs font-normal leading-relaxed text-muted-foreground">免费预估，超过上限不提交生成。</span>
            </label>
          </div>
          {selectedModel?.pricing && (
            <p className="m-0 text-xs leading-relaxed text-muted-foreground">
              当前报价：输入 ¥{selectedModel.pricing.input ?? "—"} / 输出 ¥{selectedModel.pricing.output ?? "—"}（百万 Token），实际费用以使用记录为准。
            </p>
          )}
          {info?.qilingConfigured && !info.qilingBudgetConfigured && (
            <p className="m-0 text-xs text-muted-foreground">首次使用请保存模型与设置后再生成。</p>
          )}
        </div>
        <QilingConnectionPanel qiling={qiling} configured={!!info?.qilingConfigured} />
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
        <QilingAccountLinks />
        <Button type="primary" disabled={!qiling.model || qiling.busy || !selectedModel}
          loading={qiling.busy} onClick={() => void qiling.saveModel()}>
          保存模型与设置
        </Button>
      </div>
    </Card>
  );
}
