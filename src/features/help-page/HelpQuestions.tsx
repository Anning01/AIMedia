import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import type { PageKey } from "@/layout/AppShell";
import { ArrowRightIcon } from "@radix-ui/react-icons";
import { HELP_QUESTIONS } from "./model";

export function HelpQuestions({
  onNavigate,
}: {
  onNavigate: (page: PageKey) => void;
}) {
  return (
    <section
      aria-label="常见问题"
      className="rounded-xl border border-border bg-card px-5 sm:px-6"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle py-4">
        <h2 className="m-0 text-sm font-semibold">常见问题</h2>
        <span className="text-xs text-muted-foreground">点击问题查看答案</span>
      </div>
      <Accordion type="single" collapsible>
        {HELP_QUESTIONS.map((item) => (
          <AccordionItem key={item.id} value={item.id}>
            <AccordionTrigger>{item.question}</AccordionTrigger>
            <AccordionContent>
              <p className="m-0">{item.answer}</p>
              {item.target && (
                <Button
                  variant="link"
                  size="sm"
                  className="mt-1 h-8 border-0 bg-transparent px-0"
                  onClick={() => onNavigate(item.target!)}
                >
                  {item.action}
                  <ArrowRightIcon aria-hidden="true" />
                </Button>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
