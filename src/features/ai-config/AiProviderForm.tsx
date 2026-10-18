import { Card, Input } from "@/components/shared/controls";
import type { useAiConfig } from "./useAiConfig";

export function AiProviderForm({
  config,
}: {
  config: ReturnType<typeof useAiConfig>;
}) {
  const { draft, patch } = config;
  const disabled = config.loading || config.saving || config.testing;
  return (
    <Card title="文本模型">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-2 text-[13px] sm:col-span-2">
          <span className="font-medium">接口地址</span>
          <Input
            aria-label="接口地址"
            placeholder="填写 Base URL 或完整的文本对话接口地址"
            disabled={disabled}
            value={draft.baseUrl}
            onChange={(e) => patch({ baseUrl: e.target.value })}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-2 text-[13px]">
          <span className="font-medium">模型名称</span>
          <Input
            aria-label="模型名称"
            placeholder="填写模型 ID"
            disabled={disabled}
            value={draft.model}
            onChange={(e) => patch({ model: e.target.value })}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-2 text-[13px]">
          <span className="font-medium">API Key</span>
          <Input.Password
            aria-label="API Key"
            autoComplete="off"
            placeholder={
              draft.hasApiKey ? "已保存密钥，留空保留原值" : "填写 API Key"
            }
            disabled={disabled}
            value={draft.apiKey}
            onChange={(e) => patch({ apiKey: e.target.value })}
          />
        </label>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        填写支持 OpenAI Chat Completions 协议的 Base URL 或完整接口地址。域名和
        /v1 地址会补全对话路径，已填写的完整接口不会重复拼接。
      </p>
    </Card>
  );
}
