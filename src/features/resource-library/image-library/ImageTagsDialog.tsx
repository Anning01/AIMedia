import { Field,FormDialog } from "@/components/shared/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useImageLibraryContext } from "./workspace-context";

export function ImageTagsDialog() {
  const { tagTarget, setTagTarget, saveTags, tagText, setTagText } =
    useImageLibraryContext();
  return (
    <FormDialog
      open={!!tagTarget}
      onOpenChange={(open) => {
        if (!open) setTagTarget(null);
      }}
      title={`编辑标签 · ${tagTarget?.name || ""}`}
      footer={
        <>
          <Button variant="secondary" onClick={() => setTagTarget(null)}>
            取消
          </Button>
          <Button onClick={saveTags}>保存</Button>
        </>
      }
    >
      <Field
        label="标签（逗号分隔）"
        hint="标签用于图库分类筛选，建议 2-4 个。"
      >
        <Input
          value={tagText}
          aria-label="图片标签"
          onChange={(event) => setTagText(event.target.value)}
          placeholder="例如：文章配图，轻断食，实拍"
        />
      </Field>
    </FormDialog>
  );
}
