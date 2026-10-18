import { Modal, message } from "@/components/shared/controls";
import type { AssetItem } from "@/data/localStore";
import {
  listAssets,
  nowIso,
  removeAssets,
  saveAsset,
  uid,
  updateAsset,
} from "@/data/localStore";
import { EMPTY_SELECTION } from "@/features/resource-library/image-library/model";
import { saveImage } from "@/utils/imageStore";
import { useEffect, useMemo, useState } from "react";
import { Props } from "./model";
export function useImageLibrary({
  selectable = false,
  maxCount = 9,
  selectedIds = EMPTY_SELECTION,
  onSelectedChange,
  refreshKey = 0,
}: Props) {
  const messageApi = message;
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [selected, setSelected] = useState<string[]>(selectedIds);
  const [uploadPending, setUploadPending] = useState<Array<{
    name: string;
    dataUrl: string;
  }> | null>(null);
  const [uploadTags, setUploadTags] = useState("");
  const [tagTarget, setTagTarget] = useState<AssetItem | null>(null);
  const [tagText, setTagText] = useState("");

  const refresh = () => {
    const next = listAssets();
    setAssets(next);
    setSelected((previous) =>
      (selectable ? selectedIds : previous).filter((id) =>
        next.some((asset) => asset.id === id),
      ),
    );
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  useEffect(() => {
    if (selectable) setSelected(selectedIds);
  }, [selectedIds, selectable]);

  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const a of assets) {
      for (const t of a.tags || []) set.add(t);
    }
    return Array.from(set);
  }, [assets]);

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    return assets.filter((a) => {
      const at = a.tags || [];
      if (tag && !at.includes(tag)) return false;
      if (!k) return true;
      return (
        a.name.toLowerCase().includes(k) ||
        at.some((t) => t.toLowerCase().includes(k))
      );
    });
  }, [assets, q, tag]);

  const toggle = (id: string) => {
    if (!selectable) {
      setSelected((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      );
      return;
    }
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : selected.length >= maxCount
        ? (messageApi.warning(`最多选择 ${maxCount} 张图片`), selected)
        : [...selected, id];
    setSelected(next);
    onSelectedChange?.(next);
  };

  const allSelected =
    filtered.length > 0 && filtered.every((a) => selected.includes(a.id));
  const someSelected = filtered.some((a) => selected.includes(a.id));

  const toggleAll = () => {
    setSelected(allSelected ? [] : filtered.map((a) => a.id));
  };

  const pickImages = async () => {
    if (window.wangaohui?.selectImages) {
      const r = await window.wangaohui.selectImages({ max: 9 });
      if (r.ok && r.images?.length) {
        setUploadPending(r.images);
        setUploadTags("");
      } else if (!r.canceled) {
        messageApi.error(r.error || "选择图片失败");
      }
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = () => {
      const files = Array.from(input.files || []).slice(0, 9);
      if (!files.length) return;
      const readers = files.map(
        (file) =>
          new Promise<{ name: string; dataUrl: string }>((resolve) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({ name: file.name, dataUrl: String(reader.result) });
            reader.readAsDataURL(file);
          }),
      );
      Promise.all(readers).then((imgs) => {
        setUploadPending(imgs);
        setUploadTags("");
      });
    };
    input.click();
  };

  const confirmUpload = async () => {
    if (!uploadPending) return;
    const tags = uploadTags
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (!tags.length) {
      messageApi.warning("请填写至少一个标签");
      return;
    }
    for (const img of uploadPending) {
      let src = img.dataUrl;
      try {
        src = await saveImage(img.dataUrl, "library");
      } catch {
        /* 落盘失败时保留原图，避免上传丢失 */
      }
      saveAsset({
        id: uid("asset"),
        kind: "图片",
        name: img.name,
        dataUrl: src,
        tags,
        createdAt: nowIso(),
      });
    }
    setUploadPending(null);
    setUploadTags("");
    refresh();
    messageApi.success(`已上传 ${uploadPending.length} 张图片`);
  };

  const openTags = (a: AssetItem) => {
    setTagTarget(a);
    setTagText((a.tags || []).join("，"));
  };

  const saveTags = () => {
    if (!tagTarget) return;
    updateAsset(tagTarget.id, {
      tags: tagText
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setTagTarget(null);
    refresh();
    messageApi.success("标签已保存");
  };

  const deleteImages = (ids: string[]) => {
    if (!ids.length) return;
    Modal.confirm({
      title: `删除 ${ids.length} 张图片？`,
      content: "删除后不可恢复。",
      okText: "删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: () => {
        removeAssets(ids);
        setSelected((prev) => prev.filter((x) => !ids.includes(x)));
        onSelectedChange?.(selected.filter((x) => !ids.includes(x)));
        refresh();
        messageApi.success(`已删除 ${ids.length} 张图片`);
      },
    });
  };

  const deleteCategory = () => {
    if (!tag) return;
    const ids = assets
      .filter((a) => (a.tags || []).includes(tag))
      .map((a) => a.id);
    if (!ids.length) return;
    Modal.confirm({
      title: `删除分类「${tag}」全部 ${ids.length} 张图片？`,
      content: "该分类下的图片会全部删除，且不可恢复。",
      okText: "删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: () => {
        removeAssets(ids);
        refresh();
        messageApi.success(`已删除分类「${tag}」的 ${ids.length} 张图片`);
      },
    });
  };

  return {
    q,
    setQ,
    setSelected,
    pickImages,
    selectable,
    allSelected,
    someSelected,
    toggleAll,
    tag,
    deleteCategory,
    assets,
    selected,
    deleteImages,
    maxCount,
    setTag,
    tags,
    filtered,
    toggle,
    openTags,
    uploadPending,
    setUploadPending,
    confirmUpload,
    uploadTags,
    setUploadTags,
    tagTarget,
    setTagTarget,
    saveTags,
    tagText,
    setTagText,
  };
}
