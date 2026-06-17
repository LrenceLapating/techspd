import { redirect } from "next/navigation";
import { AnalyticsModule } from "@/components/analytics/analytics-module";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getAnalyticsData } from "@/lib/analytics/data";
import { getDashboardContext } from "@/lib/dashboard/context";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const context = await getDashboardContext();

  if (!context.isConfigured) {
    redirect("/");
  }

  const analytics = await getAnalyticsData(context.companyId);

  return (
    <DashboardShell
      activeSection="Analytics"
      companyName={context.companyName}
      counts={context.counts}
      email={context.email}
    >
      <AnalyticsModule analytics={analytics} />
    </DashboardShell>
  );
}
