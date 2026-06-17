import { existsSync, readFileSync } from "node:fs";

const dashboard = readFileSync(
  "src/components/dashboard/dashboard-shell.tsx",
  "utf8",
);
const dashboardContext = readFileSync("src/lib/dashboard/context.ts", "utf8");

const routeFiles = [
  "src/app/customers/page.tsx",
  "src/app/analytics/page.tsx",
  "src/app/conversions/page.tsx",
  "src/app/settings/page.tsx",
];

const failures = [];

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

for (const item of [
  "Inbox",
  "Customers",
  "Analytics",
  "Conversions",
  "Settings",
]) {
  assert(dashboard.includes(`label: "${item}"`), `Missing sidebar item: ${item}`);
}

for (const href of ["/", "/customers", "/analytics", "/conversions", "/settings"]) {
  assert(dashboard.includes(`href: "${href}"`), `Missing sidebar href: ${href}`);
}

for (const routeFile of routeFiles) {
  assert(existsSync(routeFile), `Missing dashboard route: ${routeFile}`);
}

for (const section of ["Inbox", "Customers", "Analytics", "Conversions", "Settings"]) {
  assert(
    dashboard.includes(`activeSection = "Inbox"`) ||
      dashboard.includes(`activeSection?: keyof typeof sectionCopy`),
    "Dashboard shell must support active section state.",
  );
  assert(dashboard.includes(`${section}: {`), `Missing section copy: ${section}`);
}

for (const item of [
  "Search conversations, customers, tags, or channels",
  "name=\"globalSearch\"",
  "role=\"search\"",
  "Notifications",
  "NotificationsMenu",
  "Open notifications",
  "No notifications yet",
  "ProfileButton",
  "companyName",
  "aria-current",
  "Open profile menu",
]) {
  assert(dashboard.includes(item), `Missing top bar element: ${item}`);
}

for (const state of [
  "No conversations yet",
  "No customers yet",
  "No analytics yet",
]) {
  assert(dashboard.includes(state), `Missing empty state: ${state}`);
}

for (const table of ["conversations", "customers", "messages", "conversions"]) {
  assert(
    dashboardContext.includes(`.from("${table}")`),
    `Missing tenant-scoped count query: ${table}`,
  );
}

assert(
  dashboard.includes("counts.conversations") &&
    dashboard.includes("counts.customers") &&
    dashboard.includes("counts.messages") &&
    dashboard.includes("counts.conversions"),
  "Dashboard shell must render tenant-scoped counts.",
);

for (const step of [
  "Connect Facebook",
  "Connect Instagram",
  "Connect TikTok",
  "Start receiving messages",
]) {
  assert(dashboard.includes(step), `Missing onboarding step: ${step}`);
}

assert(
  dashboard.includes("lg:grid-cols-[272px_1fr]") &&
    dashboard.includes("lg:hidden") &&
    dashboard.includes("xl:flex-row"),
  "Dashboard must include responsive desktop and mobile layout classes.",
);

if (failures.length > 0) {
  console.error("Step 3 verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Step 3 verification passed.");
