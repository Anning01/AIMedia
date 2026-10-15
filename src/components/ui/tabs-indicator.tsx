"use client";

import { cn } from "@/lib/utils";
import * as React from "react";

/**
 * 标签列表的滑动指示器：跟随激活触发器移动/改变宽度。
 * 需要 TabsList 自身为 relative 定位，激活触发器需保持透明背景。
 */
export function TabsIndicator({
  listRef,
  value,
  className,
}: {
  listRef: React.RefObject<HTMLElement | null>;
  /** 当前激活值，变化时重新测量并触发滑动过渡。 */
  value: string;
  className?: string;
}) {
  const [rect, setRect] = React.useState<{
    left: number;
    width: number;
  } | null>(null);
  const [animated, setAnimated] = React.useState(false);

  React.useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const active = list.querySelector<HTMLElement>('[data-state="active"]');
      if (!active || !active.offsetWidth) {
        setRect(null);
        return;
      }
      setRect({ left: active.offsetLeft, width: active.offsetWidth });
    };
    measure();
    // 标签数量/字体变化同样需要重新测量。
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    for (const child of Array.from(list.children)) observer.observe(child);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [listRef, value]);

  // 首帧不做过渡，避免指示器从左上角滑入。
  React.useEffect(() => {
    const raf = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!rect) return null;

  return (
    <span
      aria-hidden="true"
      data-slot="tabs-indicator"
      className={cn(
        "pointer-events-none absolute top-0 bottom-0 left-0 rounded-md bg-card shadow-sm",
        animated &&
          "transition-[transform,width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        className,
      )}
      style={{ width: rect.width, transform: `translateX(${rect.left}px)` }}
    />
  );
}
