import {
Button,
Empty,
Image,
Modal,
Space,
} from "@/components/shared/controls";
import { DeleteOutlined } from "@/components/shared/icons";
import { listNoteHistory,removeNoteHistory } from "@/data/localStore";
import { useNoteWorkspace } from "./workspace-context";

export function NoteHistoryDialog() {
  const { historyOpen, setHistoryOpen, loadHistory, setHistoryTick } =
    useNoteWorkspace();

  return (
    <Modal
      title="历史生成笔记"
      open={historyOpen}
      onCancel={() => setHistoryOpen(false)}
      footer={null}
      width={720}
    >
      {listNoteHistory().length === 0 ? (
        <Empty description="还没有生成记录：采纳候选并生成配图后会自动保存">
          <Button type="primary" onClick={() => setHistoryOpen(false)}>
            去生成
          </Button>
        </Empty>
      ) : (
        <div
          style={{
            maxHeight: 520,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {listNoteHistory().map((h) => (
            <div
              key={h.id}
              style={{
                border: "1px solid #edf0f7",
                borderRadius: 10,
                padding: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{h.title}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    产品：{h.productName}
                    {h.sourceTitle ? ` · 来自《${h.sourceTitle}》` : ""} ·{" "}
                    {new Date(h.updatedAt).toLocaleString()}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {h.paras.length} 段正文 · {h.tags.slice(0, 4).join(" ")} ·{" "}
                    {h.images.length
                      ? `${h.images.length} 张配图`
                      : "未生成配图"}
                  </div>
                </div>
                <Space size={4} style={{ flexShrink: 0 }}>
                  <Button
                    size="small"
                    type="primary"
                    onClick={() => loadHistory(h)}
                  >
                    载入
                  </Button>
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => {
                      removeNoteHistory(h.id);
                      setHistoryTick((t) => t + 1);
                    }}
                  />
                </Space>
              </div>
              {h.images.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    gap: 4,
                    marginTop: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {h.images.slice(0, 9).map((d, i) => (
                    <Image
                      key={i}
                      src={d}
                      width={44}
                      height={44}
                      style={{ objectFit: "cover", borderRadius: 5 }}
                      preview={{ mask: "查看" }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
