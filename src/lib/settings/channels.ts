import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type ConnectedChannel = {
  channelId: string;
  channelName: string;
  connectedAt: string | null;
  isConnected: boolean;
  platform: "facebook" | "instagram" | "tiktok";
};

type ChannelRow = {
  channel_id: string | null;
  channel_name: string | null;
  connected_at: string | null;
  external_id: string | null;
  is_connected: boolean | null;
  name: string;
  platform: string | null;
};

export async function getConnectedChannels({
  companyId,
  supabaseClient,
}: {
  companyId: string;
  supabaseClient?: SupabaseClient;
}) {
  const supabase = supabaseClient ?? (await createClient());
  const { data, error } = await supabase
    .from("channels")
    .select(
      "platform,channel_id,channel_name,external_id,name,connected_at,is_connected",
    )
    .eq("company_id", companyId)
    .in("platform", ["facebook", "instagram", "tiktok"])
    .order("connected_at", { ascending: false, nullsFirst: false });

  if (error) {
    return [];
  }

  return ((data ?? []) as ChannelRow[])
    .filter((channel) => isKnownPlatform(channel.platform))
    .map((channel) => ({
      channelId: channel.channel_id ?? channel.external_id ?? "not_connected",
      channelName: channel.channel_name ?? channel.name,
      connectedAt: channel.connected_at,
      isConnected: channel.is_connected ?? false,
      platform: channel.platform as ConnectedChannel["platform"],
    }));
}

function isKnownPlatform(value: string | null): value is ConnectedChannel["platform"] {
  return value === "facebook" || value === "instagram" || value === "tiktok";
}
