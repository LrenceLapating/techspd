import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ConversionsModule } from "@/components/sales/conversions-module";
import { getDashboardContext } from "@/lib/dashboard/context";
import { getConversions } from "@/lib/sales/data";

export const dynamic = "force-dynamic";

export default async function ConversionsPage() {
  const context = await getDashboardContext();

  if (!context.isConfigured) {
    redirect("/");
  }

  const { conversions, error } = await getConversions();

  return (
    <DashboardShell
      activeSection="Conversions"
      companyName={context.companyName}
      counts={context.counts}
      email={context.email}
    >
      <ConversionsModule conversions={conversions} error={error} />
    </DashboardShell>
  );
}
