import "../history/history.css";
import { useEffect } from "react";
import { loadArticleHistory } from "@/data/localStore";
import { useArticleWorkspace } from "../workspace-context";
import { Modal } from "@/components/shared/controls";
import { ArticleHistory } from "../ArticleHistory";
export function CreationHistoryDialog({
  open,
  onClose,
  onLoad,
}: {
  open: boolean;
  onClose: () => void;
  onLoad: () => void;
}) {
  const { setHistory } = useArticleWorkspace();
  useEffect(() => {
    if (open) setHistory(loadArticleHistory());
  }, [open, setHistory]);
  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="历史作品"
      footer={null}
      width={760}
    >
      <ArticleHistory onLoad={onLoad} />
    </Modal>
  );
}
