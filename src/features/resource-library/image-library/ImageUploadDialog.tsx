import { Field,FormDialog } from "@/components/shared/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useImageLibraryContext } from "./workspace-context";

export function ImageUploadDialog() {
  const {
    uploadPending,
    setUploadPending,
    confirmUpload,
    uploadTags,
    setUploadTags,
  } = useImageLibraryContext();
  return (
    <FormDialog
      open={!!uploadPending}
      onOpenChange={(open) => {
        if (!open) setUploadPending(null);
      }}
      title={`填写标签 · ${uploadPending?.length || 0} 张图片`}
      description="标签必填，用于图库分类与筛选。"
      footer={
        <>
          <Button variant="secondary" onClick={() => setUploadPending(null)}>
            取消
          </Button>
          <Button onClick={confirmUpload}>上传入库</Button>
        </>
      }
    >
      <Field label="标签（逗号分隔）">
        <Input
          value={uploadTags}
          aria-label="图片标签"
          onChange={(event) => setUploadTags(event.target.value)}
          placeholder="例如：文章配图，轻断食，实拍"
        />
      </Field>
    </FormDialog>
  );
}
