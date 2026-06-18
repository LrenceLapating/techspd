import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { CustomersSkeleton } from "@/components/loading/dashboard-skeletons";

export default function Loading() {
  return (
    <DashboardShell activeSection="Customers">
      <CustomersSkeleton />
    </DashboardShell>
  );
}
