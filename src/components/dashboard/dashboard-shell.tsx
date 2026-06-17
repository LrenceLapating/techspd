import {
  BarChart3,
  Bell,
  Check,
  ChevronDown,
  CircleDollarSign,
  Camera,
  Inbox,
  LogOut,
  Megaphone,
  MessageCircle,
  Search,
  Settings,
  Sparkles,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { signOut } from "@/app/auth/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { DashboardCounts } from "@/lib/dashboard/context";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Inbox", href: "/", icon: Inbox },
  { label: "Customers", href: "/customers", icon: UsersRound },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Conversions", href: "/conversions", icon: CircleDollarSign },
  { label: "Settings", href: "/settings", icon: Settings },
];

const sectionCopy = {
  Inbox: {
    title: "Inbox",
    description:
      "Monitor messages, customers, analytics, and conversions in one workspace.",
    hero: "Your customer command center is ready.",
    body: "Connect social channels to bring every customer message into one fast, organized inbox. New company accounts start with empty data until the first integration is connected.",
  },
  Customers: {
    title: "Customers",
    description: "Customer profiles will appear as conversations begin.",
    hero: "No customers yet.",
    body: "When messages arrive, TechSpd will create customer records that stay isolated to this company workspace.",
  },
  Analytics: {
    title: "Analytics",
    description: "Track channel performance once data starts flowing.",
    hero: "No analytics yet.",
    body: "Charts and trends unlock after connected channels begin receiving customer conversations.",
  },
  Conversions: {
    title: "Conversions",
    description: "Measure revenue outcomes from customer conversations.",
    hero: "No conversions yet.",
    body: "Conversion records will appear once your team starts tracking outcomes from conversations.",
  },
  Settings: {
    title: "Settings",
    description: "Manage workspace setup, channels, and team preferences.",
    hero: "Workspace settings are ready.",
    body: "Connect channels and configure workspace preferences when you are ready to launch TechSpd.",
  },
} as const;

const emptyStates = [
  {
    title: "No conversations yet",
    description: "Messages from connected social channels will appear here.",
    icon: MessageCircle,
  },
  {
    title: "No customers yet",
    description: "Customer profiles are created once conversations begin.",
    icon: UsersRound,
  },
  {
    title: "No analytics yet",
    description: "Performance charts unlock when TechSpd receives data.",
    icon: BarChart3,
  },
];

const onboardingItems = [
  { label: "Connect Facebook", icon: Megaphone },
  { label: "Connect Instagram", icon: Camera },
  { label: "Connect TikTok", icon: Sparkles },
  { label: "Start receiving messages", icon: Inbox },
];

type DashboardShellProps = {
  activeSection?: keyof typeof sectionCopy;
  children?: ReactNode;
  companyName?: string;
  counts?: DashboardCounts;
  email?: string;
};

