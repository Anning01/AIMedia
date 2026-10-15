import { Button } from "@/components/shared/controls";
import { CopyIcon, FileTextIcon, PaperPlaneIcon } from "@radix-ui/react-icons";
import { useArticleWorkspace } from "../workspace-context";
export function CreationPublishActions() {
  const {
    contentType,
    blocks,
    copyToGzh,
    saveEdit,
    openPushModal,
    pushLoading,
    renderingCover,
    generating,
  } = useArticleWorkspace();
  const disabled =
    !blocks.length || pushLoading || renderingCover || generating;
  return (
    <div
      className="creation-publish-actions"
      onFocusCapture={saveEdit}
      onPointerDownCapture={saveEdit}
    >
      {contentType === "article" && (
        <Button
          size="small"
          disabled={disabled}
          icon={<CopyIcon />}
          onClick={copyToGzh}
        >
          复制
        </Button>
      )}
      <Button
        size="small"
        disabled={disabled}
        icon={<FileTextIcon />}
        onClick={() => openPushModal("draft")}
      >
        推送草稿
      </Button>
      <Button
        size="small"
        type="primary"
        disabled={disabled}
        icon={<PaperPlaneIcon />}
        onClick={() => openPushModal("publish")}
      >
        发布内容
      </Button>
    </div>
  );
}
