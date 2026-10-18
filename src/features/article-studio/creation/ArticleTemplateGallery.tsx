import { Button,Card,ColorPicker,Space } from "@/components/shared/controls";
import { SettingOutlined } from "@/components/shared/icons";
import { TEMPLATE_CATEGORIES } from "@/data/articleTemplates";
import { ACCENT_PRESETS } from "../model";
import { useArticleWorkspace } from "../workspace-context";
import { ArticleTemplateOption } from "./ArticleTemplateOption";
export function ArticleTemplateGallery() {
  const {
    tplCat,
    setTplCat,
    visibleTemplates,
    currentAccent,
    setAccent,
    isCustom,
    resetAccent,
    effective,
    openGenerator,
  } = useArticleWorkspace();
  return (
    <Card
      title="排版模板"
      size="small"
      extra={
        <Button icon={<SettingOutlined />} onClick={openGenerator}>
          主题生成器
        </Button>
      }
    >
      <div className="tpl-cats">
        {TEMPLATE_CATEGORIES.map((c) => (
          <button
            type="button"
            key={c}
            className={`cat-chip ${tplCat === c ? "selected" : ""}`}
            onClick={() => setTplCat(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="tpl-list">
        {visibleTemplates.map((t) => (
          <ArticleTemplateOption key={t.id} template={t} />
        ))}
      </div>
      <div className="creation-template-controls">
        <div className="form-label">主题色（一键换色）</div>
        <Space wrap size={4}>
          {ACCENT_PRESETS.map((c) => (
            <button
              type="button"
              aria-label={`主题色 ${c}`}
              key={c}
              className="color-swatch"
              style={{
                background: c,
                outline: currentAccent === c ? "2px solid #2F54EB" : "none",
              }}
              onClick={() => setAccent(c)}
            />
          ))}
          <ColorPicker
            value={currentAccent}
            onChange={(c) => setAccent(c.toHexString())}
            size="small"
          />
          {isCustom && (
            <Button size="small" type="text" onClick={resetAccent}>
              重置
            </Button>
          )}
        </Space>
      </div>
      <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
        已应用：{effective.name} · {effective.desc}
      </div>
    </Card>
  );
}
