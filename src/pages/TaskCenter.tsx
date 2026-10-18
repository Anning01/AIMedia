import { CoverRenderPreview } from "@/features/task-center/CoverRenderPreview";
import { TaskEditor } from "@/features/task-center/TaskEditor";
import { TaskList } from "@/features/task-center/TaskList";
import { TaskLogs } from "@/features/task-center/TaskLogs";
import { TemplatePreview } from "@/features/task-center/TemplatePreview";
import { useTaskCenter } from "@/features/task-center/useTaskCenter";
import { Button } from "@/components/shared/controls";
import { PlusOutlined } from "@/components/shared/icons";
import { PageActions } from "@/layout/page-actions";
import { TaskStats } from "@/features/task-center/TaskStats";
export default function TaskCenter({ active = true }: { active?: boolean }) {
  const {
    contextHolder,
    tasks,
    setCreateOpen,
    columns,
    editingTask,
    createOpen,
    closeCreate,
    form,
    saveTask,
    accounts,
    sourceOptions,
    categories,
    openPreview,
    previewOpen,
    setPreviewOpen,
    previewTpl,
    previewAccent,
    previewTplId,
    setPreviewTplId,
    setPreviewAccent,
    logTask,
    setLogTask,
    coverRef,
    renderTplId,
    renderCoverTitle,
    cardList,
    cardRefs,
  } = useTaskCenter({ active });
  return (
    <div>
      {contextHolder}

      <PageActions when={active}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateOpen(true)}
        >
          新建任务
        </Button>
      </PageActions>

      {tasks.length > 0 && <TaskStats tasks={tasks} />}

      <TaskList tasks={tasks} setCreateOpen={setCreateOpen} columns={columns} />

      <TaskEditor
        editingTask={editingTask}
        createOpen={createOpen}
        closeCreate={closeCreate}
        form={form}
        saveTask={saveTask}
        accounts={accounts}
        sourceOptions={sourceOptions}
        categories={categories}
        openPreview={openPreview}
      />

      <TemplatePreview
        previewOpen={previewOpen}
        setPreviewOpen={setPreviewOpen}
        form={form}
        previewTpl={previewTpl}
        previewAccent={previewAccent}
        previewTplId={previewTplId}
        setPreviewTplId={setPreviewTplId}
        setPreviewAccent={setPreviewAccent}
      />

      <TaskLogs logTask={logTask} setLogTask={setLogTask} />

      <CoverRenderPreview
        coverRef={coverRef}
        renderTplId={renderTplId}
        form={form}
        renderCoverTitle={renderCoverTitle}
        cardList={cardList}
        cardRefs={cardRefs}
      />
    </div>
  );
}
