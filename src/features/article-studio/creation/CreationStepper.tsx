export const CREATION_STEPS = [
  { title: "素材与生成" },
  { title: "样式与编辑" },
] as const;
export type CreationStep = 0 | 1;
export function CreationStepper({
  step,
  canEdit,
  locked,
  onChange,
}: {
  step: CreationStep;
  canEdit: boolean;
  locked: boolean;
  onChange: (step: CreationStep) => void;
}) {
  return (
    <nav className="creation-stepper" aria-label="创作页面">
      {CREATION_STEPS.map((item, index) => (
        <button
          type="button"
          key={item.title}
          className="creation-step-button"
          aria-current={step === index ? "step" : undefined}
          disabled={locked || (index === 1 && !canEdit)}
          onClick={() => onChange(index as CreationStep)}
        >
          <span>{index + 1}</span>
          {item.title}
        </button>
      ))}
    </nav>
  );
}
