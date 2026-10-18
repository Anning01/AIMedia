"use client";

import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TabsIndicator } from "@/components/ui/tabs-indicator";
import { cn } from "@/lib/utils";
import * as React from "react";

/**
 * 分段切换控件（shadcn Tabs 变体）：激活项由滑动指示器呈现。
 * 需放在 <Tabs value onValueChange> 内部使用。
 */
export function SegmentedTabs({
  value,
  options,
  ariaLabel,
  className,
}: {
  value: string;
  options: { value: string; label: string; icon?: React.ReactNode }[];
  ariaLabel?: string;
  className?: string;
}) {
  const listRef = React.useRef<HTMLDivElement>(null);
  return (
    <div className="min-w-0 max-w-full overflow-x-auto overflow-y-hidden">
      <TabsList
        ref={listRef}
        aria-label={ariaLabel}
        className={cn(
          "segmented-tabs relative h-9 w-max gap-1 rounded-lg bg-muted p-1",
          className,
        )}
      >
        <TabsIndicator listRef={listRef} value={value} className="top-1 bottom-1" />
        {options.map((option) => (
          <TabsTrigger
            key={option.value}
            value={option.value}
            className="relative z-10 h-full flex-none gap-1.5 px-3 text-xs data-[state=active]:font-medium"
          >
            {option.icon}
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
  );
}
