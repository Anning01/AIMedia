import { Badge } from "@/components/ui/badge";
export function PublishStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="secondary" className="publish-status" data-status={status}>
      {status}
    </Badge>
  );
}
