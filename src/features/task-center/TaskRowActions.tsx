import { Button, Space, Tooltip } from "@/components/shared/controls";
import type { HostTaskItem } from "@/data/localStore";
import {
  MagnifyingGlassIcon,
  Pencil1Icon,
  TrashIcon,
} from "@radix-ui/react-icons";
import { TaskToggleButton } from "./TaskToggleButton";
export function TaskRowActions({
  task,
  executing,
  onEdit,
  onToggle,
  onLogs,
  onDelete,
}: {
  task: HostTaskItem;
  executing: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onLogs: () => void;
  onDelete: () => void;
}) {
  return (
    <Space size={4}>
      <Tooltip title="编辑任务">
        <Button
          type="text"
          size="small"
          icon={<Pencil1Icon />}
          onClick={onEdit}
        />
      </Tooltip>
      <TaskToggleButton task={task} executing={executing} onToggle={onToggle} />
      <Tooltip title="查看日志">
        <Button
          type="text"
          size="small"
          icon={<MagnifyingGlassIcon />}
          onClick={onLogs}
        />
      </Tooltip>
      <Tooltip title="删除任务">
        <Button
          type="text"
          size="small"
          danger
          icon={<TrashIcon />}
          onClick={onDelete}
        />
      </Tooltip>
    </Space>
  );
}
