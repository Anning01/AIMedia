import { Button,Modal } from "@/components/shared/controls";
import { templateClasses,templatePaperBg } from "@/data/articleTemplates";
import { SAMPLE_ARTICLE_BLOCKS } from "@/data/sampleArticle";
import { effectiveTemplate } from "@/data/themeOverrides";
import { renderArticleBody } from "./article-renderer";
import { Block } from "./model";
import { useArticleWorkspace } from "./workspace-context";

export function TemplatePreviewDialog() {
  const {
    tplPreview,
    setTplPreview,
    setTemplateId,
    themeOverrides,
    tplCustom,
  } = useArticleWorkspace();

  return (
    <Modal
      title={tplPreview ? `模板预览 · ${tplPreview.name}` : "模板预览"}
      open={!!tplPreview}
      width={560}
      onCancel={() => setTplPreview(null)}
      footer={
        tplPreview && (
          <Button
            type="primary"
            onClick={() => {
              setTemplateId(tplPreview.id);
              setTplPreview(null);
            }}
          >
            使用此模板
          </Button>
        )
      }
    >
      {tplPreview &&
        (() => {
          const eff = effectiveTemplate(
            tplPreview,
            themeOverrides[tplPreview.id],
          );
          const accent = tplCustom[tplPreview.id] || tplPreview.accent;
          const style = {
            "--tpl-accent": accent,
            "--tpl-custom-bg": templatePaperBg(eff),
            "--tpl-font-size": `${themeOverrides[tplPreview.id]?.fontSize ?? 15}px`,
            "--tpl-line-height": `${themeOverrides[tplPreview.id]?.lineHeight ?? (eff.layout === "journal" ? 2.05 : 1.9)}`,
            "--tpl-letter-spacing": `${themeOverrides[tplPreview.id]?.letterSpacing ?? 0}em`,
            "--tpl-indent": themeOverrides[tplPreview.id]?.indent
              ? "2em"
              : "0em",
            "--tpl-body-color":
              themeOverrides[tplPreview.id]?.bodyColor ||
              (eff.paper === "dark" ? "#c9d2df" : "#333a48"),
            "--tpl-title-color":
              themeOverrides[tplPreview.id]?.titleColor ||
              (eff.paper === "dark" ? "#ffffff" : "#1f2430"),
          } as React.CSSProperties;
          return (
            <div
              className={`phone-frame ${templateClasses(eff, false)}`}
              style={style}
            >
              {renderArticleBody(
                SAMPLE_ARTICLE_BLOCKS as unknown as Block[],
                eff,
              )}
            </div>
          );
        })()}
    </Modal>
  );
}
