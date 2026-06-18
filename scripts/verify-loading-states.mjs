import { existsSync, readFileSync } from "node:fs";

const checks = [
  {
    file: "src/components/ui/skeleton.tsx",
    patterns: ["animate-pulse", "bg-muted", "function Skeleton"],
  },
  {
    file: "src/components/loading/navigation-progress.tsx",
    patterns: [
      "usePathname",
      "useSearchParams",
      'role="progressbar"',
      "fixed inset-x-0 top-0",
      "transition-[width]",
      "techspd:navigation-start",
    ],
  },
  {
    file: "src/components/loading/dashboard-skeletons.tsx",
    patterns: [
      "InboxSkeleton",
      "CustomersSkeleton",
      "AnalyticsSkeleton",
      'from "@/components/ui/skeleton"',
    ],
  },
  {
    file: "src/app/loading.tsx",
    patterns: ["InboxSkeleton", "DashboardShell"],
  },
  {
    file: "src/app/customers/loading.tsx",
    patterns: ["CustomersSkeleton", "DashboardShell"],
  },
  {
    file: "src/app/analytics/loading.tsx",
    patterns: ["AnalyticsSkeleton", "DashboardShell"],
  },
  {
    file: "src/app/page.tsx",
    patterns: ["Suspense", "InboxSkeleton", "InboxContent"],
  },
  {
    file: "src/app/customers/page.tsx",
    patterns: ["Suspense", "CustomersSkeleton", "CustomersContent"],
  },
  {
    file: "src/app/analytics/page.tsx",
    patterns: ["Suspense", "AnalyticsSkeleton", "AnalyticsContent"],
  },
  {
    file: "src/components/settings/meta-connect-button.tsx",
    patterns: ["isConnecting", "LoaderCircle", "Connecting...", "disabled={isConnecting}"],
  },
  {
    file: "src/components/settings/company-profile-form.tsx",
    patterns: ["Save Profile", 'pendingText="Saving..."', "Profile saved."],
  },
  {
    file: "src/components/inbox/inbox-module.tsx",
    patterns: [
      "LoaderCircle",
      "Sending...",
      "Send Message",
      "addOptimisticMessage",
      "confirmOptimisticMessage",
      "failOptimisticMessage",
      "optimistic-${crypto.randomUUID()}",
    ],
  },
];

const failures = [];

for (const check of checks) {
  if (!existsSync(check.file)) {
    failures.push(`Missing loading-state file: ${check.file}`);
    continue;
  }

  const source = readFileSync(check.file, "utf8");

  for (const pattern of check.patterns) {
    if (!source.includes(pattern)) {
      failures.push(`${check.file} is missing: ${pattern}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Loading state verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Loading state verification passed.");
