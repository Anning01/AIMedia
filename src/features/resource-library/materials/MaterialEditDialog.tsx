import { Field,FormDialog } from "@/components/shared/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMaterialsContext } from "./workspace-context";

export function MaterialEditDialog() {
  const {
    editTarget,
    setEditTarget,
    saveEdit,
    editTitle,
    setEditTitle,
    editContent,
    setEditContent,
  } = useMaterialsContext();

  return (
    <FormDialog
      open={!!editTarget}
      onOpenChange={(open) => {
        if (!open) setEditTarget(null);
      }}
      title={`编辑素材 · ${editTarget?.material.title || ""}`}
      className="sm:max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={() => setEditTarget(null)}>
            取消
          </Button>
          <Button onClick={saveEdit}>保存</Button>
        </>
      }
    >
      <Field label="标题">
        <Input
          aria-label="素材标题"
          value={editTitle}
          onChange={(event) => setEditTitle(event.target.value)}
        />
      </Field>
      <Field
        label={editTarget?.material.isOutline ? "大纲内容" : "正文内容"}
      >
        <Textarea
          rows={10}
          aria-label="素材内容"
          value={editContent}
          onChange={(event) => setEditContent(event.target.value)}
        />
      </Field>
    </FormDialog>
  );
}
