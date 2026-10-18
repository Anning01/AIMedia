import { useId } from "react";
import { RadioGroup } from "radix-ui";
import { cn } from "@/lib/utils";

export function ThinkingModeField({ model, value, disabled, onChange }: {
  model: QilingModel | undefined;
  value: QilingThinkingMode | "";
  disabled: boolean;
  onChange: (value: QilingThinkingMode | "") => void;
}) {
  const id = useId();
  const modes = model?.thinkingModes || [];
  if (!modes.length) return null;
  const options = [
    { value: "default", label: "默认" },
    { value: "enabled", label: "开启" },
    { value: "disabled", label: "关闭" },
  ] as const;
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span id={id} className="text-[13px] font-medium">思考模式</span>
        <span className="text-xs text-muted-foreground">保存后生效</span>
      </div>
      <RadioGroup.Root
        aria-labelledby={id} aria-describedby={`${id}-description`}
        orientation="horizontal"
        value={value || "default"} disabled={disabled}
        onValueChange={(mode) => onChange(mode === "default" ? "" : mode as QilingThinkingMode)}
        className="grid grid-cols-3 gap-1 rounded-lg bg-muted/70 p-1"
      >
        {options.map((option) => (
          <RadioGroup.Item key={option.value} value={option.value}
            disabled={disabled || (option.value !== "default" && !modes.includes(option.value))}
            className={cn(
              "h-9 min-w-0 cursor-pointer rounded-md border border-transparent bg-transparent px-3 text-[13px] text-muted-foreground transition-colors",
              "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40",
              "data-[state=checked]:border-border data-[state=checked]:bg-card data-[state=checked]:font-medium data-[state=checked]:text-primary data-[state=checked]:shadow-sm",
            )}>
            {option.label}
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>
      <p id={`${id}-description`} className="m-0 text-xs leading-relaxed text-muted-foreground">
        {value === "enabled" ? "显式开启模型思考，响应可能需要更长时间。"
          : value === "disabled" ? "显式关闭模型思考。"
          : "不传思考模式参数，由系统自动决定。"}
      </p>
    </div>
  );
}
