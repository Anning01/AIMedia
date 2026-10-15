import { ReloadIcon } from "@radix-ui/react-icons";
import { Field,FormDialog } from "@/components/shared/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMaterialsContext } from "./workspace-context";

export function MaterialGenerateDialog() {
  const {
    aiOpen,
    setAiOpen,
    generateAi,
    aiLoading,
    aiTarget,
    setAiTarget,
    groups,
    aiName,
    setAiName,
    aiCount,
    setAiCount,
    aiPosition,
    setAiPosition,
  } = useMaterialsContext();

  return (
    <FormDialog
      open={aiOpen}
      onOpenChange={setAiOpen}
      title="AI 生成素材"
      description="按账号定位批量生成标题 + 大纲，生成后可逐条编辑。"
      className="sm:max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={() => setAiOpen(false)}>
            取消
          </Button>
          <Button disabled={aiLoading} onClick={() => void generateAi()}>
            {aiLoading && <ReloadIcon className="animate-spin" aria-hidden="true" />}
            生成素材
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-end gap-2">
        <Field label="生成位置" className="min-w-[220px] flex-1">
          <Select value={aiTarget} onValueChange={setAiTarget}>
            <SelectTrigger className="w-full" aria-label="生成位置">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">生成到新素材组</SelectItem>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  追加到「{group.name}」
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="生成篇数">
          <Input
            type="number"
            min={1}
            max={60}
            className="w-[110px]"
            aria-label="生成篇数"
            value={aiCount}
            onChange={(event) =>
              setAiCount(Number(event.target.value) || 30)
            }
          />
        </Field>
      </div>
      {aiTarget === "new" && (
        <Field label="素材组名称">
          <Input
            placeholder="素材组名称（可留空）"
            aria-label="素材组名称"
            value={aiName}
            onChange={(event) => setAiName(event.target.value)}
          />
        </Field>
      )}
      <Field
        label="账号定位 / 主题"
        hint="留空时使用默认「万稿汇」工具推广定位。"
      >
        <Textarea
          rows={4}
          placeholder="例：星座情感账号，面向 20-35 岁女性，风格温暖治愈，结合每日运势和情感建议"
          aria-label="账号定位"
          value={aiPosition}
          onChange={(event) => setAiPosition(event.target.value)}
        />
      </Field>
      {aiTarget !== "new" && (
        <p className="text-xs text-muted-foreground">
          会携带该素材组最近 30 篇大纲给大模型，保持人设连续并避免重复。
        </p>
      )}
    </FormDialog>
  );
}
