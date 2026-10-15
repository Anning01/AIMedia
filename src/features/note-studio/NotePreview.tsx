import { Card,Col,Segmented } from "@/components/shared/controls";
import { XhsPhonePreview } from "./PhonePreview";
import { useNoteWorkspace } from "./workspace-context";
export function NotePreview() {
  const {
    fetchedNote,
    phoneMode,
    setPhoneMode,
    previewImages,
    previewTitle,
    previewParas,
    previewTags,
    previewAuthor,
    previewAvatar,
    previewLiked,
    previewCollected,
    previewComment,
    isSrcPreview,
  } = useNoteWorkspace();
  return (
    <Col xs={24} xl={9}>
      <div style={{ position: "sticky", top: 16 }}>
        <Card
          title="手机预览"
          size="small"
          extra={
            <span className="muted" style={{ fontSize: 12 }}>
              实时更新
            </span>
          }
        >
          {fetchedNote && (
            <Segmented
              block
              value={phoneMode}
              onChange={(v) => setPhoneMode(v as "src" | "gen")}
              options={[
                { label: "生成效果", value: "gen" },
                { label: "爆款原图", value: "src" },
              ]}
              style={{ marginBottom: 4 }}
            />
          )}
          <XhsPhonePreview
            images={previewImages}
            title={previewTitle}
            paras={previewParas}
            tags={previewTags}
            author={previewAuthor}
            avatar={previewAvatar}
            liked={previewLiked}
            collected={previewCollected}
            comment={previewComment}
            emptyHint={
              isSrcPreview
                ? "爆款原图未能下载，无法预览。\n可先完成左侧流程生成自己的笔记。"
                : "生成的配图会显示在这里。\n先完成左侧的解析与生成流程。"
            }
          />
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            生成图按 3:4 竖图预览；切换「爆款原图」可对照构图差异。
          </div>
        </Card>
      </div>
    </Col>
  );
}
