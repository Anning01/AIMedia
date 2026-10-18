import { Button,Radio } from "@/components/shared/controls";
import { Cross2Icon,ImageIcon } from "@radix-ui/react-icons";
import { useArticleWorkspace } from "../workspace-context";
export function CreationImages() {
  const {
    contentType,
    imgMode,
    setImgMode,
    autoImgCount,
    setAutoImgCount,
    pickImages,
    uploadImgs,
    setUploadImgs,
  } = useArticleWorkspace();
  return (
    <div className="creation-images">
      <div className="creation-section-heading">
        <div>
          <h3>图片配置</h3>
          <p>
            {contentType === "article"
              ? "选择自动配图，或使用你自己的图片。"
              : "为贴图提供参考图片，也可以仅输入文字生成。"}
          </p>
        </div>
      </div>
      <div className="creation-field-row">
        {contentType === "article" && (
          <Radio.Group
            value={imgMode}
            onChange={(event) => setImgMode(event.target.value)}
            options={[
              { label: "自动配图", value: "auto" },
              { label: "上传图片", value: "upload" },
            ]}
          />
        )}{" "}
        {contentType === "article" && imgMode === "auto" ? (
          <Radio.Group
            aria-label="自动配图数量"
            value={autoImgCount}
            onChange={(event) => setAutoImgCount(event.target.value)}
            options={[1, 2, 3].map((value) => ({
              value,
              label: `${value} 张`,
            }))}
          />
        ) : (
          <Button icon={<ImageIcon />} onClick={pickImages}>
            上传 / 从图库选择（{contentType === "sticker" ? "1-9" : "1-3"} 张）
          </Button>
        )}
      </div>
      {uploadImgs.length > 0 &&
        (contentType === "sticker" || imgMode === "upload") && (
          <div className="creation-upload-list">
            {uploadImgs.map((image, index) => (
              <div key={image.dataUrl} className="creation-upload-image">
                <img src={image.dataUrl} alt={image.name} />
                <button
                  type="button"
                  aria-label={`移除${image.name}`}
                  onClick={() =>
                    setUploadImgs(uploadImgs.filter((_, i) => i !== index))
                  }
                >
                  <Cross2Icon />
                </button>
                <span>{image.name}</span>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
