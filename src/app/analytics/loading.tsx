import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { AnalyticsSkeleton } from "@/components/loading/dashboard-skeletons";

export default function Loading() {
  return (
    <DashboardShell activeSection="Analytics">
      <AnalyticsSkeleton />
    </DashboardShell>
  );
}
