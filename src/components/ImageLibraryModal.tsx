import { Button,Modal,Space } from "@/components/shared/controls";
import { useEffect,useState } from "react";
import { listAssets } from "../data/localStore";
import LibraryPanel from "./LibraryPanel";

export interface LibraryImage {
  id: string;
  name: string;
  dataUrl: string;
  tags?: string[];
}

interface Props {
  open: boolean;
  maxCount: number;
  initialSelected?: string[];
  onClose: () => void;
  onConfirm: (images: LibraryImage[]) => void;
}

export default function ImageLibraryModal({
  open,
  maxCount,
  initialSelected,
  onClose,
  onConfirm,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    initialSelected || [],
  );
  const [openTick, setOpenTick] = useState(0);

  useEffect(() => {
    if (open) {
      setSelectedIds(initialSelected || []);
      setOpenTick((t) => t + 1);
    }
  }, [open, initialSelected]);

  const confirm = () => {
    const images = listAssets()
      .filter((a) => selectedIds.includes(a.id))
      .map((a) => ({
        id: a.id,
        name: a.name,
        dataUrl: a.dataUrl || "",
        tags: a.tags,
      }));
    onConfirm(images);
  };

  return (
    <Modal
      title={`我的图库（已选 ${selectedIds.length}/${maxCount}）`}
      open={open}
      width={980}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button
            type="primary"
            disabled={!selectedIds.length}
            onClick={confirm}
          >
            确定使用（{selectedIds.length} 张）
          </Button>
        </Space>
      }
    >
      <LibraryPanel
        selectable
        maxCount={maxCount}
        selectedIds={selectedIds}
        onSelectedChange={setSelectedIds}
        refreshKey={openTick}
      />
    </Modal>
  );
}
