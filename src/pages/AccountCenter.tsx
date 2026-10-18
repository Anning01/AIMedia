import { AccountGrid } from "@/features/account-center/AccountGrid";
import { AccountLoginDialog } from "@/features/account-center/AccountLoginDialog";
import { AccountSettingsDialog } from "@/features/account-center/AccountSettingsDialog";
import { AccountToolbar } from "@/features/account-center/AccountToolbar";
import { useAccountCenter } from "@/features/account-center/useAccountCenter";
import { AccountCenterProvider } from "@/features/account-center/workspace-context";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PageActions } from "@/layout/page-actions";
import { PlusIcon } from "@radix-ui/react-icons";

export default function AccountCenter({ active = true }: { active?: boolean }) {
  const workspace = useAccountCenter({ active });
  const { contextHolder } = workspace;
  return (
    <AccountCenterProvider value={workspace}>
      <div className="flex min-w-0 flex-col gap-4">
        {contextHolder}
        <PageActions when={active}>
          <Button size="sm" onClick={() => workspace.openAddAccount()}>
            <PlusIcon aria-hidden="true" />
            添加账号
          </Button>
        </PageActions>
        <Tabs
          value={workspace.activeTab}
          onValueChange={workspace.setActiveTab}
          className="min-w-0 gap-4"
        >
          <AccountToolbar />
          <AccountGrid />
        </Tabs>
        <AccountSettingsDialog />
        <AccountLoginDialog />
      </div>
    </AccountCenterProvider>
  );
}
