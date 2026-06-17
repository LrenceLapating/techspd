import { createClient } from "@/lib/supabase/server";
import { formatMonth, formatPlatform } from "@/lib/sales/data";

type ConversationAnalyticsRow = {
  channels:
    | {
        name: string | null;
        type: string | null;
      }
    | {
        name: string | null;
        type: string | null;
      }[]
    | null;
  created_at: string;
  id: string;
};

type ConversionAnalyticsRow = {
  converted_at: string | null;
  created_at: string;
  id: string;
};

type CustomerAnalyticsRow = {
  ai_enabled: boolean;
  converted: boolean;
  created_at: string;
  id: string;
  lead_stage: string;
  platform: string;
};

export type AnalyticsPoint = {
  label: string;
  value: number;
};

export type AnalyticsData = {
  aiVsHuman: AnalyticsPoint[];
  cards: {
    conversionRate: number;
    convertedCustomers: number;
    newLeads: number;
    totalConversations: number;
  };
  errors: string[];
  monthlyConversations: AnalyticsPoint[];
  monthlyConversions: AnalyticsPoint[];
  platformConversations: AnalyticsPoint[];
};

const emptyAnalytics: AnalyticsData = {
  aiVsHuman: [
    { label: "AI", value: 0 },
    { label: "Human", value: 0 },
  ],
  cards: {
    conversionRate: 0,
    convertedCustomers: 0,
    newLeads: 0,
    totalConversations: 0,
  },
  errors: [],
  monthlyConversations: [],
  monthlyConversions: [],
  platformConversations: [
    { label: "Facebook", value: 0 },
    { label: "Instagram", value: 0 },
    { label: "TikTok", value: 0 },
    { label: "Unknown", value: 0 },
  ],
};

export async function getAnalyticsData(companyId?: string): Promise<AnalyticsData> {
  if (!companyId) {
    return {
      ...emptyAnalytics,
      errors: ["Missing authenticated company context."],
    };
  }

  const supabase = await createClient();
  const errors: string[] = [];

  const [
    conversationCount,
    newLeadCount,
    convertedCustomerCount,
    totalCustomerCount,
    conversationsResult,
    conversionsResult,
    customersResult,
  ] = await Promise.all([
    safeExactCount(
      supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId),
      errors,
    ),
    safeExactCount(
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("lead_stage", "new"),
      errors,
    ),
    safeExactCount(
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("converted", true),
      errors,
    ),
    safeExactCount(
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId),
      errors,
    ),
    supabase
      .from("conversations")
      .select("id, created_at, channels(name,type)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true })
      .limit(5000),
    supabase
      .from("conversions")
      .select("id, converted_at, created_at")
      .eq("company_id", companyId)
      .eq("status", "won")
      .order("converted_at", { ascending: true, nullsFirst: false })
      .limit(5000),
    supabase
      .from("customers")
      .select("id, created_at, platform, ai_enabled, lead_stage, converted")
      .eq("company_id", companyId)
      .limit(5000),
  ]);

  if (conversationsResult.error) {
    errors.push(conversationsResult.error.message);
  }

  if (conversionsResult.error) {
    errors.push(conversionsResult.error.message);
  }

  if (customersResult.error) {
    errors.push(customersResult.error.message);
  }

  const conversations = conversationsResult.error
    ? []
    : ((conversationsResult.data ?? []) as ConversationAnalyticsRow[]);
  const conversions = conversionsResult.error
    ? []
    : ((conversionsResult.data ?? []) as ConversionAnalyticsRow[]);
  const customers = customersResult.error
    ? []
    : ((customersResult.data ?? []) as CustomerAnalyticsRow[]);

  const convertedCustomers =
    convertedCustomerCount || customers.filter((customer) => customer.converted).length;
  const customerTotal = totalCustomerCount || customers.length;
  const conversionRate =
    customerTotal > 0 ? Math.round((convertedCustomers / customerTotal) * 100) : 0;

  return {
    aiVsHuman: aiVsHumanFromCustomers(customers),
    cards: {
      conversionRate,
      convertedCustomers,
      newLeads:
        newLeadCount ||
        customers.filter((customer) => customer.lead_stage === "new").length,
      totalConversations: conversationCount || conversations.length,
    },
    errors,
    monthlyConversations: monthlyFromRows(conversations, "created_at"),
    monthlyConversions: monthlyFromRows(
      conversions.map((conversion) => ({
        ...conversion,
        monthDate: conversion.converted_at ?? conversion.created_at,
      })),
      "monthDate",
    ),
    platformConversations: platformFromConversations(conversations),
  };
}

async function safeExactCount(
  query: PromiseLike<{ count: number | null; error: { message?: string } | null }>,
  errors: string[],
) {
  const { count, error } = await query;

  if (error) {
    errors.push(error.message ?? "Analytics count query failed.");
    return 0;
  }

  return count ?? 0;
}

function monthlyFromRows<T extends object>(rows: T[], key: keyof T) {
  const groups = new Map<string, number>();

  for (const row of rows) {
    const dateValue = row[key];
    if (typeof dateValue !== "string") {
      continue;
    }

    const month = formatMonth(dateValue);
    groups.set(month, (groups.get(month) ?? 0) + 1);
  }

  return [...groups.entries()].map(([label, value]) => ({ label, value }));
}

function platformFromConversations(rows: ConversationAnalyticsRow[]) {
  const groups = new Map<string, number>([
    ["Facebook", 0],
    ["Instagram", 0],
    ["TikTok", 0],
    ["Unknown", 0],
  ]);

  for (const row of rows) {
    const channel = Array.isArray(row.channels) ? row.channels[0] : row.channels;
    const platform = platformLabel(channel?.name ?? channel?.type ?? "unknown");
    groups.set(platform, (groups.get(platform) ?? 0) + 1);
  }

  return [...groups.entries()].map(([label, value]) => ({ label, value }));
}

function aiVsHumanFromCustomers(customers: CustomerAnalyticsRow[]) {
  const ai = customers.filter((customer) => customer.ai_enabled).length;
  const human = customers.length - ai;

  return [
    { label: "AI", value: ai },
    { label: "Human", value: human },
  ];
}

function platformLabel(value: string) {
  const normalized = value.toLowerCase();

  if (normalized.includes("facebook")) {
    return "Facebook";
  }

  if (normalized.includes("instagram")) {
    return "Instagram";
  }

  if (normalized.includes("tiktok") || normalized.includes("tik tok")) {
    return "TikTok";
  }

  return formatPlatform(normalized || "unknown");
}
