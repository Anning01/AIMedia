import { Empty } from "@/components/shared/controls";
import { templateClasses } from "@/data/articleTemplates";
import { renderArticleBody,renderStickerBody } from "../article-renderer";
import { useArticleWorkspace } from "../workspace-context";
export function ArticleCanvas() {
  const {
    contentType,
    isCustom,
    effective,
    stickerTitleText,
    coverTpl,
    paperStyle,
    blocks,
    uploadImage,
    editingId,
    editValue,
    setEditValue,
    saveEdit,
    cancelEdit,
    startEdit,
    removeBlock,
    insertAfter,
    coverRenderRef,
    renderStickerCards,
    renderingCover,
    liveOverrides,
  } = useArticleWorkspace();
  return (
    <div
      className={`article-paper ${contentType === "article" ? templateClasses(effective, isCustom) : ""}`}
      style={paperStyle}
    >
      {contentType === "sticker" ? (
        renderStickerBody(
          blocks,
          coverTpl,
          stickerTitleText || "贴图标题",
          "",
          uploadImage,
          {
            editingId,
            value: editValue,
            onChange: setEditValue,
            onSave: saveEdit,
            onCancel: cancelEdit,
            onStart: startEdit,
            onDelete: removeBlock,
            onInsertAfter: insertAfter,
          },
          coverRenderRef,
          renderStickerCards,
          renderingCover,
        )
      ) : (
        <>
          {liveOverrides.customCSS ? (
            <style>{liveOverrides.customCSS}</style>
          ) : null}
          {blocks.length === 0 ? (
            <Empty
              description="点击上方生成按钮，或从历史作品载入内容。"
              style={{ marginTop: 60 }}
            />
          ) : (
            renderArticleBody(blocks, effective, uploadImage, {
              editingId,
              value: editValue,
              onChange: setEditValue,
              onSave: saveEdit,
              onCancel: cancelEdit,
              onStart: startEdit,
              onDelete: removeBlock,
              onInsertAfter: insertAfter,
            })
          )}
        </>
      )}
    </div>
  );
}
