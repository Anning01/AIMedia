"use client";

import { cn } from "@/lib/utils";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Cross2Icon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import { Dialog as DialogPrimitive } from "radix-ui";
import * as React from "react";

export interface LightboxItem {
  id: string;
  /** 优先展示的大图。 */
  src: string;
  /** 大图加载失败时的回退（列表里已经加载成功的缩略图）。 */
  thumb?: string;
  alt: string;
  /** 缩略图与大图都失败时的占位图。 */
  fallback?: string;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
}

/** 灯箱图：缩略图打底 → 大图覆盖 → 都失败才用占位图。 */
function LightboxImage({ item }: { item: LightboxItem }) {
  const [stage, setStage] = React.useState(0);
  const [loaded, setLoaded] = React.useState(false);
  const [exhausted, setExhausted] = React.useState(false);
  const thumb = item.thumb && item.thumb !== item.src ? item.thumb : undefined;
  const candidates = React.useMemo(
    () =>
      (thumb ? [item.src] : [item.src, item.fallback]).filter(
        (source, index, all): source is string =>
          Boolean(source) && all.indexOf(source) === index,
      ),
    [thumb, item.src, item.fallback],
  );
  const src = exhausted
    ? undefined
    : candidates[Math.min(stage, Math.max(candidates.length - 1, 0))];

  return (
    <div className="relative grid h-full w-full place-items-center">
      {thumb && (
        <img
          src={thumb}
          alt=""
          aria-hidden="true"
          referrerPolicy={item.referrerPolicy}
          className={cn(
            "absolute max-h-full max-w-full rounded-md object-contain transition-opacity duration-200",
            exhausted ? "opacity-100" : "opacity-70",
          )}
        />
      )}
      {!thumb && !loaded && (
        <ReloadIcon
          aria-hidden="true"
          className="absolute size-5 animate-spin text-muted-foreground"
        />
      )}
      {src && (
        <img
          key={src}
          src={src}
          alt={item.alt}
          referrerPolicy={item.referrerPolicy}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            if (stage + 1 < candidates.length) setStage(stage + 1);
            else setExhausted(true);
          }}
          className={cn(
            "relative max-h-full max-w-full rounded-md object-contain shadow-[0_10px_40px_rgba(16,24,40,0.28)] transition-opacity duration-200",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </div>
  );
}

const CONTROL =
  "grid place-items-center rounded-full bg-card/85 text-foreground ring-1 ring-border/70 shadow-sm backdrop-blur transition-colors hover:bg-card focus-visible:ring-2 focus-visible:ring-ring";

/**
 * 全窗口看图：透明底 + 左右翻页 + 标题 + 当前/总数。
 * 画布铺满窗口，图片按 contain 自适应；点击空白处或 Esc 关闭。
 */
export function Lightbox({
  items,
  activeId,
  onChange,
  onClose,
}: {
  items: LightboxItem[];
  activeId: string | null;
  onChange: (id: string) => void;
  onClose: () => void;
}) {
  const index = items.findIndex((item) => item.id === activeId);
  const item = index >= 0 ? items[index] : undefined;
  // 关闭时保留最后一张，避免卸载瞬间内容塌陷。
  const lastItem = React.useRef<LightboxItem | undefined>(undefined);
  if (item) lastItem.current = item;
  const shown = item ?? lastItem.current;
  const shownIndex = shown
    ? items.findIndex((one) => one.id === shown.id)
    : -1;
  const step = (delta: number) => {
    const next = items[shownIndex + delta];
    if (next) onChange(next.id);
  };

  return (
    <DialogPrimitive.Root
      open={!!item}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/10 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") step(-1);
            if (event.key === "ArrowRight") step(1);
          }}
          className="fixed inset-0 z-50 flex flex-col outline-none"
        >
          <div
            className="relative flex min-h-0 flex-1 items-center justify-center p-4 sm:p-10"
            onClick={(event) => {
              if (event.target === event.currentTarget) onClose();
            }}
          >
            {shown && <LightboxImage key={shown.id} item={shown} />}

            {shownIndex > 0 && (
              <button
                type="button"
                aria-label="上一张"
                onClick={() => step(-1)}
                className={cn(CONTROL, "absolute top-1/2 left-4 size-11 -translate-y-1/2")}
              >
                <ChevronLeftIcon className="size-5" aria-hidden="true" />
              </button>
            )}
            {shownIndex >= 0 && shownIndex < items.length - 1 && (
              <button
                type="button"
                aria-label="下一张"
                onClick={() => step(1)}
                className={cn(CONTROL, "absolute top-1/2 right-4 size-11 -translate-y-1/2")}
              >
                <ChevronRightIcon className="size-5" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex shrink-0 justify-center px-6 pb-6">
            <div className="flex max-w-[80vw] items-center gap-2.5 rounded-full bg-card/85 px-4 py-1.5 ring-1 ring-border/70 shadow-sm backdrop-blur">
              <DialogPrimitive.Title className="truncate text-sm font-medium text-foreground">
                {shown?.alt || "图片预览"}
              </DialogPrimitive.Title>
              <span
                aria-hidden="true"
                className="text-muted-foreground/50"
              >
                ·
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {shownIndex + 1} / {items.length}
              </span>
            </div>
          </div>

          <DialogPrimitive.Close
            aria-label="关闭预览"
            className={cn(CONTROL, "absolute top-4 right-4 size-9")}
          >
            <Cross2Icon className="size-4" aria-hidden="true" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
