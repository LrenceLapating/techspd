import { existsSync, readFileSync } from "node:fs";

const files = {
  analyticsData: "src/lib/analytics/data.ts",
  analyticsModule: "src/components/analytics/analytics-module.tsx",
  analyticsPage: "src/app/analytics/page.tsx",
  dashboardContext: "src/lib/dashboard/context.ts",
  package: "package.json",
};

const failures = [];

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

for (const [name, path] of Object.entries(files)) {
  assert(existsSync(path), `Missing ${name}: ${path}`);
}

const read = (path) => (existsSync(path) ? readFileSync(path, "utf8") : "");
const data = read(files.analyticsData);
const analyticsModule = read(files.analyticsModule);
const page = read(files.analyticsPage);
const context = read(files.dashboardContext);
const pkg = read(files.package);

for (const card of [
  "Total Conversations",
  "New Leads",
  "Converted Customers",
  "Conversion Rate",
]) {
  assert(analyticsModule.includes(card), `Missing analytics card: ${card}`);
}

for (const chart of [
  "Monthly Conversations",
  "Monthly Conversions",
  "Conversations by Platform",
  "AI vs Human",
]) {
  assert(analyticsModule.includes(chart), `Missing analytics chart: ${chart}`);
}

for (const requirement of [
  "No chart data yet",
  "Placeholder",
  "chartPlaceholders",
  "AnalyticsModule",
]) {
  assert(
    analyticsModule.includes(requirement),
    `Missing analytics UI requirement: ${requirement}`,
  );
}

for (const requirement of [
  "getAnalyticsData",
  ".from(\"conversations\")",
  ".from(\"customers\")",
  ".from(\"conversions\")",
  "monthlyFromRows",
  "platformFromConversations",
  "aiVsHumanFromCustomers",
]) {
  assert(data.includes(requirement), `Missing analytics data requirement: ${requirement}`);
}

const companyFilterCount = [...data.matchAll(/\.eq\("company_id", companyId\)/g)].length;
assert(
  companyFilterCount >= 7,
  "Analytics queries must explicitly filter every Supabase read by company_id.",
);

assert(
  context.includes("companyId") && context.includes("company_id"),
  "Dashboard context must expose authenticated companyId for analytics.",
);
assert(
  page.includes("getAnalyticsData(context.companyId)") &&
    page.includes("<AnalyticsModule analytics={analytics} />"),
  "Analytics route must fetch tenant analytics and render AnalyticsModule.",
);
assert(pkg.includes("\"verify:step6\""), "Missing verify:step6 package script.");

if (failures.length > 0) {
  console.error("Step 6 verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Step 6 verification passed.");
