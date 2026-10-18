import { Alert, Button, Card } from "@/components/shared/controls";
import { LightningBoltIcon, CheckIcon, Link2Icon } from "@radix-ui/react-icons";
import { useState, useEffect } from "react";
import { Tabs } from "@/components/ui/tabs";
import { SegmentedTabs } from "@/components/shared/segmented-tabs";
import { QilingConfigPanel } from "@/features/ai-config/QilingConfigPanel";
import { useQilingConfig } from "@/features/ai-config/useQilingConfig";
import { useAiConfig } from "@/features/ai-config/useAiConfig";
import { AiProviderForm } from "@/features/ai-config/AiProviderForm";
import { QuickAiConfigDialog } from "@/features/ai-config/QuickAiConfigDialog";
import { AppUpdates } from "@/features/ai-config/AppUpdates";
import { useAppUpdates } from "@/features/ai-config/useAppUpdates";

export default function AiConfig({ active }: { active: boolean }) {
  const config = useAiConfig(active);
  const updates = useAppUpdates();
  const qiling = useQilingConfig(active, config.reload);
  const [mode, setMode] = useState("custom");
  useEffect(() => {
    if (config.info?.service) setMode(config.info.service);
  }, [config.info?.service]);
  return (
    <div className="ai-config-page flex min-w-0 flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <strong className="text-[15px] font-semibold">文本 AI 配置</strong>
            <p className="mt-1 text-xs text-muted-foreground">
              当前使用：
              {config.info?.service === "qiling"
                ? `器灵 · ${config.info.qilingModel || "请选择文本模型"}`
                : "自定义文本接口"}
              。可选器灵授权或保留自定义接口。
            </p>
          </div>
          <Button
            icon={<LightningBoltIcon />}
            onClick={() => void qiling.start()}
          >
            一键授权
          </Button>
        </div>
      </Card>
      {config.error && <Alert type="error" message={config.error} />}
      {mode === "custom" && config.feedback && <Alert type="success" message={config.feedback} />}
      <Tabs value={mode} onValueChange={setMode}>
        <SegmentedTabs
          value={mode}
          ariaLabel="AI 接入方式"
          options={[
            { value: "custom", label: "自定义接口" },
            { value: "qiling", label: "器灵服务" },
          ]}
        />
      </Tabs>
      {mode === "qiling" ? (
        <QilingConfigPanel qiling={qiling} info={config.info} />
      ) : (
        <>
          <AiProviderForm config={config} />
          <Card>
            <div className="flex flex-wrap items-center gap-3">
              <p className="mr-auto text-xs text-muted-foreground">
                密钥加密保存在本机，不随项目提交。
              </p>
              <Button
                icon={<Link2Icon />}
                disabled={config.loading || config.saving}
                loading={config.testing}
                onClick={() => void config.test()}
              >
                测试连接
              </Button>
              <Button
                type="primary"
                icon={<CheckIcon />}
                disabled={config.loading || config.testing}
                loading={config.saving}
                onClick={() => void config.save()}
              >
                保存配置
              </Button>
            </div>
          </Card>
        </>
      )}
      <AppUpdates {...updates} />
      <QuickAiConfigDialog qiling={qiling} />
    </div>
  );
}
