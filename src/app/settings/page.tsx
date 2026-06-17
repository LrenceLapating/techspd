import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SettingsModule } from "@/components/settings/settings-module";
import { getDashboardContext } from "@/lib/dashboard/context";
import { getConnectedChannels } from "@/lib/settings/channels";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const context = await getDashboardContext();

  if (!context.isConfigured) {
    redirect("/");
  }

  const channels = context.companyId
    ? await getConnectedChannels({ companyId: context.companyId })
    : [];

  return (
    <DashboardShell
      activeSection="Settings"
      companyName={context.companyName}
      counts={context.counts}
      email={context.email}
    >
      <SettingsModule
        channels={channels}
        companyName={context.companyName}
        email={context.email}
      />
    </DashboardShell>
  );
}
