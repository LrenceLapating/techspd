import {
  Bell,
  Bot,
  Camera,
  CheckCircle2,
  Code2,
  KeyRound,
  LockKeyhole,
  Megaphone,
  Plug,
  Settings2,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import type { ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CompanyProfileForm } from "@/components/settings/company-profile-form";
import { MetaConnectButton } from "@/components/settings/meta-connect-button";
import { WebhookSubscribeButton } from "@/components/settings/webhook-subscribe-button";
import { Separator } from "@/components/ui/separator";
import type { ConnectedChannel } from "@/lib/settings/channels";
import { cn } from "@/lib/utils";

type SettingsModuleProps = {
  channels: ConnectedChannel[];
  companyName?: string;
  email?: string;
};

const channelTemplates = [
  {
    button: "Connect Facebook",
    channelId: "fb_not_connected",
    href: "/api/meta/connect/facebook",
    icon: Megaphone,
    name: "Facebook",
    status: "Not Connected",
  },
  {
    button: "Connect Instagram",
    channelId: "ig_not_connected",
    href: "/api/meta/connect/instagram",
    icon: Camera,
    name: "Instagram",
    status: "Not Connected",
  },
  {
    button: "Connect TikTok",
    channelId: "tt_not_connected",
    href: null,
    icon: Sparkles,
    name: "TikTok",
    status: "Not Connected",
  },
] as const;

const secondarySections = [
  {
    description: "Default AI behavior, fallback mode, and confidence limits.",
    icon: Bot,
    title: "AI Settings",
  },
  {
    description: "Invite managers, owners, and support team members.",
    icon: UsersRound,
    title: "Team Members",
  },
  {
    description: "Choose alerts for messages, conversions, and channel status.",
    icon: Bell,
    title: "Notifications",
  },
  {
    description: "Configure outbound webhook URLs and signing secrets.",
    icon: Code2,
    title: "Webhook Settings",
  },
  {
    description: "Create and rotate API keys for future integrations.",
    icon: KeyRound,
    title: "API Keys",
  },
] as const;

export function SettingsModule({
  channels,
  companyName,
  email,
}: SettingsModuleProps) {
  const displayCompany = companyName ?? "Your company";
  const renderedChannels = channelTemplates.map((channel) => {
    const connected = channels.find(
      (item) => item.platform === platformForName(channel.name),
    );

    return {
      ...channel,
      channelId: connected?.channelId ?? channel.channelId,
      connectedAt: connected?.connectedAt ?? null,
      name: connected?.channelName ?? channel.name,
      platformName: channel.name,
      status: connected?.isConnected ? "Connected" : "Not Connected",
      webhookSubscribed: connected?.webhookSubscribed ?? false,
      webhookSubscribedAt: connected?.webhookSubscribedAt ?? null,
    };
  });

  return (
    <section className="space-y-5">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Settings2 className="size-5 text-primary" />
            Company Profile
          </CardTitle>
          <CardDescription>
            Workspace identity and contact details for this TechSpd company.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CompanyProfileForm
            companyName={displayCompany}
            email={email ?? ""}
          />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Plug className="size-5 text-primary" />
                Connected Channels
              </CardTitle>
              <CardDescription>
                Connect Facebook Pages and linked Instagram Professional
                Accounts through Meta OAuth.
              </CardDescription>
            </div>
            <Badge variant="success">Meta OAuth ready</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 xl:grid-cols-3">
            {renderedChannels.map((channel) => (
              <ChannelCard key={channel.platformName} {...channel} />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {secondarySections.map((section) => (
          <SettingsSection key={section.title} {...section} />
        ))}
      </div>
    </section>
  );
}

function ChannelCard({
  button,
  channelId,
  connectedAt,
  href,
  icon: Icon,
  name,
  platformName,
  status,
  webhookSubscribed,
  webhookSubscribedAt,
}: {
  button: string;
  channelId: string;
  connectedAt: string | null;
  href: string | null;
  icon: ComponentType<{ className?: string }>;
  name: string;
  platformName: string;
  status: string;
  webhookSubscribed: boolean;
  webhookSubscribedAt: string | null;
}) {
  const connected = status === "Connected";

  return (
    <div className="rounded-xl border bg-background/72 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
          <div>
            <h3 className="font-semibold">{platformName}</h3>
            <p className="text-sm text-muted-foreground">{name} channel</p>
          </div>
        </div>
        <Badge variant={connected ? "success" : "secondary"}>{status}</Badge>
      </div>

      <Separator className="my-4" />

      <dl className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Channel name</dt>
          <dd className="font-medium">{name}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Channel ID</dt>
          <dd className="font-mono text-xs">{channelId}</dd>
        </div>
        {connectedAt ? (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Connected</dt>
            <dd className="text-xs font-medium">{formatConnectedAt(connectedAt)}</dd>
          </div>
        ) : null}
        {platformName === "Facebook" ? (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Webhook</dt>
            <dd className="text-xs font-medium">
              {webhookSubscribed
                ? `Subscribed${webhookSubscribedAt ? ` ${formatConnectedAt(webhookSubscribedAt)}` : ""}`
                : "Not subscribed"}
            </dd>
          </div>
        ) : null}
      </dl>

      {isMetaConnectHref(href) ? (
        <MetaConnectButton href={href} label={button} />
      ) : (
        <Button className="mt-5 w-full" type="button" variant="outline">
          <Plug className="size-4" />
          {button}
        </Button>
      )}

      {platformName === "Facebook" ? (
        <WebhookSubscribeButton
          disabled={!connected}
          isSubscribed={webhookSubscribed}
        />
      ) : null}
    </div>
  );
}

function isMetaConnectHref(
  href: string | null,
): href is "/api/meta/connect/facebook" | "/api/meta/connect/instagram" {
  return (
    href === "/api/meta/connect/facebook" ||
    href === "/api/meta/connect/instagram"
  );
}

function formatConnectedAt(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function platformForName(name: string): ConnectedChannel["platform"] {
  if (name === "Facebook") {
    return "facebook";
  }

  if (name === "Instagram") {
    return "instagram";
  }

  return "tiktok";
}

function SettingsSection({
  description,
  icon: Icon,
  title,
}: {
  description: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex items-start gap-4 p-5">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary",
            title === "API Keys" && "bg-[#fff7ed] text-[#9a3412]",
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{title}</h3>
            {title === "API Keys" ? (
              <Badge variant="warning">
                <LockKeyhole className="mr-1 size-3" />
                Secure
              </Badge>
            ) : null}
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="size-4" />
            <span>Configuration UI placeholder</span>
            <CheckCircle2 className="size-4 opacity-0" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
