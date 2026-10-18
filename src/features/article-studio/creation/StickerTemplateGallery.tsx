import CoverThumb from "@/components/CoverThumb";
import { Button,Card } from "@/components/shared/controls";
import {
DeleteOutlined,
EditOutlined,
SettingOutlined,
} from "@/components/shared/icons";
import { STICKER_COVER_CATEGORIES } from "@/data/stickerTemplates";
import { useArticleWorkspace } from "../workspace-context";
export function StickerTemplateGallery() {
  const {
    openCoverDesign,
    coverCat,
    setCoverCat,
    visibleCoverTemplates,
    coverTplId,
    setCoverTplId,
    stickerTitleText,
    removeCoverTemplate,
    coverTpl,
  } = useArticleWorkspace();
  return (
    <Card
      title="首图模板"
      size="small"
      extra={
        <Button
          size="small"
          icon={<SettingOutlined />}
          onClick={() => openCoverDesign()}
        >
          设计模板
        </Button>
      }
    >
      <div className="tpl-cats">
        {STICKER_COVER_CATEGORIES.map((c) => (
          <button
            type="button"
            key={c}
            className={`cat-chip ${coverCat === c ? "selected" : ""}`}
            onClick={() => setCoverCat(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="tpl-list">
        {visibleCoverTemplates.map((t) => (
          <div key={t.id}>
            <div
              className={`tpl-preview-frame ${t.id === coverTplId ? "selected" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={`选择首图 ${t.name}`}
              aria-pressed={t.id === coverTplId}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setCoverTplId(t.id);
                }
              }}
              style={{ aspectRatio: "3 / 4" }}
              onClick={() => setCoverTplId(t.id)}
            >
              <CoverThumb
                tpl={t}
                title={
                  stickerTitleText || "承认自己很普通，然后全力成为不一样的自己"
                }
                text=""
                style={{ borderRadius: 0 }}
              />
            </div>
            <div className="tpl-meta">
              {t.name}
              <span className="muted"> · {t.cat}</span>
              {t.id.startsWith("cus-") && (
                <span
                  style={{
                    marginLeft: "auto",
                    display: "inline-flex",
                    gap: 2,
                  }}
                >
                  <Button
                    size="small"
                    type="text"
                    icon={<EditOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      openCoverDesign(t);
                    }}
                  />
                  <Button
                    size="small"
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeCoverTemplate(t.id);
                    }}
                  />
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
        已应用：{coverTpl.name} · {coverTpl.desc}
      </div>
    </Card>
  );
}
