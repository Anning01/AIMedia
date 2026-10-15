import { MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useResourceLibraryContext } from "./workspace-context";

const ALL_TAGS = "__all__";

export function RemoteImageFilters() {
  const { imgTag, imageTags, setImgTag, imgQ, setImgQ, imgTotal, loadImages } =
    useResourceLibraryContext();

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <Select
        value={imgTag || ALL_TAGS}
        onValueChange={(value) => {
          const next = value === ALL_TAGS ? "" : value;
          setImgTag(next);
          void loadImages(1, next, imgQ);
        }}
      >
        <SelectTrigger className="w-[200px]" aria-label="按标签筛选">
          <SelectValue placeholder="按标签筛选" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_TAGS}>全部标签</SelectItem>
          {imageTags.map((tag) => (
            <SelectItem key={tag.tag} value={tag.tag}>
              {tag.tag}（{tag.count}）
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="relative">
        <MagnifyingGlassIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          className="w-[220px] pl-9"
          placeholder="搜索标签"
          aria-label="搜索标签"
          value={imgQ}
          onChange={(event) => setImgQ(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void loadImages(1, imgTag, imgQ);
          }}
        />
      </div>
      <span className="text-xs text-muted-foreground">
        仅展示已打标签 · 共 {imgTotal} 张
      </span>
    </div>
  );
}
