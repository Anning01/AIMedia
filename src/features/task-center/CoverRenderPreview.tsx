import CoverThumb from "@/components/CoverThumb";
import StickerBodyCard from "@/components/StickerBodyCard";
import { allCoverTemplates } from "@/data/stickerTemplates";
import { useTaskCenter } from "./useTaskCenter";
type Props = Pick<
  ReturnType<typeof useTaskCenter>,
  | "coverRef"
  | "renderTplId"
  | "form"
  | "renderCoverTitle"
  | "cardList"
  | "cardRefs"
>;
export function CoverRenderPreview({
  coverRef,
  renderTplId,
  form,
  renderCoverTitle,
  cardList,
  cardRefs,
}: Props) {
  return (
    <div
      aria-hidden="true"
      style={{ position: "fixed", left: -9999, top: 0, pointerEvents: "none" }}
    >
      <div ref={coverRef} style={{ width: 168 }}>
        <CoverThumb
          tpl={
            allCoverTemplates().find(
              (x) =>
                x.id ===
                (renderTplId || form.getFieldValue("templateId") || ""),
            ) || allCoverTemplates()[0]
          }
          title={renderCoverTitle || "贴图标题示例"}
          text=""
        />
      </div>
      {cardList.map((c, i) => (
        <div
          key={i}
          ref={(el) => {
            cardRefs.current[i] = el;
          }}
          style={{ width: 168 }}
        >
          <StickerBodyCard
            tpl={
              allCoverTemplates().find(
                (x) =>
                  x.id ===
                  (renderTplId || form.getFieldValue("templateId") || ""),
              ) || allCoverTemplates()[0]
            }
            page={i + 2}
            total={cardList.length + 1}
            text={c.text}
            heading={c.heading}
          />
        </div>
      ))}
    </div>
  );
}
