import { Row } from "@/components/shared/controls";
import { NoteComposer } from "./NoteComposer";
import { NotePreview } from "./NotePreview";

export function NoteWorkspace() {
  return (
    <Row gutter={16}>
      <NoteComposer />

      <NotePreview />
    </Row>
  );
}
