import { useEffect } from "react";
import {
  Alert,
  Button,
  Card,
  Input,
  InputNumber,
  Select,
} from "@/components/shared/controls";
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
    <Card title="器灵文本服务">
      <div className="flex flex-col gap-4">
        <p className="m-0 text-xs text-muted-foreground">
          一键授权与手动 Key 使用同一配置。模型按实际用量从器灵调用余额结算。
        </p>
        {qiling.error && <Alert type="error" message={qiling.error} />}
        {qiling.feedback && <Alert type="success" message={qiling.feedback} />}
        <label className="flex flex-col gap-2 text-[13px]">
          <span>器灵 API Key {info?.qilingConfigured ? "（已配置）" : ""}</span>
          <div className="flex gap-2">
            <Input.Password
              aria-label="器灵 API Key"
              autoComplete="off"
              placeholder="粘贴器灵 qk_ API Key，或使用一键授权"
              value={qiling.key}
              disabled={qiling.busy}
              onChange={(e) => qiling.setKey(e.target.value)}
            />
            <Button
              disabled={!qiling.key.trim()}
              loading={qiling.busy}
              onClick={() => void qiling.connect()}
            >
              验证并接入
            </Button>
          </div>
        </label>
        <label className="flex flex-col gap-2 text-[13px]">
          <span>器灵文本模型</span>
          <div className="flex flex-wrap gap-2">
            <Select
              aria-label="器灵文本模型"
              style={{ minWidth: 240, flex: 1 }}
              placeholder="验证 Key 后刷新模型，再选择"
              value={qiling.model || undefined}
              disabled={qiling.busy || !qiling.models.length}
              options={qiling.models.map((item) => ({
                value: item.code,
                label: `${item.name} · ${item.code}`,
              }))}
              onChange={(value: string) => qiling.selectModel(value)}
            />
            <Button
              disabled={!info?.qilingConfigured}
              loading={qiling.busy}
              onClick={() => void qiling.loadModels()}
            >
              刷新模型
            </Button>
            <Button
              type="primary"
              disabled={
                !qiling.model ||
                qiling.busy ||
                !qiling.models.some((item) => item.code === qiling.model)
              }
              onClick={() => void qiling.saveModel()}
            >
              保存模型与设置
            </Button>
          </div>
        </label>
        <ThinkingModeField model={selectedModel} value={qiling.thinkingMode}
          disabled={qiling.busy} onChange={qiling.setThinkingMode} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-[13px]">
            <span>最大输出量（含模型思考）</span>
            <InputNumber
              aria-label="最大输出量"
              min={1}
              max={selectedModel?.maxTokens || 100000}
              step={1024}
              value={qiling.maxTokens}
              disabled={qiling.busy}
              onChange={(value) => qiling.setMaxTokens(value)}
            />
            <span className="text-xs text-muted-foreground">
              本模型当前可设置到{" "}
              {selectedModel?.maxTokens?.toLocaleString() || "接口允许范围"}{" "}
              Token，按你填写的值提交。
            </span>
          </label>
          <label className="flex flex-col gap-2 text-[13px]">
            <span>单次预估费用上限（元）</span>
            <Input
              aria-label="单次预估费用上限"
              type="number"
              min="0.000000001"
              step="0.01"
              value={qiling.maxFee}
              disabled={qiling.busy}
              onChange={(event) => qiling.setMaxFee(event.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              先免费预估，超过上限不发起生成。
            </span>
          </label>
        </div>
        {info?.qilingConfigured && !info.qilingBudgetConfigured && (
          <Alert
            type="info"
            message="请保存模型与预算后再生成"
            description="旧版的固定输出限制已移除，新预算由你确认保存后生效。"
          />
        )}
        <p className="m-0 text-xs leading-relaxed text-muted-foreground">
          输出额度包含模型思考与最终正文，不是文章字数。默认文章生成调用一次文本模型，预估与生成使用同一思考模式；实际费用以器灵结算为准。
        </p>
        {qiling.models.find((item) => item.code === qiling.model)?.pricing && (
          <p className="m-0 text-xs text-muted-foreground">
            当前用户报价（元 / 百万 Token）：输入{" "}
            {qiling.models.find((item) => item.code === qiling.model)?.pricing
              ?.input ?? "以器灵为准"}
            ，输出{" "}
            {qiling.models.find((item) => item.code === qiling.model)?.pricing
              ?.output ?? "以器灵为准"}
            。最终费用以调用记录为准。
          </p>
        )}
        <QilingAccountLinks />
      </div>
    </Card>
  );
}
