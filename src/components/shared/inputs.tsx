import { Checkbox as UICheckbox } from "@/components/ui/checkbox";
import { Input as UIInput } from "@/components/ui/input";
import { Slider as UISlider } from "@/components/ui/slider";
import { Switch as UISwitch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Cross2Icon } from "@radix-ui/react-icons";
import React,{ useId } from "react";
import { Base } from "./types";

type InputProps = Base & {
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  onPressEnter?: () => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
};

function TextInput({
  prefix,
  suffix,
  allowClear,
  onPressEnter,
  size,
  onChange,
  ...p
}: InputProps) {
  const id = useId();
  return (
    <span className={cn("ui-input-wrap", p.className)} style={p.style}>
      {prefix}
      <UIInput
        {...p}
        value={
          Object.prototype.hasOwnProperty.call(p, "value")
            ? (p.value ?? "")
            : undefined
        }
        className="ui-input"
        style={undefined}
        aria-label={p["aria-label"] || p.placeholder}
        onChange={onChange}
        onKeyDown={(e) => {
          p.onKeyDown?.(e);
          if (e.key === "Enter") onPressEnter?.();
        }}
      />
      {allowClear && p.value && (
        <button
          type="button"
          aria-label="清空"
          onClick={() =>
            onChange?.({
              target: { value: "" },
            } as React.ChangeEvent<HTMLInputElement>)
          }
        >
          <Cross2Icon />
        </button>
      )}
      {suffix}
    </span>
  );
}

export const Input = Object.assign(TextInput, {
  TextArea: ({
    autoSize,
    onChange,
    ...p
  }: Base & { onChange?: React.ChangeEventHandler<HTMLTextAreaElement> }) => (
    <Textarea
      {...p}
      aria-label={p["aria-label"] || p.placeholder}
      onChange={onChange}
    />
  ),
  Password: (p: InputProps) => <TextInput {...p} type="password" />,
  Search: ({
    onSearch,
    ...p
  }: InputProps & { onSearch?: (value: string) => void }) => (
    <TextInput {...p} onPressEnter={() => onSearch?.(p.value || "")} />
  ),
});

export function InputNumber({
  onChange,
  addonAfter,
  size,
  ...p
}: Base & { onChange?: (value: number | null) => void }) {
  return (
    <span className="ui-input-wrap" style={p.style}>
      <UIInput
        {...p}
        style={undefined}
        type="number"
        aria-label={p["aria-label"] || p.placeholder || "数值"}
        value={p.value ?? ""}
        onChange={(e) => {
          const v = e.target.value === "" ? null : Number(e.target.value);
          if (
            v === null ||
            (v >= (p.min ?? -Infinity) && v <= (p.max ?? Infinity))
          )
            onChange?.(v);
        }}
      />
      {addonAfter}
    </span>
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
  indeterminate,
  ...p
}: Base & {
  onChange?: (e: {
    target: { checked: boolean };
    stopPropagation: () => void;
  }) => void;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <label className="ui-check">
      <UICheckbox
        {...p}
        checked={indeterminate ? "indeterminate" : !!checked}
        onCheckedChange={(v) =>
          onChange?.({
            target: { checked: v === true },
            stopPropagation: () => {},
          })
        }
      />
      {children}
    </label>
  );
}

export function Switch({
  checked,
  onChange,
  checkedChildren,
  unCheckedChildren,
  ...p
}: Base & { onChange?: (v: boolean) => void }) {
  return (
    <span className="ui-check">
      <UISwitch
        {...p}
        aria-label={p["aria-label"] || checkedChildren || "开关"}
        checked={!!checked}
        onCheckedChange={onChange}
      />
      {checked ? checkedChildren : unCheckedChildren}
    </span>
  );
}

export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  onChangeComplete,
  ...p
}: Base & {
  onChange?: (v: number) => void;
  onChangeComplete?: (v: number) => void;
}) {
  return (
    <UISlider
      {...p}
      aria-label={p["aria-label"] || "调整数值"}
      value={[value ?? min]}
      min={min}
      max={max}
      step={step}
      onValueChange={(v) => onChange?.(v[0])}
      onValueCommit={(v) => onChangeComplete?.(v[0])}
    />
  );
}

export function ColorPicker({
  value = "#2F54EB",
  onChange,
  ...p
}: Base & {
  onChange?: (color: { toHexString: () => string }, hex: string) => void;
}) {
  const color =
    typeof value === "string" ? value : value?.toHexString?.() || "#2F54EB";
  return (
    <input
      type="color"
      className="ui-color"
      aria-label="选择颜色"
      value={color}
      disabled={p.disabled}
      onChange={(e) => {
        const hex = e.target.value;
        onChange?.({ toHexString: () => hex }, hex);
      }}
    />
  );
}
