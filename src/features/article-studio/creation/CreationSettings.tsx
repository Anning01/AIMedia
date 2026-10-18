import { Button,InputNumber,Select } from "@/components/shared/controls";
import { GearIcon } from "@radix-ui/react-icons";
import { useArticleWorkspace } from "../workspace-context";
export function CreationSettings() {
  const {
    contentType,
    stickerWords,
    setStickerWords,
    customWords,
    words,
    setCustomWords,
    setWords,
    promptSetId,
    usePromptSet,
    promptSets,
    openPromptMgr,
  } = useArticleWorkspace();
  return (
    <div className="creation-settings-grid">
      <div className="creation-field">
        <label htmlFor="creation-words">内容长度</label>
        <div className="creation-field-row">
          {contentType === "sticker" ? (
            <Select
              id="creation-words"
              value={stickerWords}
              onChange={setStickerWords}
              options={[
                "200 字以内",
                "300 字以内",
                "400 字以内",
                "500 字以内",
                "800 字以内",
                "1000 字以内",
              ].map((value) => ({ value, label: value }))}
            />
          ) : (
            <>
              <Select
                id="creation-words"
                value={customWords ? "custom" : words}
                onChange={(value: string) => {
                  setCustomWords(value === "custom");
                  setWords(value === "custom" ? "800 字" : value);
                }}
                options={[
                  ...["600 字", "800 字", "1200 字"].map((value) => ({
                    value,
                    label: value,
                  })),
                  { value: "custom", label: "自定义" },
                ]}
              />
              {customWords && (
                <InputNumber
                  aria-label="自定义字数"
                  min={300}
                  max={1500}
                  step={100}
                  value={parseInt(words, 10) || 800}
                  onChange={(value) => setWords(`${value || 800} 字`)}
                  addonAfter="字"
                />
              )}
            </>
          )}
        </div>
      </div>
      <div className="creation-field">
        <label htmlFor="creation-prompt">提示词套件</label>
        <div className="creation-field-row">
          <Select
            id="creation-prompt"
            value={promptSetId}
            onChange={usePromptSet}
            options={promptSets.map((item) => ({
              value: item.id,
              label: item.name,
            }))}
          />
          <Button
            aria-label="提示词管理"
            icon={<GearIcon />}
            onClick={openPromptMgr}
          />
        </div>
      </div>
    </div>
  );
}
