import { NoteDialog } from "@/features/note-studio/NoteDialog";
import { NoteHistoryDialog } from "@/features/note-studio/NoteHistoryDialog";
import { NoteWorkspace } from "@/features/note-studio/NoteWorkspace";
import { ProductDialog } from "@/features/note-studio/ProductDialog";
import { SaveStyleDialog } from "@/features/note-studio/SaveStyleDialog";
import { StyleLibraryDialog } from "@/features/note-studio/StyleLibraryDialog";
import { useNoteStudio } from "@/features/note-studio/useNoteStudio";
import { NoteWorkspaceProvider } from "@/features/note-studio/workspace-context";
export default function NoteStudio() {
  const workspace = useNoteStudio();
  const { contextHolder } = workspace;
  return (
    <NoteWorkspaceProvider value={workspace}>
      <div>
        <div className="mb-4">
          <h1 className="m-0 text-[22px] leading-tight font-semibold tracking-[-0.02em]">
            小红书复刻
          </h1>
          <p className="mt-1 mb-0 text-xs text-muted-foreground">
            粘贴爆款笔记链接，拆解结构，生成自己的笔记与配图
          </p>
        </div>
        {contextHolder}
        <NoteWorkspace />

        <NoteDialog />

        <ProductDialog />

        <StyleLibraryDialog />

        <SaveStyleDialog />

        <NoteHistoryDialog />
      </div>
    </NoteWorkspaceProvider>
  );
}
