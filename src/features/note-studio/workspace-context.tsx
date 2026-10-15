import { createWorkspaceContext } from "@/components/shared/workspace-context";
import type { useNoteStudio } from "./useNoteStudio";
export const [NoteWorkspaceProvider, useNoteWorkspace] =
  createWorkspaceContext<ReturnType<typeof useNoteStudio>>("NoteWorkspace");
