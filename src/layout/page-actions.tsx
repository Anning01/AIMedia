import { createContext, useContext, useEffect, type ReactNode } from "react";

/**
 * 页面级主操作槽：页面用 <PageActions> 把「唯一主按钮」注册到壳层页头右侧。
 * 七个页面常驻挂载（App.tsx 用 display:none 切换），因此必须传 when={active}，
 * 否则隐藏页面也会往槽位里塞按钮。
 * 独立挂载（scripts/ui-test 的 ?page= 入口）时没有 Provider，注册自动空转。
 */
export const PageActionsSlot = createContext<((node: ReactNode) => void) | null>(
  null,
);

export function PageActions({
  when = true,
  children,
}: {
  when?: boolean;
  children: ReactNode;
}) {
  const set = useContext(PageActionsSlot);
  useEffect(() => {
    if (!set || !when) return;
    set(children);
    return () => set(null);
  }, [set, when, children]);
  return null;
}
