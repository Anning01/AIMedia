"use client";

import { TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import * as React from "react";

type TabDirection = 1 | -1;

interface AnimatedTabsContextValue {
  value: string;
  direction: TabDirection;
  duration: number;
  reducedMotion: boolean;
}

const AnimatedTabsContext =
  React.createContext<AnimatedTabsContextValue | null>(null);

function useAnimatedTabsContext(name: string) {
  const context = React.useContext(AnimatedTabsContext);
  if (!context) {
    throw new Error(`${name} must be rendered inside <AnimatedTabs>`);
  }
  return context;
}

/** 系统「减少动态效果」偏好：命中时关闭过渡，避免眩晕。 */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/**
 * 为 Radix Tabs 的子面板提供切换过渡：保留已访问面板的状态（不重复请求），
 * 切换时新面板滑入淡入、旧面板淡出，方向跟随标签顺序（左切/右切）。
 */
export function AnimatedTabs({
  value,
  order = [],
  duration = 260,
  className,
  children,
}: {
  value: string;
  /** 标签顺序，用于判断滑动方向；缺省时统一向右滑动。 */
  order?: readonly string[];
  /** 过渡时长（毫秒），与 tab-panel-enter/leave 动画保持一致。 */
  duration?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [previous, setPrevious] = React.useState(value);
  const [direction, setDirection] = React.useState<TabDirection>(1);

  if (previous !== value) {
    setPrevious(value);
    const from = order.indexOf(previous);
    const to = order.indexOf(value);
    setDirection(from >= 0 && to >= 0 && to < from ? -1 : 1);
  }

  const context = React.useMemo<AnimatedTabsContextValue>(
    () => ({
      value,
      direction,
      duration: reducedMotion ? 0 : duration,
      reducedMotion,
    }),
    [value, direction, duration, reducedMotion],
  );

  return (
    <AnimatedTabsContext.Provider value={context}>
      <div className={cn("relative", className)}>{children}</div>
    </AnimatedTabsContext.Provider>
  );
}

export function AnimatedTabsPanel({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { value: activeValue, direction, duration, reducedMotion } =
    useAnimatedTabsContext("AnimatedTabsPanel");
  const active = activeValue === value;
  const [visited, setVisited] = React.useState(active);
  const [present, setPresent] = React.useState(active);

  React.useEffect(() => {
    if (active) setVisited(true);
  }, [active]);

  React.useEffect(() => {
    if (active) {
      setPresent(true);
      return;
    }
    if (!present) return;
    if (duration <= 0) {
      setPresent(false);
      return;
    }
    const timer = window.setTimeout(() => setPresent(false), duration);
    return () => window.clearTimeout(timer);
  }, [active, duration, present]);

  // 首次访问前不挂载，避免一次性拉起所有标签的数据与计时器。
  if (!active && !visited && !present) return null;

  const state: "active" | "leaving" | "hidden" = active
    ? "active"
    : present && duration > 0
      ? "leaving"
      : "hidden";

  return (
    <TabsContent
      value={value}
      forceMount
      hidden={state === "hidden"}
      className={cn(
        "outline-none",
        state === "leaving" &&
          "pointer-events-none absolute inset-0 overflow-hidden",
      )}
    >
      <div
        data-state={state}
        className={cn(
          "min-w-0",
          !reducedMotion &&
            (state === "active"
              ? "tab-panel-enter"
              : state === "leaving" && "tab-panel-leave"),
        )}
        style={
          { "--tab-shift": `${direction * 14}px` } as React.CSSProperties
        }
      >
        {visited || active ? children : null}
      </div>
    </TabsContent>
  );
}
