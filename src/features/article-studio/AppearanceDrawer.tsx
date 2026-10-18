import {
Alert,
Button,
Col,
ColorPicker,
Drawer,
Input,
Row,
Select,
Slider,
Space,
Switch,
} from "@/components/shared/controls";
import type { ThemeOverrides } from "@/data/themeOverrides";
import { VARIANT_KEYS,VARIANT_OPTIONS } from "./model";
import { useArticleWorkspace } from "./workspace-context";

export function AppearanceDrawer() {
  const {
    genOpen,
    setGenOpen,
    resetGen,
    genName,
    setGenName,
    saveAsTemplate,
    applyGen,
    effective,
    genDraft,
    setGenDraft,
  } = useArticleWorkspace();

  return (
    <Drawer
      title="主题生成器"
      placement="right"
      width={430}
      open={genOpen}
      onClose={() => setGenOpen(false)}
      footer={
        <Space style={{ width: "100%", justifyContent: "space-between" }} wrap>
          <Button onClick={resetGen}>重置</Button>
          <Space>
            <Input
              placeholder="另存为名称"
              value={genName}
              onChange={(e) => setGenName(e.target.value)}
              style={{ width: 130 }}
            />
            <Button onClick={saveAsTemplate}>另存为我的模板</Button>
          </Space>
          <Button type="primary" onClick={applyGen}>
            保存到当前模板
          </Button>
        </Space>
      }
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="改动实时反映在左侧编辑器中，满意后再保存。"
      />
      <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>
        当前模板：{effective.name} · 调整后可直接看左侧正文效果
      </div>
      <Row gutter={[0, 12]}>
        <Col span={24}>
          <div className="form-label">
            正文字号：{genDraft.fontSize ?? 15}px
          </div>
          <Slider
            min={13}
            max={20}
            step={1}
            value={genDraft.fontSize ?? 15}
            onChange={(v) => setGenDraft({ ...genDraft, fontSize: v })}
          />
        </Col>
        <Col span={24}>
          <div className="form-label">行高：{genDraft.lineHeight ?? 1.9}</div>
          <Slider
            min={1.5}
            max={2.2}
            step={0.05}
            value={genDraft.lineHeight ?? 1.9}
            onChange={(v) => setGenDraft({ ...genDraft, lineHeight: v })}
          />
        </Col>
        <Col span={24}>
          <div className="form-label">
            字间距：{genDraft.letterSpacing ?? 0}em
          </div>
          <Slider
            min={0}
            max={0.25}
            step={0.01}
            value={genDraft.letterSpacing ?? 0}
            onChange={(v) => setGenDraft({ ...genDraft, letterSpacing: v })}
          />
        </Col>
        <Col span={12}>
          <div className="form-label">正文颜色</div>
          <Space>
            <ColorPicker
              value={genDraft.bodyColor || "#333a48"}
              onChange={(c) =>
                setGenDraft({ ...genDraft, bodyColor: c.toHexString() })
              }
              size="small"
            />
            {genDraft.bodyColor && (
              <Button
                size="small"
                type="text"
                onClick={() =>
                  setGenDraft({ ...genDraft, bodyColor: undefined })
                }
              >
                重置
              </Button>
            )}
          </Space>
        </Col>
        <Col span={12}>
          <div className="form-label">标题颜色</div>
          <Space>
            <ColorPicker
              value={genDraft.titleColor || "#1f2430"}
              onChange={(c) =>
                setGenDraft({ ...genDraft, titleColor: c.toHexString() })
              }
              size="small"
            />
            {genDraft.titleColor && (
              <Button
                size="small"
                type="text"
                onClick={() =>
                  setGenDraft({ ...genDraft, titleColor: undefined })
                }
              >
                重置
              </Button>
            )}
          </Space>
        </Col>
        <Col span={24}>
          <Switch
            checked={!!genDraft.indent}
            onChange={(v) => setGenDraft({ ...genDraft, indent: v })}
          />
          <span style={{ fontSize: 13, marginLeft: 8 }}>
            段落首行缩进 2 字符
          </span>
        </Col>
        {VARIANT_KEYS.map((key) => (
          <Col span={12} key={key}>
            <div className="form-label">
              {
                {
                  layout: "整体骨架",
                  title: "大标题版式",
                  h2: "小标题版式",
                  quote: "引用版式",
                  card: "卡片版式",
                  divider: "分割线版式",
                  ctaStyle: "CTA 按钮",
                  list: "清单版式",
                }[key]
              }
            </div>
            <Select
              style={{ width: "100%" }}
              value={genDraft[key] || effective[key]}
              options={VARIANT_OPTIONS[key].map((o) => ({
                value: o.value,
                label: o.label,
              }))}
              onChange={(v) =>
                setGenDraft({ ...genDraft, [key]: v } as ThemeOverrides)
              }
            />
          </Col>
        ))}
        <Col span={24}>
          <div className="form-label">
            自定义 CSS（作用于预览与导出的文章容器，选择器建议用 .ae-p、.ae-h2
            等）
          </div>
          <Input.TextArea
            rows={4}
            value={genDraft.customCSS || ""}
            onChange={(e) =>
              setGenDraft({ ...genDraft, customCSS: e.target.value })
            }
            placeholder="例如：.ae-p { color: #444; }"
          />
        </Col>
      </Row>
    </Drawer>
  );
}
