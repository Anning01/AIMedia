import StickerBodyCard from "@/components/StickerBodyCard";
import { useArticleWorkspace } from "./workspace-context";

export function ImagePreviewDialog() {
  const { bodyCardList, bodyCardRefs, coverTpl } = useArticleWorkspace();

  return (
    <div
      aria-hidden="true"
      style={{ position: "fixed", left: -9999, top: 0, pointerEvents: "none" }}
    >
      {bodyCardList.map((c, i) => (
        <div
          key={i}
          ref={(el) => {
            bodyCardRefs.current[i] = el;
          }}
          style={{ width: 168 }}
        >
          <StickerBodyCard
            tpl={coverTpl}
            page={i + 2}
            total={bodyCardList.length + 1}
            text={c.text}
            heading={c.heading}
          />
        </div>
      ))}
    </div>
  );
}
