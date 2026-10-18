import { Skeleton as UISkeleton } from "@/components/ui/skeleton";
import * as T from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Cross2Icon,ImageIcon,ReloadIcon } from "@radix-ui/react-icons";
import React,{ useState } from "react";
import { toast } from "sonner";
import { Button } from "./layout";
import { Base } from "./types";

export function Empty({ description = "暂无内容", children, ...p }: Base) {
  return (
    <div className="ui-empty" style={p.style}>
      <ImageIcon aria-hidden="true" />
      <div className="ui-empty-description">{description}</div>
      {children}
    </div>
  );
}

Empty.PRESENTED_IMAGE_SIMPLE = null;

export function Alert({
  message,
  description,
  type = "info",
  action,
  closable,
  showIcon,
  ...p
}: Base) {
  const [closed, setClosed] = useState(false);
  return closed ? null : (
    <div
      {...p}
      className={cn("ui-alert", p.className)}
      data-tone={type}
      role={type === "error" ? "alert" : "status"}
    >
      <div>
        <strong>{message}</strong>
        {description && <div>{description}</div>}
      </div>
      {action}
      {closable && (
        <Button
          type="text"
          aria-label="关闭提示"
          icon={<Cross2Icon />}
          onClick={() => setClosed(true)}
        />
      )}
    </div>
  );
}

export function Spin({ children, spinning = true, tip, ...p }: Base) {
  return (
    <div className="ui-spin-wrap" aria-busy={spinning} style={p.style}>
      {children}
      {spinning && (
        <div className="ui-spinner">
          <ReloadIcon className="animate-spin" />
          {tip}
        </div>
      )}
    </div>
  );
}

export function Skeleton({ paragraph, active, ...p }: Base) {
  return (
    <div className="ui-skeleton">
      {Array.from({ length: paragraph?.rows || 3 }, (_, i) => (
        <UISkeleton key={i} className="h-5 w-full" />
      ))}
    </div>
  );
}

export const Tooltip = React.forwardRef<HTMLButtonElement, Base>(
  function Tooltip({ title, children }, ref) {
    if (!title) return <>{children}</>;
    return (
      <T.TooltipProvider delayDuration={250}>
        <T.Tooltip>
          <T.TooltipTrigger asChild>
            {React.isValidElement(children) ? (
              React.cloneElement(children as React.ReactElement<any>, {
                ref,
                "aria-label":
                  (children.props as any)["aria-label"] ||
                  (typeof title === "string" ? title : undefined),
              })
            ) : (
              <span>{children}</span>
            )}
          </T.TooltipTrigger>
          <T.TooltipContent>{title}</T.TooltipContent>
        </T.Tooltip>
      </T.TooltipProvider>
    );
  },
);

const notice =
  (kind: "success" | "error" | "info" | "warning" | "loading") =>
  (
    text: string | { content: string; key?: string; duration?: number },
    duration?: number,
  ) => {
    const item = typeof text === "string" ? { content: text } : text;
    const id = toast[kind](item.content, {
      id: item.key,
      duration: (item.duration ?? duration ?? 3) * 1000,
    });
    return () => toast.dismiss(id);
  };

export const message = {
  success: notice("success"),
  error: notice("error"),
  info: notice("info"),
  warning: notice("warning"),
  loading: notice("loading"),
  destroy: () => toast.dismiss(),
  useMessage: () => [message, null] as const,
};
