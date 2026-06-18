import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AnalyticsModule } from "@/components/analytics/analytics-module";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { AnalyticsSkeleton } from "@/components/loading/dashboard-skeletons";
import { getAnalyticsData } from "@/lib/analytics/data";
import { getDashboardContext } from "@/lib/dashboard/context";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const context = await getDashboardContext();

  if (!context.isConfigured) {
    redirect("/");
  }

  return (
    <DashboardShell
      activeSection="Analytics"
      companyName={context.companyName}
      counts={context.counts}
      email={context.email}
    >
      <Suspense fallback={<AnalyticsSkeleton />}>
        <AnalyticsContent companyId={context.companyId} />
      </Suspense>
    </DashboardShell>
  );
}

async function AnalyticsContent({ companyId }: { companyId?: string }) {
  const analytics = await getAnalyticsData(companyId);

  return <AnalyticsModule analytics={analytics} />;
}
