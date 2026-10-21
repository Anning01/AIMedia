import { Button } from "@/components/shared/controls";
import { ResetIcon } from "@radix-ui/react-icons";
import { useEffect, useRef, type MouseEvent } from "react";
import { useArticleWorkspace } from "./workspace-context";

export function EditorHistoryControls() {
  const { undoEdit, redoEdit, canUndoEdit, canRedoEdit, generating, renderingCover } = useArticleWorkspace();
  const root = useRef<HTMLDivElement>(null);
  const locked = generating || renderingCover;
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey || !(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      const redo = (key === "z" && event.shiftKey) || (key === "y" && event.ctrlKey && !event.metaKey);
      if (key !== "z" && !redo) return;
      const editor = root.current?.closest<HTMLElement>(".creation-article-editor");
      const target = event.target;
      if (locked || !editor?.getClientRects().length || editor.closest("[inert]")) return;
      if (!(target instanceof HTMLElement) || (!editor.contains(target) && target !== document.body)) return;
      // 行内输入保留浏览器的逐次文字撤销；退出输入后由文档历史恢复整段/图片。
      if (target.isContentEditable || target.matches("input,textarea,select") || target.closest('[role="dialog"],[role="alertdialog"]')) return;
      event.preventDefault();
      if (redo) { if (canRedoEdit) redoEdit(); }
      else if (canUndoEdit) undoEdit();
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [locked, undoEdit, redoEdit, canUndoEdit, canRedoEdit]);
  return (
    <div ref={root} className="editor-history-controls" role="group" aria-label="编辑历史">
      <Button size="small" icon={<ResetIcon aria-hidden="true" />} title="撤销（⌘Z / Ctrl+Z）" aria-keyshortcuts="Meta+Z Control+Z" disabled={locked || !canUndoEdit}
        onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()} onClick={undoEdit}>撤销</Button>
      <Button size="small" icon={<ResetIcon aria-hidden="true" style={{ transform: "scaleX(-1)" }} />} title="重做（⌘⇧Z / Ctrl+Shift+Z / Ctrl+Y）" aria-keyshortcuts="Meta+Shift+Z Control+Shift+Z Control+Y" disabled={locked || !canRedoEdit}
        onMouseDown={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()} onClick={redoEdit}>重做</Button>
    </div>
  );
}
