import { Alert,Input,Modal } from "@/components/shared/controls";
import { useNoteWorkspace } from "./workspace-context";

export function SaveStyleDialog() {
  const {
    styleSaveOpen,
    setStyleSaveOpen,
    submitStyleSave,
    styleName,
    setStyleName,
  } = useNoteWorkspace();

  return (
    <Modal
      title="保存为风格资产"
      open={styleSaveOpen}
      onCancel={() => setStyleSaveOpen(false)}
      onOk={submitStyleSave}
      okText="保存"
    >
      <div className="form-label">风格资产名称</div>
      <Input
        value={styleName}
        onChange={(e) => setStyleName(e.target.value)}
        placeholder="例：职场轻食 · 强场景种草风"
      />
      <Alert
        type="info"
        showIcon
        style={{ marginTop: 12 }}
        message="保存后，以后可以选这个风格 + 任意产品直接生成新笔记，不需要重新解析。"
      />
    </Modal>
  );
}
