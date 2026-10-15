import {
Button,
Col,
Input,
Modal,
Row,
Select,
Space,
} from "@/components/shared/controls";
import {
CopyOutlined,
DeleteOutlined,
PlusOutlined,
} from "@/components/shared/icons";
import { getPromptSet } from "@/data/promptSets";
import { useArticleWorkspace } from "./workspace-context";

export function PromptSettingsDialog() {
  const {
    promptMgrOpen,
    setPromptMgrOpen,
    editingPromptSet,
    setEditingPromptSet,
    promptSets,
    addPromptSet,
    copyPromptSet,
    removePromptSet,
    patchEditingPromptSet,
    saveEditingPromptSet,
    resetEditingPromptSet,
  } = useArticleWorkspace();

  return (
    <Modal
      title="提示词管理（多套）"
      open={promptMgrOpen}
      onCancel={() => setPromptMgrOpen(false)}
      footer={null}
      width={920}
    >
      {editingPromptSet && (
        <Row gutter={16}>
          <Col span={7}>
            <div className="form-label">提示词套件</div>
            <Select
              style={{ width: "100%" }}
              value={editingPromptSet.id}
              onChange={(id) => setEditingPromptSet({ ...getPromptSet(id) })}
              options={promptSets.map((s) => ({ value: s.id, label: s.name }))}
            />
            <Space
              direction="vertical"
              style={{ width: "100%", marginTop: 10 }}
            >
              <Button block icon={<PlusOutlined />} onClick={addPromptSet}>
                新增套件
              </Button>
              <Button block icon={<CopyOutlined />} onClick={copyPromptSet}>
                复制当前套件
              </Button>
              <Button
                block
                danger
                icon={<DeleteOutlined />}
                disabled={editingPromptSet.id === "default"}
                onClick={removePromptSet}
              >
                删除当前套件
              </Button>
            </Space>
            <div className="muted" style={{ fontSize: 12, marginTop: 12 }}>
              提示词不绑定账号：创作工坊选择套件生成，自动托管任务也可选择套件；「默认」套件不可删除。
            </div>
          </Col>
          <Col span={17}>
            <div className="form-label">
              备注名（如：星座号 / 情感号 / 职场号）
            </div>
            <Input
              value={editingPromptSet.name}
              onChange={(e) => patchEditingPromptSet({ name: e.target.value })}
              placeholder="给这套提示词起个名字"
            />
            <div className="form-label" style={{ marginTop: 10 }}>
              文章大纲 · 系统提示词
            </div>
            <Input.TextArea
              rows={3}
              value={editingPromptSet.outlineSystem}
              onChange={(e) =>
                patchEditingPromptSet({ outlineSystem: e.target.value })
              }
            />
            <div className="form-label" style={{ marginTop: 8 }}>
              文章大纲 · 用户提示词模板（变量：{"{topic}"} {"{words}"}{" "}
              {"{templateNote}"} {"{tagNote}"}）
            </div>
            <Input.TextArea
              rows={6}
              value={editingPromptSet.outlineUser}
              onChange={(e) =>
                patchEditingPromptSet({ outlineUser: e.target.value })
              }
              style={{ fontSize: 13 }}
            />
            <div className="form-label" style={{ marginTop: 8 }}>
              贴图 · 系统提示词
            </div>
            <Input.TextArea
              rows={3}
              value={editingPromptSet.stickerSystem}
              onChange={(e) =>
                patchEditingPromptSet({ stickerSystem: e.target.value })
              }
            />
            <div className="form-label" style={{ marginTop: 8 }}>
              贴图 · 用户提示词模板（变量：{"{topic}"} {"{words}"}）
            </div>
            <Input.TextArea
              rows={4}
              value={editingPromptSet.stickerUser}
              onChange={(e) =>
                patchEditingPromptSet({ stickerUser: e.target.value })
              }
              style={{ fontSize: 13 }}
            />
            <Space style={{ marginTop: 12 }}>
              <Button type="primary" onClick={saveEditingPromptSet}>
                保存这套
              </Button>
              <Button onClick={resetEditingPromptSet}>恢复默认内容</Button>
            </Space>
          </Col>
        </Row>
      )}
    </Modal>
  );
}
