import { HelpQuestions } from "@/features/help-page/HelpQuestions";
import type { PageKey } from "@/layout/AppShell";

export default function HelpPage({
  onNavigate,
}: {
  onNavigate: (page: PageKey) => void;
}) {
  return <HelpQuestions onNavigate={onNavigate} />;
}
