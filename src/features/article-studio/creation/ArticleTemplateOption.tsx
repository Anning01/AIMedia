import { Button,Popconfirm } from "@/components/shared/controls";
import {
DeleteOutlined,
StarFilled,
StarOutlined,
} from "@/components/shared/icons";
import TplThumb from "@/components/TplThumb";
import type { TemplateDesign } from "@/data/articleTemplates";
import {
TPL_SAMPLE,
templateClasses,
templatePaperBg,
} from "@/data/articleTemplates";
import { effectiveTemplate } from "@/data/themeOverrides";
import { useArticleWorkspace } from "../workspace-context";
export function ArticleTemplateOption({
  template: t,
}: {
  template: TemplateDesign;
}) {
  const {
    tplCustom,
    themeOverrides,
    templateId,
    setTemplateId,
    setTplPreview,
    toggleFav,
    favorites,
    removeCustomTemplate,
  } = useArticleWorkspace();

  const tAccent = tplCustom[t.id] || t.accent;
  const tCustom = tAccent !== t.accent;
  const tEff = effectiveTemplate(t, themeOverrides[t.id]);
  const s = TPL_SAMPLE[t.id] || TPL_SAMPLE.t1;
  const tStyle = {
    "--tpl-accent": tAccent,
    "--tpl-custom-bg": templatePaperBg(tEff),
    "--tpl-font-size": `${themeOverrides[t.id]?.fontSize ?? 15}px`,
    "--tpl-line-height": `${themeOverrides[t.id]?.lineHeight ?? (tEff.layout === "journal" ? 2.05 : 1.9)}`,
    "--tpl-letter-spacing": `${themeOverrides[t.id]?.letterSpacing ?? 0}em`,
    "--tpl-indent": themeOverrides[t.id]?.indent ? "2em" : "0em",
    "--tpl-body-color":
      themeOverrides[t.id]?.bodyColor ||
      (tEff.paper === "dark" ? "#c9d2df" : "#333a48"),
    "--tpl-title-color":
      themeOverrides[t.id]?.titleColor ||
      (tEff.paper === "dark" ? "#ffffff" : "#1f2430"),
  } as React.CSSProperties;
  return (
    <div key={t.id}>
      <div
        className={`tpl-preview-frame ${t.id === templateId ? "selected" : ""}`}
        role="button"
        tabIndex={0}
        aria-label={`选择模板 ${t.name}`}
        aria-pressed={t.id === templateId}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setTemplateId(t.id);
          }
        }}
        onClick={() => {
          setTemplateId(t.id);
        }}
      >
        <TplThumb className={templateClasses(tEff, tCustom)} style={tStyle}>
          {tEff.layout === "banner" ? (
            <div className="layout-banner">
              <h1 className="ae-title">{s.title}</h1>
              <div className="ae-subtitle">{s.sub}</div>
            </div>
          ) : (
            <>
              <h1 className="ae-title">{s.title}</h1>
              <div className="ae-subtitle">{s.sub}</div>
            </>
          )}
          {tEff.layout === "toc" && (
            <div className="layout-toc">
              <div className="toc-title">📑 本文目录</div>
              <div className="toc-item">
                <span className="toc-num">1</span>
                <span>{s.h2}</span>
              </div>
              <div className="toc-item">
                <span className="toc-num">2</span>
                <span>第二个小标题</span>
              </div>
            </div>
          )}
          {tEff.layout === "cards" ||
          tEff.layout === "faq" ||
          tEff.layout === "timeline" ? (
            <div
              className={
                tEff.layout === "faq"
                  ? "layout-faq"
                  : tEff.layout === "timeline"
                    ? "layout-timeline"
                    : "layout-card"
              }
            >
              <div className="ae-h2">{s.h2}</div>
              <p className="ae-p">{s.p}</p>
              <div className="ae-quote">{s.quote}</div>
              <div className="ae-card">{s.card}</div>
            </div>
          ) : (
            <>
              <div className="ae-h2">{s.h2}</div>
              <p className="ae-p">{s.p}</p>
              <div className="ae-quote">{s.quote}</div>
              <div className="ae-card">{s.card}</div>
            </>
          )}
          <ul className="ae-list">
            {s.list.map((li, liIdx) => (
              <li key={liIdx}>{li}</li>
            ))}
          </ul>
          <div className="ae-tip">
            <span className="ae-tip-mark">提示</span>
            <span>{s.tip}</span>
          </div>
          <div className="ae-divider" />
          <div className="ae-cta">点赞 · 在看 · 关注不迷路</div>
        </TplThumb>
        <button
          type="button"
          className="tpl-fav"
          aria-label={
            favorites.includes(t.id) ? `取消收藏 ${t.name}` : `收藏 ${t.name}`
          }
          onClick={(e) => {
            e.stopPropagation();
            toggleFav(t.id);
          }}
        >
          {favorites.includes(t.id) ? (
            <StarFilled style={{ color: "#f5a623" }} />
          ) : (
            <StarOutlined />
          )}
        </button>
        {t.id.startsWith("custom-") && (
          <Popconfirm
            title="删除该自定义模板？"
            onConfirm={(e) => {
              e?.stopPropagation();
              removeCustomTemplate(t.id);
            }}
            onCancel={(e) => e?.stopPropagation()}
          >
            <button
              type="button"
              className="tpl-del"
              onClick={(e) => e.stopPropagation()}
            >
              <DeleteOutlined />
            </button>
          </Popconfirm>
        )}
      </div>
      <div className="tpl-meta">
        {t.name}
        <Button type="text" size="small" onClick={() => setTplPreview(t)}>
          预览
        </Button>
        <span className="muted"> · {t.category}</span>
      </div>
    </div>
  );
}
