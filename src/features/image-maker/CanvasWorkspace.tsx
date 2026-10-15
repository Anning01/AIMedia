import {
Button,
Card,
Col,
Input,
Row,
Slider,
Space,
Switch,
Tag,
} from "@/components/shared/controls";
import {
DownloadOutlined,
SaveOutlined,
ThunderboltOutlined,
UploadOutlined,
} from "@/components/shared/icons";
import {
BG_PRESETS,
CAT_LABELS,
CATEGORIES,
TEMPLATES,
TEXT_COLORS,
} from "./model";
import { useImageMaker } from "./useImageMaker";
type Props = Pick<
  ReturnType<typeof useImageMaker>,
  | "catInfo"
  | "cat"
  | "setCat"
  | "pickTemplate"
  | "tmpls"
  | "tmplId"
  | "downloadPng"
  | "canvasRef"
  | "bg"
  | "moveDrag"
  | "dragRef"
  | "layers"
  | "selectedId"
  | "startDrag"
  | "setSelectedId"
  | "selected"
  | "patchLayer"
  | "setBg"
  | "setAiOpen"
  | "uploadBg"
  | "saveToAssets"
>;
export function CanvasWorkspace({
  catInfo,
  cat,
  setCat,
  pickTemplate,
  tmpls,
  tmplId,
  downloadPng,
  canvasRef,
  bg,
  moveDrag,
  dragRef,
  layers,
  selectedId,
  startDrag,
  setSelectedId,
  selected,
  patchLayer,
  setBg,
  setAiOpen,
  uploadBg,
  saveToAssets,
}: Props) {
  return (
    <Row gutter={16}>
      <Col xs={24} lg={5}>
        <Card
          title="模板库"
          size="small"
          styles={{ body: { padding: 12 } }}
          extra={<Tag color="cyan">{catInfo.ratio}</Tag>}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 12,
            }}
          >
            {CATEGORIES.map((c) => (
              <div
                key={c.key}
                className={`cat-chip ${cat === c.key ? "selected" : ""}`}
                onClick={() => {
                  setCat(c.key);
                  pickTemplate(TEMPLATES.find((t) => t.cat === c.key)!);
                }}
              >
                {CAT_LABELS[c.key] ?? c.label}
              </div>
            ))}
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            {tmpls.map((t) => (
              <div
                key={t.id}
                className={`tpl-mini ${t.id === tmplId ? "selected" : ""}`}
                onClick={() => pickTemplate(t)}
              >
                <div className="tm-bg" style={{ background: t.bg }} />
                <div className="tm-title" style={{ color: t.textColor }}>
                  {t.title}
                </div>
                <div className="tm-lines">
                  <i />
                  <i />
                </div>
                <span className="tm-badge">{t.name}</span>
              </div>
            ))}
          </div>
        </Card>
      </Col>

      <Col xs={24} lg={12}>
        <Card
          title={`画布 · ${catInfo.label}`}
          extra={
            <Space>
              <span className="muted" style={{ fontSize: 12 }}>
                {catInfo.w}×{catInfo.h} · 模板渲染 0 元
              </span>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={() =>
                  downloadPng(`${catInfo.label}-${Date.now()}.png`)
                }
              >
                导出 PNG
              </Button>
            </Space>
          }
        >
          <div
            className="canvas-wrap"
            style={{ overflow: cat === "long" ? "auto" : "hidden" }}
          >
            <div
              ref={canvasRef}
              className="canvas"
              style={{ width: catInfo.w, height: catInfo.h, background: bg }}
              onMouseMove={moveDrag}
              onMouseUp={() => (dragRef.current = null)}
              onMouseLeave={() => (dragRef.current = null)}
            >
              {layers.map((l) => (
                <div
                  key={l.id}
                  className={`layer-text ${l.id === selectedId ? "selected" : ""}`}
                  style={{
                    left: `${l.x}%`,
                    top: `${l.y}%`,
                    fontSize: l.size,
                    color: l.color,
                    fontWeight: l.bold ? 700 : 400,
                    textAlign: "center",
                    width: "86%",
                  }}
                  onMouseDown={(e) => startDrag(e, l)}
                >
                  {l.text}
                </div>
              ))}
            </div>
          </div>
          <div className="hint">
            提示：点击文字图层可选中，拖动调整位置；右侧可修改文案、字号与颜色。
          </div>
        </Card>
      </Col>

      <Col xs={24} lg={7}>
        <Card title="图层" size="small" style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: "100%" }}>
            {layers.map((l) => (
              <Button
                key={l.id}
                block
                type={l.id === selectedId ? "primary" : "default"}
                onClick={() => setSelectedId(l.id)}
              >
                {l.name}：
                {l.text.length > 12 ? `${l.text.slice(0, 12)}…` : l.text}
              </Button>
            ))}
          </Space>
        </Card>

        {selected && (
          <Card title="文字设置" size="small" style={{ marginBottom: 16 }}>
            <div className="form-label">内容</div>
            <Input.TextArea
              rows={2}
              value={selected.text}
              onChange={(e) =>
                patchLayer(selected.id, { text: e.target.value })
              }
            />
            <div className="form-label" style={{ marginTop: 10 }}>
              字号：{selected.size}px
            </div>
            <Slider
              min={10}
              max={48}
              value={selected.size}
              onChange={(v) => patchLayer(selected.id, { size: v })}
            />
            <div className="form-label">加粗</div>
            <Switch
              checked={selected.bold}
              onChange={(v) => patchLayer(selected.id, { bold: v })}
              style={{ marginBottom: 10 }}
            />
            <div className="form-label">文字颜色</div>
            <Space wrap>
              {TEXT_COLORS.map((c) => (
                <span
                  key={c}
                  className="color-swatch"
                  style={{
                    background: c,
                    outline:
                      selected.color === c ? "2px solid #2F54EB" : "none",
                  }}
                  onClick={() => patchLayer(selected.id, { color: c })}
                />
              ))}
            </Space>
          </Card>
        )}

        <Card title="背景与生图" size="small">
          <div className="form-label">背景预设</div>
          <Space wrap style={{ marginBottom: 12 }}>
            {BG_PRESETS.map((b, i) => (
              <span
                key={i}
                className="color-swatch"
                style={{
                  background: b,
                  width: 22,
                  height: 22,
                  outline: bg === b ? "2px solid #2F54EB" : "none",
                }}
                onClick={() => setBg(b)}
              />
            ))}
          </Space>
          <Space direction="vertical" style={{ width: "100%" }}>
            <Button
              block
              icon={<ThunderboltOutlined />}
              onClick={() => setAiOpen(true)}
            >
              AI 生成背景图
            </Button>
            <Button block icon={<UploadOutlined />} onClick={uploadBg}>
              上传本地图片
            </Button>
            <Button block icon={<SaveOutlined />} onClick={saveToAssets}>
              存入素材库
            </Button>
          </Space>
        </Card>
      </Col>
    </Row>
  );
}
