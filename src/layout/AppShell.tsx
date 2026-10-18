import {
  ChevronLeftOutlined,
  ChevronRightOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  QuestionCircleOutlined,
  ScheduleOutlined,
  SendOutlined,
  TeamOutlined,
  SettingOutlined,
} from "@/components/shared/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAccountKeepAlive } from "@/hooks/useAccountKeepAlive";
import { cn } from "@/lib/utils";
import { ReactNode, useEffect, useState } from "react";
import { PageActionsSlot } from "./page-actions";
import logoMarkCustom from "../assets/logo-mark-custom.png";

export type PageKey =
  | "resource"
  | "accounts"
  | "article"
  | "publish"
  | "task"
  | "ai"
  | "help";

/** 分组导航：内容生产（取材 → 成稿）/ 发布运营（账号 → 发布 → 托管）/ 系统。 */
const NAV_GROUPS: {
  label: string;
  items: { key: PageKey; label: string; icon: ReactNode }[];
}[] = [
  {
    label: "内容生产",
    items: [
      { key: "resource", label: "资源管理", icon: <DatabaseOutlined /> },
      { key: "article", label: "创作工坊", icon: <FileTextOutlined /> },
    ],
  },
  {
    label: "发布运营",
    items: [
      { key: "accounts", label: "账号中心", icon: <TeamOutlined /> },
      { key: "publish", label: "内容发布", icon: <SendOutlined /> },
      { key: "task", label: "自动托管", icon: <ScheduleOutlined /> },
    ],
  },
  {
    label: "系统",
    items: [
      { key: "ai", label: "AI 配置", icon: <SettingOutlined /> },
      { key: "help", label: "使用帮助", icon: <QuestionCircleOutlined /> },
    ],
  },
];

const TITLES: Record<PageKey, { title: string; desc: string }> = {
  resource: {
    title: "资源管理",
    desc: "今日热点、微信爆文与图片素材，持续更新",
  },
  accounts: {
    title: "账号中心",
    desc: "公众号 / 头条号 / 百家号登录与登录态维护",
  },
  article: { title: "创作工坊", desc: "AI 生成爆款文章，一键套用排版模板" },
  publish: { title: "内容发布", desc: "多平台账号管理与一键发布" },
  task: { title: "自动托管", desc: "定时批量创作，公众号推送草稿箱" },
  ai: {
    title: "AI 配置",
    desc: "手动配置文本模型，或使用一键授权",
  },
  help: { title: "使用帮助", desc: "常见问题，点开即可查看" },
};

const COLLAPSE_KEY = "wangaohui:sidebar-collapsed";
/** macOS 顶部留给系统红黄绿灯的高度（标题栏条与侧边栏同步）。 */
const MAC_TITLEBAR_HEIGHT = 32;

/** 未启用 Tailwind preflight：原生 button 需要显式去掉浏览器默认边框与底色。 */
const PLAIN_BUTTON = "border-0 bg-transparent";

const DRAG = { WebkitAppRegion: "drag" } as React.CSSProperties;
const NO_DRAG = { WebkitAppRegion: "no-drag" } as React.CSSProperties;

/** 主进程通过 preload 暴露真实平台；测试环境回退到 UA。 */
function detectPlatform(): "darwin" | "win32" | "linux" {
  const raw = (window.wangaohui as { platform?: unknown } | undefined)
    ?.platform;
  if (typeof raw === "string" && raw)
    return raw as "darwin" | "win32" | "linux";
  const ua = navigator.userAgent;
  if (/Mac/i.test(ua)) return "darwin";
  if (/Win/i.test(ua)) return "win32";
  return "linux";
}

interface Props {
  page: PageKey;
  onNavigate: (p: PageKey) => void;
  children: ReactNode;
}

