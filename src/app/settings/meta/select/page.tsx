import Link from "next/link";
import { redirect } from "next/navigation";
import { Camera, CheckCircle2, Megaphone } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDashboardContext } from "@/lib/dashboard/context";
import { getMetaOAuthSession } from "@/lib/meta/integration";

export const dynamic = "force-dynamic";

export default async function MetaSelectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await getDashboardContext();

  if (!context.isConfigured || !context.companyId) {
    redirect("/");
  }

  const params = await searchParams;
  const sessionId = Array.isArray(params.session)
    ? params.session[0]
    : params.session;
  const session = sessionId
    ? await getMetaOAuthSession({
        companyId: context.companyId,
        sessionId,
      })
    : null;

  return (
    <DashboardShell
      activeSection="Settings"
      companyName={context.companyName}
      counts={context.counts}
      email={context.email}
    >
      <section className="mx-auto max-w-4xl space-y-5">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              {session?.provider === "instagram" ? (
                <Camera className="size-5 text-primary" />
              ) : (
                <Megaphone className="size-5 text-primary" />
              )}
              Select Meta Page
            </CardTitle>
            <CardDescription>
              Choose the Facebook Page to connect to TechSpd. Instagram
              connections require a linked Instagram Professional Account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!session ? (
              <div className="rounded-xl border border-dashed bg-background/72 p-5">
                <h3 className="font-semibold">Session expired</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Start the Meta connection again from Settings to fetch a fresh
                  list of pages.
                </p>
                <Button asChild className="mt-4" variant="outline">
                  <Link href="/settings">Back to settings</Link>
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {session.pages.map((page) => (
                  <form
                    action="/api/meta/pages/select"
                    className="rounded-xl border bg-background/72 p-4"
                    key={page.id}
                    method="post"
                  >
                    <input name="session_id" type="hidden" value={session.id} />
                    <input name="page_id" type="hidden" value={page.id} />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{page.name}</h3>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                          {page.id}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {session.provider === "instagram"
                          ? "Instagram"
                          : "Facebook"}
                      </Badge>
                    </div>

                    {page.instagramBusinessAccount ? (
                      <div className="mt-4 rounded-lg bg-[#fdf2f8] p-3 text-sm text-[#be185d]">
                        <div className="flex items-center gap-2 font-medium">
                          <CheckCircle2 className="size-4" />
                          Instagram Professional Account
                        </div>
                        <p className="mt-1">
                          @{page.instagramBusinessAccount.username ?? "unknown"}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-4 rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
                        No linked Instagram Professional Account found.
                      </p>
                    )}

                    <Button className="mt-5 w-full" type="submit">
                      Connect this page
                    </Button>
                  </form>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </DashboardShell>
  );
}
