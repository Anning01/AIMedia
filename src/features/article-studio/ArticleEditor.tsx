import {
  Button,
  Card,
  Dropdown,
  Space,
  Tag,
} from "@/components/shared/controls";
import { EyeOutlined } from "@/components/shared/icons";
import { ArticleCanvas } from "./creation/ArticleCanvas";
import { CreationPublishActions } from "./creation/CreationPublishActions";
import { useRemoveAi } from "./useRemoveAi";
import { RemoveAiDialog } from "./RemoveAiDialog";
import { TOOLBAR } from "./model";
import { useArticleWorkspace } from "./workspace-context";
import { EditorHistoryControls } from "./EditorHistoryControls";
export function ArticleEditor() {
  const {
    removeAiText,
    adoptRemoveAi,
    contentType,
    effective,
    coverTpl,
    setStickerPreviewIdx,
    setStickerPreviewOpen,
    setPreviewOpen,
    saveEdit,
    addBlock,
  } = useArticleWorkspace();
  const removeAi = useRemoveAi(removeAiText, adoptRemoveAi);
  return (
    <section className="creation-article-editor">
      <Card
        title={
          <Space>
            {contentType === "article" ? "文章编辑器" : "贴图编辑器"}
            {contentType === "article" && (
              <Tag color="blue">已选：{effective.name}</Tag>
            )}
            {contentType === "sticker" && (
              <Tag color="purple">首图：{coverTpl.name}</Tag>
            )}
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<EyeOutlined />}
              onClick={() => {
                saveEdit();
                if (contentType === "sticker") {
                  setStickerPreviewIdx(0);
                  setStickerPreviewOpen(true);
                } else {
                  setPreviewOpen(true);
                }
              }}
            >
              手机预览
            </Button>
            <CreationPublishActions />
          </Space>
        }
      >
        <>
          <div className="creation-editor-toolbar">
            <EditorHistoryControls />
            <Space>
              <Button
                disabled={!removeAiText.trim()}
                onClick={() => void removeAi.show()}
              >
                去 AI / 降低 AI 痕迹
              </Button>
              <Dropdown
                menu={{
                  items: (contentType === "sticker"
                    ? TOOLBAR.filter(
                        (item) => item.type === "p" || item.type === "image",
                      )
                    : TOOLBAR
                  ).map((item) => ({ key: item.type, label: item.label })),
                  onClick: ({ key }) => {
                    const item = TOOLBAR.find((item) => item.type === key);
                    if (item) addBlock(item.type, item.sample, item.items);
                  },
                }}
              >
                <Button>添加模块</Button>
              </Dropdown>
            </Space>
          </div>
          <ArticleCanvas />
        </>
      </Card>
      <RemoveAiDialog flow={removeAi} />
    </section>
  );
}
