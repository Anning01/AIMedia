import { ClockIcon, PauseIcon, PlayIcon } from "@radix-ui/react-icons";
import type { HostTaskItem } from "@/data/localStore";
import { isTaskEnabled, taskState } from "./task-state";

export function TaskStats({ tasks }: { tasks: HostTaskItem[] }) {
  const stats = [
    {
      label: "运行中",
      value: tasks.filter(isTaskEnabled).length,
      Icon: PlayIcon,
      color: "var(--success)",
    },
    {
      label: "已暂停",
      value: tasks.filter((task) => taskState(task) === "paused").length,
      Icon: PauseIcon,
      color: "var(--warning)",
    },
    {
      label: "全部任务",
      value: tasks.length,
      Icon: ClockIcon,
      color: "var(--muted-foreground)",
    },
  ];
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-3">
      {stats.map(({ label, value, Icon, color }) => (
        <div
          key={label}
          className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3"
        >
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-xl leading-none font-semibold">
              {value}
              <small className="ml-1 text-xs font-normal text-muted-foreground">
                个
              </small>
            </div>
          </div>
          <Icon aria-hidden="true" style={{ color }} className="size-4 shrink-0" />
        </div>
      ))}
    </div>
  );
}
