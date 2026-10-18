import { Button, message } from "@/components/shared/controls";
export function QilingAccountLinks() {
  return (
    <div className="flex flex-wrap gap-2">
      {(
        [
          { page: "usage", label: "使用记录" },
          { page: "recharge", label: "充值余额" },
          { page: "keys", label: "Key 管理" },
        ] as const
      ).map((item) => (
        <Button
          size="small"
          type="text"
          key={item.page}
          onClick={() =>
            void window.wangaohui
              ?.qilingOpenAccount({ page: item.page })
              .then((result) => {
                if (!result.ok) message.error(result.error || "打开失败");
              })
          }
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
}
