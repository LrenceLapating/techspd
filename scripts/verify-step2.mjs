import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";

const migrationPath =
  "supabase/migrations/20260616112605_create_multi_tenant_auth_schema.sql";

const requiredTables = [
  "companies",
  "users",
  "channels",
  "customers",
  "conversations",
  "messages",
  "customer_notes",
  "customer_tags",
  "conversions",
];

const tenantTables = requiredTables.filter((table) => table !== "companies");

const requiredEnums = [
  "channel_type",
  "conversation_status",
  "message_sender_type",
  "conversion_status",
];

const requiredIndexes = [
  "companies_created_at_idx",
  "users_company_id_idx",
  "channels_company_id_type_idx",
  "customers_company_id_created_at_idx",
  "customers_company_id_email_idx",
  "conversations_company_id_status_idx",
  "conversations_company_id_customer_id_idx",
  "messages_company_id_conversation_id_sent_at_idx",
  "customer_notes_company_id_customer_id_idx",
  "customer_tags_company_id_customer_id_idx",
  "conversions_company_id_customer_id_idx",
  "conversions_company_id_status_idx",
];

const requiredCompositeForeignKeys = [
  {
    from: "conversations",
    key: "customer_id",
    to: "customers",
  },
  {
    from: "conversations",
    key: "channel_id",
    to: "channels",
  },
  {
    from: "conversations",
    key: "assigned_user_id",
    to: "users",
  },
  {
    from: "messages",
    key: "conversation_id",
    to: "conversations",
  },
  {
    from: "messages",
    key: "customer_id",
    to: "customers",
  },
  {
    from: "messages",
    key: "sender_user_id",
    to: "users",
  },
  {
    from: "customer_notes",
    key: "customer_id",
    to: "customers",
  },
  {
    from: "customer_notes",
    key: "author_user_id",
    to: "users",
  },
  {
    from: "customer_tags",
    key: "customer_id",
    to: "customers",
  },
  {
    from: "conversions",
    key: "customer_id",
    to: "customers",
  },
  {
    from: "conversions",
    key: "conversation_id",
    to: "conversations",
  },
];

const authPages = [
  "src/app/auth/signup/page.tsx",
  "src/app/auth/login/page.tsx",
  "src/app/auth/forgot-password/page.tsx",
  "src/app/auth/update-password/page.tsx",
  "src/app/auth/callback/route.ts",
];

const failures = [];

function fail(message) {
  failures.push(message);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function tableBlock(sql, table) {
  const match = sql.match(
    new RegExp(`create table public\\.${table}\\s*\\(([\\s\\S]*?)\\n\\);`, "i"),
  );

  return match?.[1] ?? "";
}

function policyCount(sql, table) {
  return [
    ...sql.matchAll(
      new RegExp(`create policy "[^"]+"\\s+on public\\.${table}\\b`, "gi"),
    ),
  ].length;
}

const sql = readFileSync(migrationPath, "utf8");
const authActions = readFileSync("src/app/auth/actions.ts", "utf8");

for (const table of requiredTables) {
  const block = tableBlock(sql, table);
  assert(block, `Missing table: ${table}`);
  assert(
    new RegExp(`alter table public\\.${table} enable row level security`, "i").test(
      sql,
    ),
    `Missing RLS enablement: ${table}`,
  );
  assert(policyCount(sql, table) > 0, `Missing RLS policies: ${table}`);
}

for (const table of tenantTables) {
  const block = tableBlock(sql, table);
  assert(
    /company_id\s+uuid\s+not null\s+references public\.companies\(id\)/i.test(
      block,
    ),
    `Missing required company_id isolation column: ${table}`,
  );
  assert(
    new RegExp(
      `on public\\.${table}[\\s\\S]*company_id = \\(select private\\.current_company_id\\(\\)\\)`,
      "i",
    ).test(sql),
    `Missing company_id RLS predicate: ${table}`,
  );
}

for (const table of [
  "channels",
  "customers",
  "conversations",
  "messages",
  "customer_notes",
  "customer_tags",
  "conversions",
]) {
  for (const verb of ["read", "create", "update", "delete"]) {
    assert(
      new RegExp(
        `create policy "Company members can ${verb} .*"\\s+on public\\.${table}`,
        "i",
      ).test(sql),
      `Missing ${verb} policy: ${table}`,
    );
  }
}

for (const enumName of requiredEnums) {
  assert(
    new RegExp(`create type public\\.${enumName} as enum`, "i").test(sql),
    `Missing enum: ${enumName}`,
  );
}

for (const indexName of requiredIndexes) {
  assert(
    new RegExp(`create index ${indexName} on public\\.`, "i").test(sql),
    `Missing index: ${indexName}`,
  );
}

for (const foreignKey of requiredCompositeForeignKeys) {
  const block = tableBlock(sql, foreignKey.from);
  assert(
    new RegExp(
      `foreign key \\(${foreignKey.key}, company_id\\)\\s+references public\\.${foreignKey.to}\\(id, company_id\\)`,
      "i",
    ).test(block),
    `Missing tenant-preserving foreign key: ${foreignKey.from}.${foreignKey.key} -> ${foreignKey.to}.id`,
  );
}

assert(
  /create or replace function private\.handle_new_auth_user\(\)[\s\S]*insert into public\.companies[\s\S]*insert into public\.users/i.test(
    sql,
  ),
  "Signup trigger function must create a company and user profile.",
);

assert(
  /create trigger on_auth_user_created[\s\S]*after insert on auth\.users[\s\S]*private\.handle_new_auth_user\(\)/i.test(
    sql,
  ),
  "Missing auth.users signup trigger.",
);

assert(
  /create or replace function private\.current_company_id\(\)/i.test(sql),
  "Missing private tenant helper.",
);

assert(
  /revoke all on schema private from anon, authenticated/i.test(sql),
  "Private schema must not be generally exposed.",
);

assert(
  /grant select, insert, update, delete on[\s\S]*to authenticated/i.test(sql),
  "Authenticated role must be granted table API permissions behind RLS.",
);

for (const file of authPages) {
  assert(existsSync(file), `Missing auth route: ${file}`);
}

assert(
  /safeRedirectPath/.test(readFileSync("src/app/auth/callback/route.ts", "utf8")),
  "Auth callback must sanitize next redirect path.",
);

assert(/companyName/.test(readFileSync("src/app/auth/signup/page.tsx", "utf8")), "Signup form missing company name field.");
assert(/name="email"/.test(readFileSync("src/app/auth/login/page.tsx", "utf8")), "Login form missing email field.");
assert(/name="password"/.test(readFileSync("src/app/auth/login/page.tsx", "utf8")), "Login form missing password field.");
assert(/signUp\(/.test(authActions), "Missing signup server action.");
assert(/signInWithPassword/.test(authActions), "Missing login server action.");
assert(/resetPasswordForEmail/.test(authActions), "Missing forgot password server action.");
assert(/signOut\(/.test(authActions), "Missing logout server action.");

if (failures.length > 0) {
  console.error("Step 2 verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Step 2 verification passed.");
