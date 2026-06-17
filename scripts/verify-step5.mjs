import { existsSync, readFileSync } from "node:fs";

const files = {
  actions: "src/app/customers/actions.ts",
  conversionsModule: "src/components/sales/conversions-module.tsx",
  conversionsPage: "src/app/conversions/page.tsx",
  customersModule: "src/components/sales/customers-module.tsx",
  customersPage: "src/app/customers/page.tsx",
  data: "src/lib/sales/data.ts",
  migration: "supabase/migrations/20260617002000_add_customer_workflow_fields.sql",
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
const customers = read(files.customersModule);
const conversions = read(files.conversionsModule);
const data = read(files.data);
const actions = read(files.actions);
const migration = read(files.migration);
const customersPage = read(files.customersPage);
const conversionsPage = read(files.conversionsPage);
const pkg = read(files.package);

for (const requirement of [
  "Search customers",
  "Filter by platform",
  "Filter by lead stage",
  "Filter by converted",
  "Filter by month",
  "Name",
  "Platform",
  "AI Status",
  "Lead Stage",
  "Converted",
  "Last Activity",
]) {
  assert(customers.includes(requirement), `Customers page missing: ${requirement}`);
}

for (const requirement of [
  "convertedFilters",
  "leadStages",
  "platforms",
  "getCustomers",
  "normalizeCustomerFilters",
]) {
  assert(data.includes(requirement), `Customers data missing: ${requirement}`);
}

for (const requirement of [
  "converted or availed",
  "Customer",
  "Platform",
  "Conversion Date",
  "Notes",
  "groupConversionsByMonth",
  "buildPlatformStats",
  "Export CSV",
]) {
  assert(conversions.includes(requirement), `Conversions page missing: ${requirement}`);
}

assert(
  conversionsPage.includes("<ConversionsModule") && conversionsPage.includes("getConversions"),
  "Conversions route must fetch and render conversions.",
);
assert(
  customersPage.includes("<CustomersModule") && customersPage.includes("getCustomers"),
  "Customers route must fetch and render customers.",
);
assert(
  actions.includes("markCustomerConverted") &&
    actions.includes("lead_stage") &&
    actions.includes("converted_at") &&
    actions.includes("revalidatePath(\"/conversions\")"),
  "Missing Mark Converted server action.",
);

for (const requirement of [
  "customer_platform",
  "lead_stage",
  "ai_enabled",
  "converted",
  "converted_at",
  "last_activity_at",
  "create_conversion_when_customer_converted",
  "insert into public.conversions",
  "customer_marked_converted",
]) {
  assert(migration.includes(requirement), `Step 5 migration missing: ${requirement}`);
}

assert(pkg.includes("\"verify:step5\""), "Missing verify:step5 package script.");

if (failures.length > 0) {
  console.error("Step 5 verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Step 5 verification passed.");
