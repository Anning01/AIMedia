import { Button } from "@/components/shared/controls";
import { ClockIcon } from "@radix-ui/react-icons";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArticleEditor } from "../ArticleEditor";
import { GenerationPanel } from "../GenerationPanel";
import { TemplatePanel } from "../TemplatePanel";
import { useArticleWorkspace } from "../workspace-context";
import { CreationHistoryDialog } from "./CreationHistoryDialog";
import { GenerationFeedback } from "./GenerationFeedback";
import { CreationNavigation } from "./CreationNavigation";
import { CreationStepper, type CreationStep } from "./CreationStepper";
import "./creation.css";
export function CreationWorkflow({
  incomingArticle,
}: {
  incomingArticle?: {
    title: string;
    content: string;
    images?: string[];
  } | null;
}) {
  const {
    topic,
    blocks,
    contentType,
    generating,
    renderingCover,
    saveEdit,
    editingId,
    cancelEdit,
    generate,
    generateSticker,
  } = useArticleWorkspace();
  const [step, setStep] = useState<CreationStep>(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const editorHost = useRef<HTMLDivElement>(null);
  const priorStep = useRef(step);
  const canEdit = blocks.length > 0;
  const locked = generating || renderingCover;
  const move = (page: CreationStep) => {
    if (locked) return;
    if (editingId) saveEdit();
    setStep(page);
  };
  const generateContent = async () => {
    if (locked || !topic.trim()) return;
    const success = await (contentType === "sticker"
      ? generateSticker()
      : generate());
    if (success) setStep(1);
  };
  useEffect(() => {
    if (incomingArticle) setStep(0);
  }, [incomingArticle]);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    let frame = 0;
    const measure = () => {
      if (!element.getClientRects().length) return;
      const height = `${Math.max(460, window.innerHeight - element.getBoundingClientRect().top - 20)}px`;
      if (element.style.getPropertyValue("--creation-height") !== height)
        element.style.setProperty("--creation-height", height);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    const observer = new ResizeObserver(schedule);
    if (element.parentElement) observer.observe(element.parentElement);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, []);
  useLayoutEffect(() => {
    if (editorHost.current) editorHost.current.inert = step !== 1;
    if (priorStep.current !== step) {
      root.current?.closest(".app-content")?.scrollTo({ top: 0 });
      root.current
        ?.querySelector<HTMLElement>('[aria-current="step"]')
        ?.focus({ preventScroll: true });
      priorStep.current = step;
    }
  }, [step]);
  return (
    <div className="creation-workflow" ref={root}>
      <header className="creation-workflow-top">
        <CreationStepper
          step={step}
          canEdit={canEdit}
          locked={locked}
          onChange={move}
        />
        <div className="creation-header-actions">
          <Button
            size="small"
            disabled={locked}
            icon={<ClockIcon />}
            onClick={() => setHistoryOpen(true)}
          >
            历史作品
          </Button>
          <CreationNavigation
            step={step}
            locked={locked}
            canGenerate={!!topic.trim()}
            canEdit={canEdit}
            onGenerate={() => void generateContent()}
            onChange={move}
          />
        </div>
      </header>
      <GenerationFeedback onRetry={() => void generateContent()} />
      <div className="creation-step-stage" data-step={step}>
        {step === 0 && <GenerationPanel />}
        <div
          className={
            step === 1 ? "creation-result-layout" : "creation-editor-offscreen"
          }
          ref={editorHost}
          aria-hidden={step !== 1}
        >
          {step === 1 && <TemplatePanel />}
          <div className="creation-editor-stage">
            <ArticleEditor />
          </div>
        </div>
      </div>
      <CreationHistoryDialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onLoad={() => {
          setHistoryOpen(false);
          cancelEdit();
          setStep(1);
        }}
      />
    </div>
  );
}
