import { Button } from "@/components/shared/controls";
import type { HostTaskItem } from "@/data/localStore";
import { PauseIcon, PlayIcon, CheckCircledIcon } from "@radix-ui/react-icons";
import { taskState } from "./task-state";
export function TaskToggleButton({
  task,
  executing = false,
  onToggle,
}: {
  task: HostTaskItem;
  executing?: boolean;
  onToggle: () => void;
}) {
  const state = taskState(task, executing);
  const busy = state === "executing";
  const active = state === "running";
  const completed = state === "completed";
  const label = busy
    ? "执行中"
    : completed
      ? "已完成"
      : active
        ? "暂停"
        : "启动";
  return (
    <Button
      size="small"
      type={active || completed ? "default" : "primary"}
      className="task-toggle-button"
      data-task-control={task.id}
      data-action={completed ? "none" : active ? "pause" : "start"}
      aria-label={`${label}任务`}
      title={
        busy
          ? "任务正在执行，请等待当前执行结束"
          : completed
            ? "任务目标已完成"
            : active
              ? "暂停后不再执行后续计划"
              : "恢复任务，按计划执行"
      }
      loading={busy}
      disabled={busy || completed}
      icon={
        completed ? <CheckCircledIcon /> : active ? <PauseIcon /> : <PlayIcon />
      }
      onClick={onToggle}
    >
      {label}
    </Button>
  );
}
