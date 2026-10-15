import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** 统一的空状态：柔和的图标底座 + 标题 + 说明 + 可选操作。 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 py-16 text-center",
        className,
      )}
    >
      {icon && (
        <span className="grid size-16 place-items-center rounded-2xl bg-surface-subtle text-primary [&_svg]:size-7">
          {icon}
        </span>
      )}
      <div className="space-y-1.5">
        {title && (
          <div className="text-base font-semibold text-foreground">{title}</div>
        )}
        {description && (
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
