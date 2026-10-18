import CoverThumb from "@/components/CoverThumb";
import { Modal } from "@/components/shared/controls";
import { useArticleWorkspace } from "./workspace-context";

export function StickerPreviewDialog() {
  const {
    stickerPreviewOpen,
    setStickerPreviewOpen,
    stickerTitleText,
    stickerImageBlocks,
    stickerPreviewIdx,
    coverTpl,
    setStickerPreviewIdx,
    stickerText,
  } = useArticleWorkspace();

  return (
    <Modal
      title="贴图预览"
      open={stickerPreviewOpen}
      footer={null}
      width={460}
      onCancel={() => setStickerPreviewOpen(false)}
    >
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
        {stickerTitleText || "未命名贴图"}
      </div>
      {(() => {
        const previewImages = stickerImageBlocks.filter((b) => b.src);
        const current = previewImages[stickerPreviewIdx] || previewImages[0];
        return (
          <>
            <div style={{ width: 220, margin: "0 auto 14px" }}>
              {current ? (
                <img
                  src={current.src}
                  alt=""
                  style={{
                    width: "100%",
                    aspectRatio: "3 / 4",
                    objectFit: "cover",
                    borderRadius: 12,
                  }}
                />
              ) : (
                <CoverThumb
                  tpl={coverTpl}
                  title={stickerTitleText || "贴图标题"}
                  text=""
                />
              )}
            </div>
            {previewImages.length > 1 && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  overflowX: "auto",
                  marginBottom: 12,
                }}
              >
                {previewImages.map((b, i) => (
                  <img
                    key={b.id}
                    src={b.src}
                    alt=""
                    onClick={() => setStickerPreviewIdx(i)}
                    style={{
                      width: 120,
                      height: 160,
                      objectFit: "cover",
                      borderRadius: 8,
                      flexShrink: 0,
                      cursor: "pointer",
                      border:
                        i === stickerPreviewIdx
                          ? "2px solid #2F54EB"
                          : "2px solid transparent",
                    }}
                  />
                ))}
              </div>
            )}
          </>
        );
      })()}
      <div
        style={{
          whiteSpace: "pre-wrap",
          color: "#333a48",
          lineHeight: 1.8,
          fontSize: 15,
        }}
      >
        {stickerText || "（无描述）"}
      </div>
    </Modal>
  );
}
