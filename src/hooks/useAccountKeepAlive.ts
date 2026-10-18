import { useEffect } from "react";
import { listAccounts, saveAccount } from "@/data/localStore";
export function useAccountKeepAlive() {
  useEffect(() => {
    const keepAlive = async () => {
      const list = listAccounts();
      for (const a of list) {
        if (
          a.platform !== "公众号" ||
          !a.token ||
          !a.cookie ||
          a.authed === false
        )
          continue;
        const stale =
          !a.lastRefresh ||
          Date.now() - new Date(a.lastRefresh).getTime() > 25 * 60 * 1000;
        if (!stale) continue;
        try {
          const r = await window.wangaohui?.wechatRefreshSession({
            token: a.token,
            cookie: a.cookie,
            fingerprint: a.fingerprint,
          });
          if (r?.ok && r.cookies) {
            saveAccount({
              ...a,
              token: r.token || a.token,
              cookie: r.cookies,
              lastRefresh: r.lastRefresh,
            });
          }
        } catch {
          /* 静默忽略，不打扰用户 */
        }
      }
    };
    const t = window.setTimeout(keepAlive, 60 * 1000);
    const iv = window.setInterval(keepAlive, 30 * 60 * 1000);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(iv);
    };
  }, []);
}
