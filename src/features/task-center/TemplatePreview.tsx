import CoverThumb from "@/components/CoverThumb";
import {
ColorPicker,
Modal,
Select,
Space,
} from "@/components/shared/controls";
import StickerBodyCard from "@/components/StickerBodyCard";
import type { TemplateDesign } from "@/data/articleTemplates";
import { ARTICLE_TEMPLATES } from "@/data/articleTemplates";
import { SAMPLE_ARTICLE_BLOCKS } from "@/data/sampleArticle";
import type { StickerCoverTemplate } from "@/data/stickerTemplates";
import { allCoverTemplates } from "@/data/stickerTemplates";
import { buildInlineHtml } from "@/utils/articleHtml";
import { useTaskCenter } from "./useTaskCenter";
type Props = Pick<
  ReturnType<typeof useTaskCenter>,
  | "previewOpen"
  | "setPreviewOpen"
  | "form"
  | "previewTpl"
  | "previewAccent"
  | "previewTplId"
  | "setPreviewTplId"
  | "setPreviewAccent"
>;
export function TemplatePreview({
  previewOpen,
  setPreviewOpen,
  form,
  previewTpl,
  previewAccent,
  previewTplId,
  setPreviewTplId,
  setPreviewAccent,
}: Props) {
  return (
    <Modal
      title="模板预览"
      open={previewOpen}
      footer={null}
      width={560}
      onCancel={() => setPreviewOpen(false)}
    >
      {(() => {
        const v = form.getFieldValue("contentType");
        if (v === "sticker") {
          const tpl =
            (previewTpl() as StickerCoverTemplate) || allCoverTemplates()[0];
          return (
            <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
              <div style={{ width: 180 }}>
                <div className="form-label" style={{ textAlign: "center" }}>
                  首图
                </div>
                <CoverThumb tpl={tpl} title="越是想做个完美的母亲" text="" />
              </div>
              <div style={{ width: 180 }}>
                <div className="form-label" style={{ textAlign: "center" }}>
                  内容卡
                </div>
                <StickerBodyCard
                  tpl={tpl}
                  page={2}
                  total={3}
                  heading="越追求完美，自己就越崩溃"
                  text="“因为我是母亲”这句话比我想象的更沉重。"
                />
              </div>
            </div>
          );
        }
        const tpl = (previewTpl() as TemplateDesign) || ARTICLE_TEMPLATES[0];
        const accent = previewAccent || tpl.accent;
        return (
          <div>
            <Space style={{ marginBottom: 8 }}>
              <Select
                size="small"
                style={{ width: 220 }}
                value={previewTplId}
                onChange={(v) => {
                  setPreviewTplId(v);
                  form.setFieldsValue({ templateId: v });
                }}
                options={ARTICLE_TEMPLATES.map((x) => ({
                  value: x.id,
                  label: x.name,
                }))}
              />
              <ColorPicker
                size="small"
                value={accent}
                onChange={(c) => setPreviewAccent(c.toHexString())}
              />
            </Space>
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: 20,
                maxHeight: 460,
                overflow: "auto",
                background: "#fff",
              }}
              dangerouslySetInnerHTML={{
                __html: buildInlineHtml(
                  SAMPLE_ARTICLE_BLOCKS as never[],
                  tpl,
                  accent,
                ),
              }}
            />
          </div>
        );
      })()}
    </Modal>
  );
}