export default function AppShell({ page, onNavigate, children }: Props) {
  const brandLogo = logoMarkCustom;
  const appName = "万稿汇";
  const siteName = "开源内容创作工具";
  const isMac = detectPlatform() === "darwin";
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === "1",
  );
  /** 页头右侧主操作槽：由各页面通过 <PageActions when={active}> 注册。 */
  const [pageActions, setPageActions] = useState<ReactNode>(null);

  useEffect(() => {
    document.title = appName;
  }, []);

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  // 对齐参考项目：低频静默保鲜（不切换账号，只刷新 token/cookie），避免长时间无操作掉登录
  useAccountKeepAlive();

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        <aside
          className={cn(
            "flex shrink-0 flex-col border-r border-border bg-surface-subtle transition-[width] duration-200 ease-out",
            collapsed ? "w-[72px]" : "w-[196px]",
          )}
        >
          {/* macOS：红黄绿灯浮在侧边栏上方，这里留出高度并保持可拖动 */}
          {isMac && (
            <div
              className="shrink-0"
              style={{ height: MAC_TITLEBAR_HEIGHT, ...DRAG }}
            />
          )}

          <div
            className={cn(
              "flex items-center gap-2.5 px-3 pt-3 pb-2",
              collapsed && "justify-center px-0",
            )}
          >
            <img
              src={brandLogo}
              className="size-9 shrink-0 rounded-[10px] object-cover"
              alt={appName}
            />
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-[15px] leading-tight font-semibold">
                  {appName}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {siteName}
                </div>
              </div>
            )}
          </div>

          <nav
            aria-label="主导航"
            className="flex flex-1 flex-col overflow-y-auto px-2 pt-0.5 pb-2"
          >
            {NAV_GROUPS.map((group, index) => (
              <div key={group.label} className="flex flex-col">
                {collapsed
                  ? index > 0 && (
                      <div className="mx-2.5 my-2 border-t border-border-subtle" />
                    )
                  : (
                      <div className="px-2.5 pt-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground/70">
                        {group.label}
                      </div>
                    )}
                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const active = item.key === page;
                    const button = (
                      <button
                        key={item.key}
                        type="button"
                        aria-current={active ? "page" : undefined}
                        aria-label={item.label}
                        onClick={() => onNavigate(item.key)}
                        className={cn(
                          PLAIN_BUTTON,
                          "flex h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors",
                          collapsed && "justify-center px-0",
                          active
                            ? "bg-accent font-semibold text-accent-foreground"
                            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                        )}
                      >
                        <span className="flex size-5 shrink-0 items-center justify-center leading-none [&_svg]:block [&_svg]:size-[18px]">
                          {item.icon}
                        </span>
                        {!collapsed && (
                          <span className="truncate leading-5">{item.label}</span>
                        )}
                      </button>
                    );
                    return collapsed ? (
                      <Tooltip key={item.key}>
                        <TooltipTrigger asChild>{button}</TooltipTrigger>
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      </Tooltip>
                    ) : (
                      button
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className={cn("px-2 pb-2", collapsed && "px-1.5")}>
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
              aria-expanded={!collapsed}
              className={cn(
                PLAIN_BUTTON,
                "flex h-9 w-full items-center gap-3 rounded-[10px] px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground",
                collapsed && "justify-center px-0",
              )}
            >
              {collapsed ? (
                <ChevronRightOutlined />
              ) : (
                <>
                  <ChevronLeftOutlined />
                  收起
                </>
              )}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div
            onDoubleClick={() => window.wangaohui?.winMaximize?.()}
            className={cn(
              "flex shrink-0 items-center px-6 select-none",
              !isMac && "justify-between",
            )}
            style={{ height: MAC_TITLEBAR_HEIGHT, ...DRAG }}
          >
            {!isMac && (
              <>
                <div className="truncate text-xs text-muted-foreground">
                  {appName}
                </div>
                <div className="flex items-center gap-0.5" style={NO_DRAG}>
                  <button
                    type="button"
                    title="最小化"
                    aria-label="最小化窗口"
                    onClick={() => window.wangaohui?.winMinimize()}
                    className={cn(
                      PLAIN_BUTTON,
                      "grid size-7 place-items-center rounded-md text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    )}
                  >
                    ―
                  </button>
                  <button
                    type="button"
                    title="最大化"
                    aria-label="最大化窗口"
                    onClick={() => window.wangaohui?.winMaximize()}
                    className={cn(
                      PLAIN_BUTTON,
                      "grid size-7 place-items-center rounded-md text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    )}
                  >
                    □
                  </button>
                  <button
                    type="button"
                    title="关闭"
                    aria-label="关闭窗口"
                    onClick={() => window.wangaohui?.winClose()}
                    className={cn(
                      PLAIN_BUTTON,
                      "grid size-7 place-items-center rounded-md text-base text-muted-foreground transition-colors hover:bg-destructive hover:text-white",
                    )}
                  >
                    ×
                  </button>
                </div>
              </>
            )}
          </div>

          <header className="shrink-0 px-6 pb-3">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h1
                  data-slot="page-title"
                  className="m-0 truncate text-[22px] leading-tight font-semibold tracking-[-0.02em]"
                >
                  {TITLES[page].title}
                </h1>
                <p className="mt-1 mb-0 truncate text-xs text-muted-foreground">
                  {TITLES[page].desc}
                </p>
              </div>
              {pageActions ? (
                <div className="flex shrink-0 items-center gap-2">
                  {pageActions}
                </div>
              ) : null}
            </div>
          </header>

          <main className="app-content">
            <PageActionsSlot.Provider value={setPageActions}>
              {children}
            </PageActionsSlot.Provider>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
