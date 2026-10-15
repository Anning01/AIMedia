import { Button } from "@/components/shared/controls";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  LightningBoltIcon,
} from "@radix-ui/react-icons";
import type { CreationStep } from "./CreationStepper";
export function CreationNavigation({
  step,
  locked,
  canGenerate,
  canEdit,
  onGenerate,
  onChange,
}: {
  step: CreationStep;
  locked: boolean;
  canGenerate: boolean;
  canEdit: boolean;
  onGenerate: () => void;
  onChange: (step: CreationStep) => void;
}) {
  return (
    <div className="creation-navigation">
      {step === 0 ? (
        <>
          {canEdit && (
            <Button disabled={locked} onClick={() => onChange(1)}>
              继续编辑
              <ChevronRightIcon />
            </Button>
          )}
          <Button
            type="primary"
            disabled={!canGenerate}
            loading={locked}
            icon={<LightningBoltIcon />}
            onClick={onGenerate}
          >
            {locked ? "正在生成…" : canEdit ? "重新生成" : "生成内容"}
          </Button>
        </>
      ) : (
        <Button
          disabled={locked}
          icon={<ChevronLeftIcon />}
          onClick={() => onChange(0)}
        >
          返回素材
        </Button>
      )}
    </div>
  );
}
