import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { useResourceLibraryContext } from "./workspace-context";

export function ResourceErrorBanner() {
  const { baseError } = useResourceLibraryContext();
  if (!baseError) return null;
  return (
    <Alert variant="warning">
      <ExclamationTriangleIcon />
      <AlertTitle>资源库连接异常</AlertTitle>
      <AlertDescription>{baseError}</AlertDescription>
    </Alert>
  );
}
