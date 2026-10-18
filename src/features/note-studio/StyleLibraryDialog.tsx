import {
Button,
Card,
Empty,
Modal,
Space,
} from "@/components/shared/controls";
import { DeleteOutlined } from "@/components/shared/icons";
import { useNoteWorkspace } from "./workspace-context";

export function StyleLibraryDialog() {
  const {
    styleModalOpen,
    setStyleModalOpen,
    styleAssets,
    setEntryMode,
    useStyleAsset,
    removeStyleItem,
  } = useNoteWorkspace();

  return (
    <Modal
      title="风格资产库"
      open={styleModalOpen}
      width={640}
      onCancel={() => setStyleModalOpen(false)}
      footer={null}
    >
      {styleAssets.length === 0 ? (
        <Empty description="还没有风格资产，先去解析一篇爆款">
          <Button
            type="primary"
            onClick={() => {
              setStyleModalOpen(false);
              setEntryMode("parse");
            }}
          >
            去解析新爆款
          </Button>
        </Empty>
      ) : (
        <div style={{ maxHeight: 420, overflow: "auto" }}>
          {styleAssets.map((s) => (
            <Card key={s.id} size="small" style={{ marginBottom: 10 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {s.sourceTitle} · {s.tags.slice(0, 5).join(" ")}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {s.angle}
                  </div>
                </div>
                <Space wrap>
                  <Button
                    size="small"
                    type="primary"
                    ghost
                    onClick={() => useStyleAsset(s)}
                  >
                    使用
                  </Button>
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeStyleItem(s.id)}
                  />
                </Space>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Modal>
  );
}
