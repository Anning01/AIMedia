import { useId } from "react";
import { Switch } from "@/components/ui/switch";

export function ThinkingModeField({ model, value, disabled, onChange }: {
  model: QilingModel | undefined;
  value: QilingThinkingMode | "";
  disabled: boolean;
  onChange: (value: QilingThinkingMode) => void;
}) {
  const id = useId();
  const modes = model?.thinkingModes || [];
  if (!modes.length) return null;
  const canToggle = modes.includes("enabled") && modes.includes("disabled");
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium">思考模式</label>
        <p id={`${id}-description`} className="m-0 mt-1 text-xs text-muted-foreground">
          {canToggle
            ? "关闭时显式关闭模型思考，开启时允许模型推理；保存后生效。"
            : `当前模型仅支持${modes[0] === "enabled" ? "开启" : "关闭"}思考。保存后生效。`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs text-muted-foreground">{value === "enabled" ? "已开启" : "已关闭"}</span>
        <Switch id={id} aria-label="思考模式" aria-describedby={`${id}-description`} checked={value === "enabled"}
          disabled={disabled || !canToggle} onCheckedChange={(checked) => onChange(checked ? "enabled" : "disabled")} />
      </div>
    </div>
  );
}
