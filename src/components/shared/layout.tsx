import { Badge } from "@/components/ui/badge";
import { Button as UIButton } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Cross2Icon,ReloadIcon } from "@radix-ui/react-icons";
import React from "react";
import { Base } from "./types";

export const Button = React.forwardRef<
  HTMLButtonElement,
  Base & { onClick?: React.MouseEventHandler<HTMLButtonElement> }
>(function Button(
  {
    children,
    icon,
    loading,
    disabled,
    type,
    danger,
    ghost,
    block,
    size,
    onClick,
    ...rest
  },
  ref,
) {
  return (
    <UIButton
      ref={ref}
      {...rest}
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      variant={
        danger
          ? "destructive"
          : type === "primary"
            ? ghost
              ? "outline"
              : "default"
            : type === "text"
              ? "ghost"
              : type === "link"
                ? "link"
                : "outline"
      }
      size={size === "small" ? "sm" : size === "large" ? "lg" : "default"}
      className={cn(
        "ui-button",
        block && "w-full",
        !children && "ui-icon-button",
        rest.className,
      )}
      aria-busy={!!loading}
    >
      {loading ? <ReloadIcon className="animate-spin" /> : icon}
      {children}
    </UIButton>
  );
}) as React.ForwardRefExoticComponent<
  Base & {
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
  } & React.RefAttributes<HTMLButtonElement>
>;

function SpaceView({ children, direction, size, wrap, align, ...p }: Base) {
  return (
    <div
      {...p}
      className={cn("ui-space", p.className)}
      style={{
        display: "inline-flex",
        flexDirection: direction === "vertical" ? "column" : "row",
        gap:
          typeof size === "number"
            ? size
            : size === "large"
              ? 24
              : size === "small"
                ? 8
                : 12,
        flexWrap: wrap ? "wrap" : undefined,
        alignItems: align || (direction === "vertical" ? "stretch" : "center"),
        ...p.style,
      }}
    >
      {children}
    </div>
  );
}

export const Space = Object.assign(SpaceView, {
  Compact: ({ children, ...p }: Base) => (
    <div className="ui-compact" style={p.style}>
      {children}
    </div>
  ),
});

export function Row({ gutter = 0, align, justify, children, ...p }: Base) {
  const gap = Array.isArray(gutter) ? gutter : [gutter, gutter];
  return (
    <div
      {...p}
      className={cn("ui-row", p.className)}
      style={
        {
          display: "flex",
          flexWrap: "wrap",
          gap: `${gap[1]}px ${gap[0]}px`,
          alignItems: align === "middle" ? "center" : align,
          justifyContent: justify,
          ...p.style,
          "--column-gap": `${gap[0]}px`,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}

export function Col({ span, xs, sm, md, lg, xl, flex, children, ...p }: Base) {
  return (
    <div
      {...p}
      className={cn(
        "ui-col",
        (span || xs || sm || md || lg || xl) && "ui-col-sized",
        p.className,
      )}
      style={
        {
          minWidth: 0,
          flex:
            flex ||
            (span
              ? `0 0 calc(${(span / 24) * 100}% - var(--column-gap) * ${(24 - span) / 24})`
              : undefined),
          "--col-xs": xs ?? span ?? 24,
          "--col-md": md ?? sm ?? span ?? 24,
          "--col-lg": lg ?? xl ?? md ?? span ?? 24,
          ...p.style,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}

export function Divider({ children, orientation, ...p }: Base) {
  if (!children) return <Separator className="ui-divider" />;
  return (
    <div {...p} className="ui-divider">
      {children}
    </div>
  );
}

function TagView({ color, children, closable, onClose, ...p }: Base) {
  return (
    <Badge
      {...p}
      className={cn("ui-tag", p.className)}
      data-tone={color || "default"}
    >
      {children}
      {closable && (
        <button type="button" aria-label="移除" onClick={onClose}>
          <Cross2Icon />
        </button>
      )}
    </Badge>
  );
}

export const Tag = Object.assign(TagView, {
  CheckableTag: ({
    checked,
    onChange,
    children,
    ...p
  }: Base & { onChange?: (v: boolean) => void }) => (
    <button
      type="button"
      className="ui-filter-chip"
      aria-pressed={!!checked}
      onClick={() => onChange?.(!checked)}
      {...p}
    >
      {children}
    </button>
  ),
});