export function DashboardShell({
  activeSection = "Inbox",
  children,
  companyName,
  counts = {
    conversations: 0,
    customers: 0,
    messages: 0,
    conversions: 0,
  },
  email,
}: DashboardShellProps) {
  const displayCompany = companyName ?? "Your company";
  const copy = sectionCopy[activeSection];
  const initials = displayCompany
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[272px_1fr]">
        <aside className="hidden border-r bg-card px-5 py-6 lg:flex lg:flex-col">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-muted-foreground">
                TechSpd
              </p>
              <h1 className="truncate text-lg font-semibold tracking-tight">
                {displayCompany}
              </h1>
            </div>
          </div>

          <nav className="mt-8 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                aria-current={item.label === activeSection ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                  item.label === activeSection &&
                    "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto rounded-xl border bg-secondary/60 p-4">
            <p className="text-sm font-semibold">Fresh workspace</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Connect your first channel to begin collecting conversations,
              customers, analytics, and conversions.
            </p>
          </div>
        </aside>

        <section className="dashboard-grid flex min-w-0 flex-col">
          <header className="sticky top-0 z-10 border-b bg-background/88 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 lg:hidden">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <Sparkles className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-muted-foreground">
                      TechSpd
                    </p>
                    <h1 className="truncate text-base font-semibold">
                      {displayCompany}
                    </h1>
                  </div>
                </div>

                <div className="hidden min-w-0 md:block">
                  <h2 className="text-xl font-semibold tracking-tight">
                    {copy.title}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {copy.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 xl:hidden">
                  <NotificationsMenu />
                  <ProfileButton
                    companyName={displayCompany}
                    email={email}
                    initials={initials}
                  />
                </div>
              </div>

              <div className="flex min-w-0 flex-1 items-center gap-3 xl:max-w-3xl">
                <form className="relative min-w-0 flex-1" role="search">
                  <label htmlFor="global-search" className="sr-only">
                    Global search
                  </label>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="global-search"
                    name="globalSearch"
                    placeholder="Search conversations, customers, tags, or channels"
                    type="search"
                    className="rounded-xl pl-9"
                  />
                </form>

                <div className="hidden items-center gap-2 xl:flex">
                  <NotificationsMenu />
                  <ProfileButton
                    companyName={displayCompany}
                    email={email}
                    initials={initials}
                  />
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-7xl flex-col gap-6">
              <nav className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
                {navItems.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    aria-current={item.label === activeSection ? "page" : undefined}
                    className={cn(
                      "flex h-10 shrink-0 items-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium text-muted-foreground shadow-sm",
                      item.label === activeSection &&
                        "border-primary bg-primary text-primary-foreground",
                    )}
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </Link>
                ))}
              </nav>

              {children ?? (
                <>

              <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <Card className="overflow-hidden shadow-sm">
                  <CardHeader className="gap-4 pb-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">Fresh account</Badge>
                      <Badge variant="outline">{displayCompany}</Badge>
                    </div>
                    <div className="max-w-3xl space-y-3">
                      <CardTitle className="text-3xl tracking-tight sm:text-4xl">
                        {copy.hero}
                      </CardTitle>
                      <CardDescription className="text-base leading-7">
                        {copy.body}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 md:grid-cols-3">
                      {emptyStates.map((state) => (
                        <div
                          key={state.title}
                          className="rounded-xl border bg-background/72 p-4"
                        >
                          <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <state.icon className="size-5" />
                          </div>
                          <p className="font-semibold">{state.title}</p>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {state.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle>Onboarding checklist</CardTitle>
                    <CardDescription>
                      Complete these steps to start receiving messages.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {onboardingItems.map((item, index) => (
                      <div key={item.label}>
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 items-center justify-center rounded-lg border bg-card text-muted-foreground">
                            <item.icon className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold">
                              {index + 1}. {item.label}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Pending setup
                            </p>
                          </div>
                          <div className="flex size-7 items-center justify-center rounded-full border text-muted-foreground">
                            <Check className="size-3.5 opacity-0" />
                          </div>
                        </div>
                        {index < onboardingItems.length - 1 ? (
                          <Separator className="mt-4" />
                        ) : null}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </section>

              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <WorkspaceMetric
                  label="Conversations"
                  value={String(counts.conversations)}
                  description={
                    counts.conversations === 0
                      ? "No conversations yet"
                      : "Conversations received"
                  }
                  icon={Inbox}
                />
                <WorkspaceMetric
                  label="Customers"
                  value={String(counts.customers)}
                  description={
                    counts.customers === 0 ? "No customers yet" : "Customers tracked"
                  }
                  icon={UsersRound}
                />
                <WorkspaceMetric
                  label="Analytics"
                  value={counts.messages === 0 ? "--" : String(counts.messages)}
                  description={
                    counts.messages === 0 ? "No analytics yet" : "Messages analyzed"
                  }
                  icon={BarChart3}
                />
                <WorkspaceMetric
                  label="Conversions"
                  value={String(counts.conversions)}
                  description={
                    counts.conversions === 0
                      ? "No conversions yet"
                      : "Conversions tracked"
                  }
                  icon={CircleDollarSign}
                />
              </section>

              <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle>Inbox preview</CardTitle>
                    <CardDescription>
                      Customer messages will stream here once channels are
                      connected.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed bg-background/72 px-6 text-center">
                      <div className="flex size-12 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                        <Inbox className="size-6" />
                      </div>
                      <p className="mt-4 font-semibold">No conversations yet</p>
                      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                        Connect Facebook, Instagram, or TikTok to start routing
                        messages into TechSpd.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle>Company profile</CardTitle>
                    <CardDescription>
                      Workspace identity shown across the dashboard.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-4 rounded-xl border bg-background/72 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-base font-semibold text-primary-foreground">
                          {initials || "TC"}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {displayCompany}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            {email ?? "Profile email unavailable"}
                          </p>
                        </div>
                      </div>
                      <form action={signOut}>
                        <Button variant="outline" type="submit">
                          <LogOut className="size-4" />
                          Log out
                        </Button>
                      </form>
                    </div>
                  </CardContent>
                </Card>
              </section>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function NotificationsMenu() {
  return (
    <details className="group relative">
      <summary
        aria-label="Open notifications"
        className="relative flex size-10 cursor-pointer list-none items-center justify-center rounded-lg border bg-card shadow-sm transition-colors hover:bg-secondary [&::-webkit-details-marker]:hidden"
      >
        <Bell className="size-4" />
        <span className="absolute right-2 top-2 size-2 rounded-full bg-primary" />
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border bg-card p-2 shadow-lg">
        <div className="px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          <p className="text-xs text-muted-foreground">
            Updates from connected channels will appear here.
          </p>
        </div>
        <Separator className="my-2" />
        <div className="rounded-lg border border-dashed bg-background/72 px-4 py-6 text-center">
          <p className="text-sm font-semibold">No notifications yet</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Connect a channel to receive message and setup activity.
          </p>
        </div>
      </div>
    </details>
  );
}

function ProfileButton({
  companyName,
  email,
  initials,
}: {
  companyName: string;
  email?: string;
  initials: string;
}) {
  return (
    <details className="group relative">
      <summary
        aria-label="Open profile menu"
        className="flex h-10 cursor-pointer list-none items-center gap-3 rounded-lg border bg-card px-2.5 text-sm font-medium shadow-sm transition-colors hover:bg-secondary [&::-webkit-details-marker]:hidden"
      >
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
          {initials || "TC"}
        </span>
        <span className="hidden min-w-0 text-left md:block">
          <span className="block max-w-32 truncate text-sm font-semibold">
            {companyName}
          </span>
          <span className="block max-w-32 truncate text-xs font-normal text-muted-foreground">
            {email ?? "Profile"}
          </span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="absolute right-0 mt-2 w-64 rounded-xl border bg-card p-2 shadow-lg">
        <div className="px-3 py-2">
          <p className="truncate text-sm font-semibold">{companyName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {email ?? "Profile email unavailable"}
          </p>
        </div>
        <Separator className="my-2" />
        <form action={signOut}>
          <button
            className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            type="submit"
          >
            <LogOut className="size-4" />
            Log out
          </button>
        </form>
      </div>
    </details>
  );
}

function WorkspaceMetric({
  description,
  icon: Icon,
  label,
  value,
}: {
  description: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}
