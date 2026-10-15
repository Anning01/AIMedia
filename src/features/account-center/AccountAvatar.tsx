import { cn } from "@/lib/utils";
import type { AccountItem } from "@/data/localStore";
import { useState } from "react";

/** 账号头像：加载失败或没有头像时退回首字占位。 */
export function AccountAvatar({
  account,
  size = 36,
  className,
}: {
  account: AccountItem;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const name = account.name || "微";
  if (account.avatar && !failed) {
    return (
      <img
        src={account.avatar}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={cn("shrink-0 rounded-[10px] object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-[10px] bg-accent text-sm font-medium text-accent-foreground",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {name.slice(0, 1)}
    </div>
  );
}
