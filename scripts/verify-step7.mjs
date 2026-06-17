import { existsSync, readFileSync } from "node:fs";

const files = {
  package: "package.json",
  settingsModule: "src/components/settings/settings-module.tsx",
  settingsPage: "src/app/settings/page.tsx",
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
const settings = read(files.settingsModule);
const page = read(files.settingsPage);
const pkg = read(files.package);

for (const section of [
  "Company Profile",
  "Connected Channels",
  "Facebook",
  "Instagram",
  "TikTok",
  "AI Settings",
  "Team Members",
  "Notifications",
  "Webhook Settings",
  "API Keys",
]) {
  assert(settings.includes(section), `Missing settings section: ${section}`);
}

for (const channelRequirement of [
  "Connect Facebook",
  "Connect Instagram",
  "Connect TikTok",
  "Connected",
  "Not Connected",
  "Channel name",
  "Channel ID",
]) {
  assert(
    settings.includes(channelRequirement),
    `Missing connected channel UI requirement: ${channelRequirement}`,
  );
}

assert(
  settings.includes("OAuth is not") ||
    settings.includes("OAuth pending") ||
    settings.includes("Meta OAuth ready"),
  "Settings page must clearly describe channel OAuth status.",
);
assert(
  !settings.includes("signInWithOAuth") &&
    !settings.includes("exchangeCodeForSession"),
  "Settings must not use Supabase auth OAuth for channel connection.",
);
assert(
  page.includes("<SettingsModule") && page.includes("activeSection=\"Settings\""),
  "Settings route must render SettingsModule inside DashboardShell.",
);
assert(pkg.includes("\"verify:step7\""), "Missing verify:step7 package script.");

if (failures.length > 0) {
  console.error("Step 7 verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Step 7 verification passed.");
