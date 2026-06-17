import {
  BarChart3,
  Bot,
  MessageCircle,
  Sparkles,
  Target,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import type { ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AnalyticsData, AnalyticsPoint } from "@/lib/analytics/data";
import { cn } from "@/lib/utils";

type AnalyticsModuleProps = {
  analytics: AnalyticsData;
};

const chartPlaceholders: Record<string, AnalyticsPoint[]> = {
  "Monthly Conversations": [
    { label: "Jan", value: 0 },
    { label: "Feb", value: 0 },
    { label: "Mar", value: 0 },
    { label: "Apr", value: 0 },
  ],
  "Monthly Conversions": [
    { label: "Jan", value: 0 },
    { label: "Feb", value: 0 },
    { label: "Mar", value: 0 },
    { label: "Apr", value: 0 },
  ],
};

export function AnalyticsModule({ analytics }: AnalyticsModuleProps) {
  const cards = [
    {
      description: "All tenant conversations",
      icon: MessageCircle,
      label: "Total Conversations",
      value: analytics.cards.totalConversations,
    },
    {
      description: "Customers in New lead stage",
      icon: UsersRound,
      label: "New Leads",
      value: analytics.cards.newLeads,
    },
    {
      description: "Customers marked converted",
      icon: Target,
      label: "Converted Customers",
      value: analytics.cards.convertedCustomers,
    },
    {
      description: "Converted customers / total customers",
      icon: TrendingUp,
      label: "Conversion Rate",
      suffix: "%",
      value: analytics.cards.conversionRate,
    },
  ];

  return (
    <section className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <AnalyticsCard key={card.label} {...card} />
        ))}
      </div>

      {analytics.errors.length > 0 ? (
        <div className="rounded-xl border border-[#fed7aa] bg-[#fff7ed] px-4 py-3 text-sm text-[#9a3412]">
          Analytics data is waiting on the latest Supabase schema. The page is
          showing safe placeholders until all tables and workflow fields are
          ready.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          description="Conversation volume grouped by created month."
          icon={BarChart3}
          placeholder={chartPlaceholders["Monthly Conversations"]}
          points={analytics.monthlyConversations}
          title="Monthly Conversations"
        />
        <ChartCard
          description="Won conversion records grouped by converted month."
          icon={Target}
          placeholder={chartPlaceholders["Monthly Conversions"]}
          points={analytics.monthlyConversions}
          title="Monthly Conversions"
        />
        <ChartCard
          description="Conversation distribution by source channel."
          icon={Sparkles}
          points={analytics.platformConversations}
          title="Conversations by Platform"
        />
        <ChartCard
          description="Customers with AI auto reply enabled versus human mode."
          icon={Bot}
          points={analytics.aiVsHuman}
          title="AI vs Human"
        />
      </div>
    </section>
  );
}

function AnalyticsCard({
  description,
  icon: Icon,
  label,
  suffix = "",
  value,
}: {
  description: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  suffix?: string;
  value: number;
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight">
            {value}
            {suffix}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  description,
  icon: Icon,
  placeholder,
  points,
  title,
}: {
  description: string;
  icon: ComponentType<{ className?: string }>;
  placeholder?: AnalyticsPoint[];
  points: AnalyticsPoint[];
  title: string;
}) {
  const data = points.length > 0 ? points : (placeholder ?? points);
  const max = Math.max(...data.map((point) => point.value), 1);
  const hasRealData = points.some((point) => point.value > 0);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Icon className="size-5 text-primary" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Badge variant={hasRealData ? "success" : "secondary"}>
            {hasRealData ? "Live" : "Placeholder"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((point) => (
            <div className="space-y-1.5" key={point.label}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">{point.label}</span>
                <span className="text-muted-foreground">{point.value}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn(
                    "h-full rounded-full bg-primary transition-all",
                    !hasRealData && "bg-muted-foreground/30",
                  )}
                  style={{
                    width: `${hasRealData ? Math.max((point.value / max) * 100, 6) : 0}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {!hasRealData ? (
          <div className="mt-5 rounded-xl border border-dashed bg-background/72 px-4 py-5 text-center">
            <p className="text-sm font-semibold">No chart data yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This chart will populate as tenant activity is recorded.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
