import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { InboxSkeleton } from "@/components/loading/dashboard-skeletons";

export default function Loading() {
  return (
    <DashboardShell activeSection="Inbox">
      <InboxSkeleton />
    </DashboardShell>
  );
}
