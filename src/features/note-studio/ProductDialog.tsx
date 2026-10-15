import {
Button,
Col,
Image,
Input,
InputNumber,
Modal,
Row,
Select,
Space,
} from "@/components/shared/controls";
import {
DeleteOutlined,
PictureOutlined,
PlusOutlined,
} from "@/components/shared/icons";
import { useNoteWorkspace } from "./workspace-context";

export function ProductDialog() {
  const {
    editingProduct,
    productModalOpen,
    setProductModalOpen,
    submitProduct,
    prodName,
    setProdName,
    prodMainImage,
    uploadMainImage,
    setProdMainImage,
    prodPoints,
    setProdPoints,
    prodAudience,
    setProdAudience,
    prodPrice,
    setProdPrice,
    prodSceneImages,
    setProdSceneImages,
    uploadSceneImages,
    prodAppearance,
    setProdAppearance,
  } = useNoteWorkspace();

  return (
    <Modal
      title={editingProduct ? "编辑产品" : "新建产品"}
      open={productModalOpen}
      onCancel={() => setProductModalOpen(false)}
      onOk={submitProduct}
      okText="保存"
    >
      <div className="form-label">产品名称</div>
      <Input
        value={prodName}
        onChange={(e) => setProdName(e.target.value)}
        placeholder="例：燕麦拿铁咖啡"
      />
      <div className="form-label" style={{ marginTop: 12 }}>
        产品主图（必填）
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {prodMainImage ? (
          <Image
            src={prodMainImage}
            alt="产品主图"
            width={96}
            height={96}
            style={{
              objectFit: "cover",
              borderRadius: 8,
              border: "1px solid #edf0f7",
            }}
            preview={{ mask: "查看" }}
          />
        ) : (
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 8,
              border: "1px dashed #c8d0e0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#98a1b3",
              fontSize: 12,
              background: "#fafbfe",
            }}
          >
            未上传
          </div>
        )}
        <Space direction="vertical">
          <Button
            size="small"
            icon={<PictureOutlined />}
            onClick={uploadMainImage}
          >
            上传 / 更换主图
          </Button>
          {prodMainImage && (
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => setProdMainImage("")}
            >
              移除
            </Button>
          )}
        </Space>
      </div>
      <div className="form-label" style={{ marginTop: 12 }}>
        核心卖点
      </div>
      <Input.TextArea
        rows={2}
        value={prodPoints}
        onChange={(e) => setProdPoints(e.target.value)}
        placeholder="例：0 糖 0 脂，冷热双泡，办公室 30 秒出杯"
      />
      <Row gutter={12} style={{ marginTop: 12 }}>
        <Col span={12}>
          <div className="form-label">目标人群</div>
          <Select
            style={{ width: "100%" }}
            value={prodAudience}
            onChange={setProdAudience}
            options={["职场白领", "健身人群", "学生党", "宝妈", "通勤族"].map(
              (a) => ({ value: a, label: a }),
            )}
          />
        </Col>
        <Col span={12}>
          <div className="form-label">客单价（元）</div>
          <InputNumber
            style={{ width: "100%" }}
            value={prodPrice}
            onChange={(v) => setProdPrice(v ?? 0)}
            min={0}
          />
        </Col>
      </Row>
      <div className="form-label" style={{ marginTop: 12 }}>
        场景图（选填，最多 3 张）
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {prodSceneImages.map((img, i) => (
          <div key={i} style={{ position: "relative" }}>
            <Image
              src={img}
              alt={`场景图 ${i + 1}`}
              width={72}
              height={72}
              style={{
                objectFit: "cover",
                borderRadius: 8,
                border: "1px solid #edf0f7",
              }}
              preview={{ mask: "查看" }}
            />
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              style={{
                position: "absolute",
                top: -8,
                right: -8,
                borderRadius: "50%",
              }}
              onClick={() =>
                setProdSceneImages(prodSceneImages.filter((_, x) => x !== i))
              }
            />
          </div>
        ))}
        {prodSceneImages.length < 3 && (
          <Button
            style={{
              width: 72,
              height: 72,
              borderRadius: 8,
              borderStyle: "dashed",
            }}
            icon={<PlusOutlined />}
            onClick={uploadSceneImages}
          />
        )}
      </div>
      <div className="form-label" style={{ marginTop: 12 }}>
        产品外观描述（用于 AI 生成场景图）
      </div>
      <Input.TextArea
        rows={2}
        value={prodAppearance}
        onChange={(e) => setProdAppearance(e.target.value)}
        placeholder="例：白色纸杯，杯身印燕麦拿铁四个字，配金色杯盖；不填则用产品名称和卖点自动生成"
      />
    </Modal>
  );
}
