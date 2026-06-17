import { BarChart3, Download, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatDate,
  formatMonth,
  formatPlatform,
  type ConversionRow,
} from "@/lib/sales/data";

type ConversionsModuleProps = {
  conversions: ConversionRow[];
  error?: string;
};

export function ConversionsModule({
  conversions,
  error,
}: ConversionsModuleProps) {
  const grouped = groupConversionsByMonth(conversions);
  const platformStats = buildPlatformStats(conversions);

  return (
    <section className="space-y-5">
      <Card className="shadow-sm">
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Trophy className="size-5 text-primary" />
                Conversions
              </CardTitle>
              <CardDescription>
                Customers marked as converted or availed are grouped by month
                and platform.
              </CardDescription>
            </div>
            <Button type="button" variant="outline">
              <Download className="size-4" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {platformStats.map((stat) => (
              <div
                className="rounded-xl border bg-background/72 p-4"
                key={stat.platform}
              >
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="secondary">{stat.platform}</Badge>
                  <BarChart3 className="size-4 text-muted-foreground" />
                </div>
                <p className="mt-3 text-3xl font-semibold tracking-tight">
                  {stat.count}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Converted customers
                </p>
              </div>
            ))}
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-[#fed7aa] bg-[#fff7ed] px-4 py-3 text-sm text-[#9a3412]">
              Conversion workflow fields are not ready yet. Run the latest Step
              5 migration, then refresh this page.
            </div>
          ) : null}
        </CardContent>
      </Card>

      {grouped.length > 0 ? (
        <div className="space-y-5">
          {grouped.map((group) => (
            <Card className="overflow-hidden shadow-sm" key={group.month}>
              <CardHeader className="border-b bg-secondary/40">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle>{group.month}</CardTitle>
                    <CardDescription>
                      {group.items.length} converted customer
                      {group.items.length === 1 ? "" : "s"}
                    </CardDescription>
                  </div>
                  <Badge variant="success">Won</Badge>
                </div>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b bg-secondary/70 text-xs uppercase text-muted-foreground">
                    <tr>
                      <TableHead>Customer</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Conversion Date</TableHead>
                      <TableHead>Notes</TableHead>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((conversion) => {
                      const customer = customerFromConversion(conversion);
                      return (
                        <tr className="border-b last:border-0" key={conversion.id}>
                          <td className="px-4 py-4 font-semibold">
                            {customer.name}
                          </td>
                          <td className="px-4 py-4">
                            <Badge variant="secondary">
                              {formatPlatform(customer.platform)}
                            </Badge>
                          </td>
                          <td className="px-4 py-4 text-muted-foreground">
                            {formatDate(
                              conversion.converted_at ?? conversion.created_at,
                            )}
                          </td>
                          <td className="px-4 py-4 text-muted-foreground">
                            {conversionNote(conversion)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="shadow-sm">
          <CardContent className="px-6 py-12 text-center">
            <p className="font-semibold">No converted customers yet.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Mark a customer as converted to automatically create a conversion
              record.
            </p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function groupConversionsByMonth(conversions: ConversionRow[]) {
  const groups = new Map<string, ConversionRow[]>();

  for (const conversion of conversions) {
    const month = formatMonth(conversion.converted_at ?? conversion.created_at);
    groups.set(month, [...(groups.get(month) ?? []), conversion]);
  }

  return [...groups.entries()].map(([month, items]) => ({ items, month }));
}

function buildPlatformStats(conversions: ConversionRow[]) {
  const stats = new Map<string, number>([
    ["Facebook", 0],
    ["Instagram", 0],
    ["TikTok", 0],
    ["Unknown", 0],
  ]);

  for (const conversion of conversions) {
    const customer = customerFromConversion(conversion);
    const platform = formatPlatform(customer.platform);
    stats.set(platform, (stats.get(platform) ?? 0) + 1);
  }

  return [...stats.entries()].map(([platform, count]) => ({ count, platform }));
}

function customerFromConversion(conversion: ConversionRow) {
  const customer = Array.isArray(conversion.customers)
    ? conversion.customers[0]
    : conversion.customers;

  return {
    name: customer?.name ?? "Unknown customer",
    platform: customer?.platform ?? "unknown",
  };
}

function conversionNote(conversion: ConversionRow) {
  const notes = conversion.metadata?.notes;
  return typeof notes === "string" && notes.trim()
    ? notes
    : "Created when customer was marked converted.";
}

function TableHead({ children }: { children: ReactNode }) {
  return <th className="px-4 py-3 font-semibold">{children}</th>;
}
