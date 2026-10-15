import CoverThumb from "@/components/CoverThumb";
import {
Button,
Col,
Divider,
Input,
InputNumber,
Modal,
Row,
Select,
Space,
Switch,
} from "@/components/shared/controls";
import type { CustomStickerTemplate } from "@/data/stickerTemplates";
import {
DEFAULT_COVER_ZONE,
STICKER_COVER_CATEGORIES,
} from "@/data/stickerTemplates";
import {
COVER_FONT_OPTIONS,
COVER_HIGHLIGHT_OPTIONS,
ZoneEditor,
} from "./article-renderer";
import { useArticleWorkspace } from "./workspace-context";

export function CoverDialog() {
  const {
    coverDesignEditingId,
    coverDesignOpen,
    setCoverDesignOpen,
    coverDesign,
    coverDesignName,
    setCoverDesignName,
    patchCoverDesign,
    coverColor,
    pickCoverImage,
    patchCoverZone,
    setCoverDesign,
    patchCardZone,
    saveCoverDesign,
  } = useArticleWorkspace();

  return (
    <Modal
      title={coverDesignEditingId ? "编辑自定义模板" : "设计模板"}
      open={coverDesignOpen}
      onCancel={() => setCoverDesignOpen(false)}
      footer={null}
      width={680}
    >
      <Row gutter={[20, 12]}>
        <Col span={9}>
          <div
            style={{
              border: "1px solid #edf0f7",
              borderRadius: 12,
              overflow: "hidden",
              padding: 8,
              background: "#f7f8fc",
            }}
          >
            <CoverThumb
              tpl={coverDesign}
              title={coverDesignName || "自定义标题"}
              text=""
            />
          </div>
        </Col>
        <Col span={15}>
          <div className="form-label">模板名称</div>
          <Input
            value={coverDesignName}
            onChange={(e) => setCoverDesignName(e.target.value)}
            placeholder="给模板起个名字"
          />
          <div className="form-label" style={{ marginTop: 8 }}>
            分类
          </div>
          <Select
            style={{ width: "100%" }}
            value={coverDesign.cat}
            onChange={(v) => patchCoverDesign({ cat: v })}
            options={STICKER_COVER_CATEGORIES.filter((c) => c !== "全部").map(
              (c) => ({
                value: c,
                label: c,
              }),
            )}
          />
          <Row gutter={10} style={{ marginTop: 8 }}>
            <Col span={12}>
              <div className="form-label">背景色</div>
              <input
                type="color"
                value={coverColor(coverDesign.bg)}
                onChange={(e) => patchCoverDesign({ bg: e.target.value })}
                style={{
                  width: "100%",
                  height: 32,
                  border: "1px solid #d9d9d9",
                  borderRadius: 6,
                  padding: 2,
                  cursor: "pointer",
                }}
              />
            </Col>
            <Col span={12}>
              <div className="form-label">边框色</div>
              <input
                type="color"
                value={coverColor(coverDesign.frame)}
                onChange={(e) => patchCoverDesign({ frame: e.target.value })}
                style={{
                  width: "100%",
                  height: 32,
                  border: "1px solid #d9d9d9",
                  borderRadius: 6,
                  padding: 2,
                  cursor: "pointer",
                }}
              />
            </Col>
            <Col span={12}>
              <div className="form-label">标题颜色</div>
              <input
                type="color"
                value={coverColor(coverDesign.titleColor)}
                onChange={(e) =>
                  patchCoverDesign({ titleColor: e.target.value })
                }
                style={{
                  width: "100%",
                  height: 32,
                  border: "1px solid #d9d9d9",
                  borderRadius: 6,
                  padding: 2,
                  cursor: "pointer",
                }}
              />
            </Col>
            <Col span={12}>
              <div className="form-label">正文颜色</div>
              <input
                type="color"
                value={coverColor(coverDesign.textColor)}
                onChange={(e) =>
                  patchCoverDesign({ textColor: e.target.value })
                }
                style={{
                  width: "100%",
                  height: 32,
                  border: "1px solid #d9d9d9",
                  borderRadius: 6,
                  padding: 2,
                  cursor: "pointer",
                }}
              />
            </Col>
            <Col span={12}>
              <div className="form-label">强调色</div>
              <input
                type="color"
                value={coverColor(coverDesign.accent)}
                onChange={(e) => patchCoverDesign({ accent: e.target.value })}
                style={{
                  width: "100%",
                  height: 32,
                  border: "1px solid #d9d9d9",
                  borderRadius: 6,
                  padding: 2,
                  cursor: "pointer",
                }}
              />
            </Col>
            <Col span={12}>
              <div className="form-label">标题字号（%）</div>
              <InputNumber
                min={2}
                max={40}
                value={coverDesign.titleSize}
                onChange={(v) =>
                  patchCoverDesign({ titleSize: Number(v) || 10 })
                }
                style={{ width: "100%" }}
              />
            </Col>
            <Col span={12}>
              <div className="form-label">文字字号（%）</div>
              <InputNumber
                min={1}
                max={20}
                value={coverDesign.textSize}
                onChange={(v) => patchCoverDesign({ textSize: Number(v) || 3 })}
                style={{ width: "100%" }}
              />
            </Col>
            <Col span={12}>
              <div className="form-label">布局</div>
              <Select
                style={{ width: "100%" }}
                value={coverDesign.layout}
                onChange={(v) => patchCoverDesign({ layout: v })}
                options={[
                  { value: "top", label: "顶部" },
                  { value: "center", label: "居中" },
                  { value: "bottom", label: "底部" },
                ]}
              />
            </Col>
            <Col span={12}>
              <div className="form-label">对齐</div>
              <Select
                style={{ width: "100%" }}
                value={coverDesign.align || "center"}
                onChange={(v) => patchCoverDesign({ align: v })}
                options={[
                  { value: "left", label: "左对齐" },
                  { value: "center", label: "居中" },
                ]}
              />
            </Col>
            <Col span={12}>
              <div className="form-label">高亮</div>
              <Select
                style={{ width: "100%" }}
                value={coverDesign.highlight || "none"}
                onChange={(v) => patchCoverDesign({ highlight: v })}
                options={COVER_HIGHLIGHT_OPTIONS}
              />
            </Col>
            <Col span={12}>
              <div className="form-label">字体</div>
              <Select
                style={{ width: "100%" }}
                value={coverDesign.titleFont || "sans"}
                onChange={(v) => patchCoverDesign({ titleFont: v })}
                options={COVER_FONT_OPTIONS}
              />
            </Col>
          </Row>
          <div className="form-label" style={{ marginTop: 8 }}>
            徽章文字
          </div>
          <Input
            value={coverDesign.badge || ""}
            onChange={(e) =>
              patchCoverDesign({ badge: e.target.value || undefined })
            }
            placeholder="如：语录 / 情感"
          />
          <Space style={{ marginTop: 8 }}>
            <Switch
              checked={!!coverDesign.showPage}
              onChange={(v) => patchCoverDesign({ showPage: v })}
            />
            显示页码
            <Switch
              checked={!!coverDesign.showArrow}
              onChange={(v) => patchCoverDesign({ showArrow: v })}
            />
            显示箭头
          </Space>
          <Divider style={{ margin: "14px 0 6px" }}>高级选项</Divider>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {coverDesign.bgImage && (
              <img
                src={coverDesign.bgImage}
                alt="首图背景"
                style={{
                  width: 48,
                  height: 64,
                  objectFit: "cover",
                  borderRadius: 6,
                  border: "1px solid #edf0f7",
                }}
              />
            )}
            <Button size="small" onClick={() => pickCoverImage("bgImage")}>
              上传首图背景图
            </Button>
            {coverDesign.bgImage && (
              <Button
                size="small"
                danger
                onClick={() =>
                  patchCoverDesign({
                    bgImage: undefined,
                  } as Partial<CustomStickerTemplate>)
                }
              >
                移除
              </Button>
            )}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              marginTop: 6,
            }}
          >
            {coverDesign.cardBgImage && (
              <img
                src={coverDesign.cardBgImage}
                alt="内容卡背景"
                style={{
                  width: 48,
                  height: 64,
                  objectFit: "cover",
                  borderRadius: 6,
                  border: "1px solid #edf0f7",
                }}
              />
            )}
            <Button size="small" onClick={() => pickCoverImage("cardBgImage")}>
              上传内容卡背景图
            </Button>
            {coverDesign.cardBgImage && (
              <Button
                size="small"
                danger
                onClick={() =>
                  patchCoverDesign({
                    cardBgImage: undefined,
                  } as Partial<CustomStickerTemplate>)
                }
              >
                移除
              </Button>
            )}
          </div>
          <div className="form-label" style={{ marginTop: 8 }}>
            自定义 CSS（可选）
          </div>
          <Input.TextArea
            rows={3}
            value={coverDesign.customCSS || ""}
            onChange={(e) => patchCoverDesign({ customCSS: e.target.value })}
            placeholder="可写 .sticker-cover-zone / .sticker-card-zone 等样式覆盖"
            style={{ fontSize: 12 }}
          />
          <div style={{ marginTop: 10 }}>
            <Switch
              checked={!!coverDesign.coverZones?.length}
              onChange={(v) =>
                v
                  ? patchCoverZone({})
                  : setCoverDesign((d) => ({ ...d, coverZones: undefined }))
              }
            />
            首图自定义文字区域
          </div>
          {coverDesign.coverZones?.length ? (
            <ZoneEditor
              title="首图 · 标题文字区域"
              zone={coverDesign.coverZones[0]}
              onChange={patchCoverZone}
            />
          ) : null}
          <div style={{ marginTop: 10 }}>
            <Switch
              checked={
                !!coverDesign.cardZones?.heading ||
                !!coverDesign.cardZones?.text
              }
              onChange={(v) =>
                v
                  ? setCoverDesign((d) => ({
                      ...d,
                      cardZones: {
                        heading: { ...DEFAULT_COVER_ZONE, y: 16, h: 16 },
                        text: { ...DEFAULT_COVER_ZONE, y: 40, h: 45 },
                      },
                    }))
                  : setCoverDesign((d) => ({ ...d, cardZones: undefined }))
              }
            />
            内容卡自定义文字区域
          </div>
          {coverDesign.cardZones ? (
            <>
              <ZoneEditor
                title="内容卡 · 小标题区域"
                zone={coverDesign.cardZones.heading}
                onChange={(p) => patchCardZone("heading", p)}
              />
              <ZoneEditor
                title="内容卡 · 正文区域"
                zone={coverDesign.cardZones.text}
                onChange={(p) => patchCardZone("text", p)}
              />
            </>
          ) : null}
          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
              marginTop: 16,
            }}
          >
            <Button onClick={() => setCoverDesignOpen(false)}>取消</Button>
            {coverDesignEditingId && (
              <Button onClick={() => saveCoverDesign(false)}>保存修改</Button>
            )}
            <Button type="primary" onClick={() => saveCoverDesign(true)}>
              {coverDesignEditingId ? "另存为新模板" : "另存为我的模板"}
            </Button>
          </div>
        </Col>
      </Row>
    </Modal>
  );
}
