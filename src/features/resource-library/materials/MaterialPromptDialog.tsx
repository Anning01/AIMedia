import { Field,FormDialog } from "@/components/shared/form-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMaterialsContext } from "./workspace-context";

export function MaterialPromptDialog() {
  const {
    promptOpen,
    setPromptOpen,
    setPromptSystem,
    setPromptUser,
    promptSystem,
    promptUser,
    resetPromptCfg,
    savePromptCfg,
  } = useMaterialsContext();

  return (
    <FormDialog
      open={promptOpen}
      onOpenChange={setPromptOpen}
      title="AI 素材生成提示词"
      description="修改后立即对后续生成生效，可随时恢复默认。"
      className="sm:max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={resetPromptCfg}>
            恢复默认
          </Button>
          <Button onClick={savePromptCfg}>保存</Button>
        </>
      }
    >
      <Field label="系统提示词（变量：无）">
        <Textarea
          rows={4}
          aria-label="系统提示词"
          value={promptSystem}
          onChange={(event) => setPromptSystem(event.target.value)}
        />
      </Field>
      <Field
        label={
          <>
            用户提示词模板（变量：{"{position}"} 账号定位、{"{count}"} 数量、
            {"{history}"} 历史大纲）
          </>
        }
      >
        <Textarea
          rows={8}
          aria-label="用户提示词模板"
          value={promptUser}
          onChange={(event) => setPromptUser(event.target.value)}
        />
      </Field>
    </FormDialog>
  );
}
