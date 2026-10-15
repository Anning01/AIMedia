import {
  MagnifyingGlassIcon,
  OpenInNewWindowIcon,
  UploadIcon,
} from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useImageLibraryContext } from "./workspace-context";

export function ImageLibraryToolbar() {
  const {
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
  } = useImageLibraryContext();

  const categoryCount = tag
    ? assets.filter((asset) => (asset.tags || []).includes(tag)).length
    : 0;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="relative">
        <MagnifyingGlassIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          className="w-[220px] pl-9"
          placeholder="搜索名称 / 标签"
          aria-label="搜索名称或标签"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") setSelected([]);
          }}
        />
      </div>
      <Button size="sm" onClick={pickImages}>
        <UploadIcon aria-hidden="true" />
        上传图片
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          void window.wangaohui?.openImageDir?.();
        }}
      >
        <OpenInNewWindowIcon aria-hidden="true" />
        打开图片目录
      </Button>
      {!selectable && (
        <>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              aria-label="全选"
              checked={
                allSelected ? true : someSelected ? "indeterminate" : false
              }
              onCheckedChange={() => toggleAll()}
            />
            全选
          </label>
          <div className="flex-1" />
          {tag && (
            <Button
              variant="destructiveOutline"
              size="sm"
              onClick={deleteCategory}
            >
              删除分类「{tag}」（{categoryCount} 张）
            </Button>
          )}
          <Button
            variant="destructiveOutline"
            size="sm"
            disabled={!selected.length}
            onClick={() => deleteImages(selected)}
          >
            删除选中（{selected.length}）
          </Button>
        </>
      )}
      {selectable && (
        <span className="ml-auto text-xs text-muted-foreground">
          已选 {selected.length}/{maxCount}
        </span>
      )}
    </div>
  );
}
