import { Button, Card, Empty, Table } from "@/components/shared/controls";
import { PlusOutlined } from "@/components/shared/icons";
import "./task-state.css";
import { useTaskCenter } from "./useTaskCenter";
type Props = Pick<
  ReturnType<typeof useTaskCenter>,
  "tasks" | "setCreateOpen" | "columns"
>;
export function TaskList({ tasks, setCreateOpen, columns }: Props) {
  return (
    <Card
      title={`托管任务（${tasks.length}）`}
    >
      {tasks.length === 0 ? (
        <Empty description="还没有托管任务，先新建一个试试">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            新建任务
          </Button>
        </Empty>
      ) : (
        <Table
          rowKey="id"
          columns={columns}
          dataSource={tasks}
          size="small"
          scroll={{ y: 520 }}
          pagination={{ pageSize: 10, showSizeChanger: false }}
        />
      )}
    </Card>
  );
}
