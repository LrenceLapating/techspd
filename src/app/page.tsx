import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { InboxModule } from "@/components/inbox/inbox-module";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDashboardContext } from "@/lib/dashboard/context";
import { getInboxSnapshot } from "@/lib/inbox/data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const context = await getDashboardContext();

  if (!context.isConfigured) {
    return (
      <main className="dashboard-grid flex min-h-screen items-center justify-center bg-background px-4 py-10">
        <Card className="max-w-xl shadow-sm">
          <CardHeader>
            <CardTitle>Connect Supabase to continue</CardTitle>
            <CardDescription>
              Add your Supabase URL and publishable key to `.env.local` to use
              authentication and tenant-isolated data.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/auth/login">Go to login</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/auth/signup">Create account</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const inboxSnapshot = context.companyId
    ? await getInboxSnapshot({ companyId: context.companyId })
    : undefined;

  return (
    <DashboardShell
      activeSection="Inbox"
      companyName={context.companyName}
      counts={context.counts}
      email={context.email}
    >
      <InboxModule
        companyId={context.companyId ?? ""}
        initialSnapshot={inboxSnapshot}
      />
    </DashboardShell>
  );
}
