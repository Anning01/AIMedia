import {
Button,
Card,
Empty,
Image,
Modal,
Space,
} from "@/components/shared/controls";
import { DeleteOutlined,PlusOutlined } from "@/components/shared/icons";
import { useNoteWorkspace } from "./workspace-context";

export function NoteDialog() {
  const {
    productLibraryOpen,
    setProductLibraryOpen,
    openAddProduct,
    products,
    setProductId,
    openEditProduct,
    removeProductItem,
  } = useNoteWorkspace();

  return (
    <Modal
      title="产品库"
      open={productLibraryOpen}
      width={600}
      onCancel={() => setProductLibraryOpen(false)}
      footer={
        <Button type="primary" icon={<PlusOutlined />} onClick={openAddProduct}>
          新建产品
        </Button>
      }
    >
      {products.length === 0 ? (
        <Empty description="产品库还是空的，先新建一个产品">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openAddProduct}
          >
            新建产品
          </Button>
        </Empty>
      ) : (
        <div style={{ maxHeight: 420, overflow: "auto" }}>
          {products.map((p) => (
            <Card key={p.id} size="small" style={{ marginBottom: 10 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ display: "flex", gap: 10, minWidth: 0 }}>
                  {p.mainImage ? (
                    <Image
                      src={p.mainImage}
                      alt={p.name}
                      width={64}
                      height={64}
                      style={{
                        objectFit: "cover",
                        borderRadius: 8,
                        border: "1px solid #edf0f7",
                      }}
                      preview={false}
                    />
                  ) : (
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 8,
                        border: "1px dashed #c8d0e0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#98a1b3",
                        fontSize: 11,
                        background: "#fafbfe",
                      }}
                    >
                      缺主图
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div
                      className="muted"
                      style={{ fontSize: 12, marginTop: 2 }}
                    >
                      {p.audience} · ¥{p.price}
                    </div>
                    <div
                      className="muted"
                      style={{ fontSize: 12, marginTop: 2 }}
                    >
                      {p.points}
                    </div>
                  </div>
                </div>
                <Space wrap>
                  <Button
                    size="small"
                    type="primary"
                    ghost
                    onClick={() => {
                      setProductId(p.id);
                      setProductLibraryOpen(false);
                    }}
                  >
                    选用
                  </Button>
                  <Button size="small" onClick={() => openEditProduct(p)}>
                    编辑
                  </Button>
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeProductItem(p.id)}
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
