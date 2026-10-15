import { UploadIcon } from "@radix-ui/react-icons";
import { FilterChips } from "@/components/shared/filter-chips";
import { Field,FormDialog } from "@/components/shared/form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMaterialsContext } from "./workspace-context";

const SEPARATORS = [
  { value: "---", label: "--- 分隔" },
  { value: "【标题】", label: "【标题】开头" },
];

export function MaterialImportDialog() {
  const {
    importOpen,
    setImportOpen,
    confirmImport,
    importPreview,
    importSep,
    setImportSep,
    importName,
    setImportName,
    pickFile,
    importFileName,
    importText,
    setImportText,
  } = useMaterialsContext();

  return (
    <FormDialog
      open={importOpen}
      onOpenChange={(open) => setImportOpen(open)}
      title="导入 txt 素材"
      description="每篇第一行为标题，正文在下方；按分隔规则自动拆分。"
      className="sm:max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={() => setImportOpen(false)}>
            取消
          </Button>
          <Button disabled={!importPreview.length} onClick={confirmImport}>
            导入 {importPreview.length} 篇
          </Button>
        </>
      }
    >
      <Field label="分隔规则">
        <FilterChips
          value={importSep}
          options={SEPARATORS}
          onChange={(value) =>
            setImportSep(value === "【标题】" ? "【标题】" : "---")
          }
          ariaLabel="分隔规则"
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="w-[220px]"
          placeholder="素材组名称（可留空）"
          aria-label="素材组名称"
          value={importName}
          onChange={(event) => setImportName(event.target.value)}
        />
        <Button variant="secondary" onClick={pickFile}>
          <UploadIcon aria-hidden="true" />
          选择 txt 文件
        </Button>
        {importFileName && (
          <Badge variant="secondary" className="max-w-[220px] truncate font-normal">
            {importFileName}
          </Badge>
        )}
      </div>
      <Textarea
        rows={9}
        placeholder={
          "每篇第一行为标题，正文在下方；篇与篇之间用 --- 分隔\n\n示例：\n标题一\n这是第一篇文章正文……\n---\n标题二\n这是第二篇文章正文……"
        }
        aria-label="素材文本"
        value={importText}
        onChange={(event) => setImportText(event.target.value)}
      />
      {importPreview.length > 0 && (
        <div className="max-h-44 overflow-y-auto rounded-lg border border-border/70 p-2">
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            解析预览（{importPreview.length} 篇）
          </div>
          <ul className="divide-y divide-border/60">
            {importPreview.map((item, index) => (
              <li
                key={index}
                className="flex items-baseline justify-between gap-3 py-1.5 text-xs"
              >
                <span className="truncate font-medium text-foreground">
                  {item.title}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {item.content.length} 字
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </FormDialog>
  );
}
