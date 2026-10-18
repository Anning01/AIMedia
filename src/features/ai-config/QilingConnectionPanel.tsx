import { LockClosedIcon } from "@radix-ui/react-icons";
import { Badge } from "@/components/ui/badge";
import { Button, Input } from "@/components/shared/controls";
import type { useQilingConfig } from "./useQilingConfig";

export function QilingConnectionPanel({ qiling, configured }: {
  qiling: ReturnType<typeof useQilingConfig>;
  configured: boolean;
}) {
  return (
    <aside className="min-w-0 rounded-lg bg-muted/40 p-4 lg:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="m-0 text-sm font-semibold">服务连接</h3>
        <Badge variant="secondary" className={configured ? "bg-success-soft text-success" : ""}>
          {configured ? "已配置" : "未接入"}
        </Badge>
      </div>
      <label className="flex flex-col gap-2 text-[13px] font-medium">
        <span>器灵 API Key</span>
        <Input.Password aria-label="器灵 API Key" autoComplete="off"
          placeholder={configured ? "已安全保存，输入新 Key 可替换" : "粘贴器灵 API Key"}
          value={qiling.key} disabled={qiling.busy}
          onChange={(event) => qiling.setKey(event.target.value)} />
      </label>
      <Button className="mt-3 w-full" disabled={!qiling.key.trim()}
        loading={qiling.busy} onClick={() => void qiling.connect()}>
        验证并接入
      </Button>
      <div className="mt-5 flex items-start gap-2 border-t border-border/70 pt-4 text-xs leading-relaxed text-muted-foreground">
        <LockClosedIcon className="mt-0.5 size-3.5 shrink-0" />
        <p className="m-0">Key 加密保存在本机。也可点击页面上方「一键授权」，自动完成接入。</p>
      </div>
    </aside>
  );
}
