import { createClient } from "@/lib/supabase/server";

export const platforms = ["all", "facebook", "instagram", "tiktok", "unknown"] as const;
export const leadStages = [
  "all",
  "new",
  "interested",
  "follow_up",
  "converted",
  "lost",
] as const;
export const convertedFilters = ["all", "converted", "not_converted"] as const;

export type CustomerPlatform = (typeof platforms)[number];
export type LeadStage = (typeof leadStages)[number];
export type ConvertedFilter = (typeof convertedFilters)[number];

export type CustomerRow = {
  ai_enabled: boolean;
  converted: boolean;
  converted_at: string | null;
  created_at: string;
  email: string | null;
  id: string;
  last_activity_at: string | null;
  lead_stage: Exclude<LeadStage, "all">;
  location: string | null;
  metadata: Record<string, unknown> | null;
  name: string;
  phone: string | null;
  platform: Exclude<CustomerPlatform, "all">;
  updated_at: string;
};

export type ConversionRow = {
  converted_at: string | null;
  created_at: string;
  customer_id: string;
  customers:
    | {
        name: string;
        platform: Exclude<CustomerPlatform, "all">;
      }
    | {
        name: string;
        platform: Exclude<CustomerPlatform, "all">;
      }[]
    | null;
  id: string;
  metadata: Record<string, unknown> | null;
  status: "pending" | "won" | "lost" | "refunded";
};

export type CustomerFilters = {
  converted: ConvertedFilter;
  leadStage: LeadStage;
  month: string;
  platform: CustomerPlatform;
  search: string;
};

export const sampleCustomers: CustomerRow[] = [
  {
    id: "sample-maya",
    name: "Maya Santos",
    email: "maya@northstar.dev",
    phone: "+1 (415) 555-0188",
    location: "San Francisco, CA",
    platform: "instagram",
    ai_enabled: false,
    lead_stage: "interested",
    converted: false,
    converted_at: null,
    last_activity_at: "2026-06-16T10:36:00.000Z",
    metadata: { notes: "Asked for implementation timeline." },
    created_at: "2026-06-12T09:00:00.000Z",
    updated_at: "2026-06-16T10:36:00.000Z",
  },
  {
    id: "sample-jon",
    name: "Jon Reyes",
    email: "jon@peaktools.io",
    phone: "+1 (206) 555-0142",
    location: "Seattle, WA",
    platform: "facebook",
    ai_enabled: true,
    lead_stage: "converted",
    converted: true,
    converted_at: "2026-06-10T14:25:00.000Z",
    last_activity_at: "2026-06-10T14:25:00.000Z",
    metadata: { conversion_notes: "Converted after pricing follow-up." },
    created_at: "2026-05-28T11:20:00.000Z",
    updated_at: "2026-06-10T14:25:00.000Z",
  },
  {
    id: "sample-ari",
    name: "Ari Lane",
    email: "ari@studioforge.co",
    phone: "+1 (512) 555-0194",
    location: "Austin, TX",
    platform: "tiktok",
    ai_enabled: true,
    lead_stage: "new",
    converted: false,
    converted_at: null,
    last_activity_at: "2026-06-14T18:10:00.000Z",
    metadata: { notes: "Interested in launch week automation." },
    created_at: "2026-06-14T18:10:00.000Z",
    updated_at: "2026-06-14T18:10:00.000Z",
  },
];

export function normalizeCustomerFilters(
  searchParams: Record<string, string | string[] | undefined>,
): CustomerFilters {
  const value = (key: string) => {
    const raw = searchParams[key];
    return Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  };

  const platform = value("platform");
  const leadStage = value("leadStage");
  const converted = value("converted");

  return {
    converted: convertedFilters.includes(converted as ConvertedFilter)
      ? (converted as ConvertedFilter)
      : "all",
    leadStage: leadStages.includes(leadStage as LeadStage)
      ? (leadStage as LeadStage)
      : "all",
    month: value("month"),
    platform: platforms.includes(platform as CustomerPlatform)
      ? (platform as CustomerPlatform)
      : "all",
    search: value("search").trim(),
  };
}

export async function getCustomers(filters: CustomerFilters) {
  const supabase = await createClient();

  let query = supabase
    .from("customers")
    .select(
      "id,name,email,phone,location,platform,ai_enabled,lead_stage,converted,converted_at,last_activity_at,metadata,created_at,updated_at",
    )
    .order("last_activity_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });

  if (filters.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`,
    );
  }

  if (filters.platform !== "all") {
    query = query.eq("platform", filters.platform);
  }

  if (filters.leadStage !== "all") {
    query = query.eq("lead_stage", filters.leadStage);
  }

  if (filters.converted === "converted") {
    query = query.eq("converted", true);
  }

  if (filters.converted === "not_converted") {
    query = query.eq("converted", false);
  }

  if (/^\d{4}-\d{2}$/.test(filters.month)) {
    const start = `${filters.month}-01T00:00:00.000Z`;
    const end = nextMonthIso(filters.month);
    query = query.gte("last_activity_at", start).lt("last_activity_at", end);
  }

  const { data, error } = await query;

  return {
    customers: error ? [] : ((data ?? []) as CustomerRow[]),
    error: error?.message,
  };
}

export async function getConversions() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("conversions")
    .select("id,customer_id,status,converted_at,metadata,created_at,customers(name,platform)")
    .eq("status", "won")
    .order("converted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  return {
    conversions: error ? [] : ((data ?? []) as ConversionRow[]),
    error: error?.message,
  };
}

export function formatLeadStage(stage: string) {
  return stage
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatPlatform(platform: string) {
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

export function formatDate(value: string | null) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatMonth(value: string | null) {
  if (!value) {
    return "Unscheduled";
  }

  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function nextMonthIso(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, monthNumber, 1));
  return next.toISOString();
}
