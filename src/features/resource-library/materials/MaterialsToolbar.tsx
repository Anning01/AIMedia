import {
  FileTextIcon,
  GearIcon,
  LightningBoltIcon,
} from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { useMaterialsContext } from "./workspace-context";

export function MaterialsToolbar() {
  const { setImportOpen, setAiOpen, openPromptCfg, groups } =
    useMaterialsContext();
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
          <FileTextIcon aria-hidden="true" />
          导入 txt
        </Button>
        <Button size="sm" onClick={() => setAiOpen(true)}>
          <LightningBoltIcon aria-hidden="true" />
          AI 生成素材
        </Button>
        <Button variant="secondary" size="sm" onClick={openPromptCfg}>
          <GearIcon aria-hidden="true" />
          AI 提示词
        </Button>
      </div>
      <span className="text-xs text-muted-foreground">
        共 {groups.length} 个素材组
      </span>
    </div>
  );
}
