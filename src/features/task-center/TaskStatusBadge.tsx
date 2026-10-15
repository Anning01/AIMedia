import { Badge } from "@/components/ui/badge";
import type { HostTaskItem } from "@/data/localStore";
import {
  CheckCircledIcon,
  PauseIcon,
  PlayIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import { taskState } from "./task-state";
const labels = {
  running: "运行中",
  paused: "已暂停",
  executing: "执行中",
  completed: "已完成",
};
const icons = {
  running: PlayIcon,
  paused: PauseIcon,
  executing: ReloadIcon,
  completed: CheckCircledIcon,
};
export function TaskStatusBadge({
  task,
  executing = false,
}: {
  task: HostTaskItem;
  executing?: boolean;
}) {
  const state = taskState(task, executing);
  const Icon = icons[state];
  return (
    <Badge
      variant="secondary"
      className="task-status-badge"
      data-task-state={state}
    >
      <Icon
        aria-hidden="true"
        className={state === "executing" ? "animate-spin" : undefined}
      />
      {labels[state]}
    </Badge>
  );
}
