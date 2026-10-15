import { Modal,Switch } from "@/components/shared/controls";
import { templateClasses } from "@/data/articleTemplates";
import { renderArticleBody } from "./article-renderer";
import { useArticleWorkspace } from "./workspace-context";

export function ArticlePreviewDialog() {
  const {
    previewOpen,
    setPreviewOpen,
    darkPreview,
    setDarkPreview,
    effective,
    isCustom,
    paperStyle,
    liveOverrides,
    blocks,
  } = useArticleWorkspace();

  return (
    <Modal
      title="手机预览"
      open={previewOpen}
      footer={null}
      width={460}
      onCancel={() => setPreviewOpen(false)}
    >
      <div
        style={{
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span className="muted" style={{ fontSize: 13 }}>
          微信深色模式预览（贴进公众号后，读者在深色模式下的大致效果）
        </span>
        <Switch checked={darkPreview} onChange={setDarkPreview} size="small" />
      </div>
      <div
        className={`phone-frame ${templateClasses(effective, isCustom)} ${darkPreview ? "wechat-dark" : ""}`}
        style={paperStyle}
      >
        {liveOverrides.customCSS ? (
          <style>{liveOverrides.customCSS}</style>
        ) : null}
        {renderArticleBody(blocks, effective)}
      </div>
    </Modal>
  );
}
