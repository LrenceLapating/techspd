import { CheckCircle2, Filter, Search, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { markCustomerConverted } from "@/app/customers/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  convertedFilters,
  formatDate,
  formatLeadStage,
  formatPlatform,
  type CustomerFilters,
  type CustomerRow,
  leadStages,
  platforms,
} from "@/lib/sales/data";

type CustomersModuleProps = {
  customers: CustomerRow[];
  error?: string;
  filters: CustomerFilters;
};

export function CustomersModule({
  customers,
  error,
  filters,
}: CustomersModuleProps) {
  return (
    <section className="space-y-5">
      <Card className="shadow-sm">
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <UsersRound className="size-5 text-primary" />
                Customers
              </CardTitle>
              <CardDescription>
                Search, filter, and manage customer status across every social
                channel.
              </CardDescription>
            </div>
            <Badge variant="secondary">{customers.length} visible</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 xl:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto]">
            <div className="relative">
              <label className="sr-only" htmlFor="customer-search">
                Search customers
              </label>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                defaultValue={filters.search}
                id="customer-search"
                name="search"
                placeholder="Search customers"
                type="search"
                className="pl-9"
              />
            </div>

            <SelectFilter
              label="Filter by platform"
              name="platform"
              options={platforms}
              value={filters.platform}
            />
            <SelectFilter
              label="Filter by lead stage"
              name="leadStage"
              options={leadStages}
              value={filters.leadStage}
            />
            <SelectFilter
              label="Filter by converted"
              name="converted"
              options={convertedFilters}
              value={filters.converted}
            />
            <div>
              <label className="sr-only" htmlFor="customer-month">
                Filter by month
              </label>
              <Input
                defaultValue={filters.month}
                id="customer-month"
                name="month"
                type="month"
              />
            </div>
            <Button type="submit" variant="outline">
              <Filter className="size-4" />
              Filter
            </Button>
          </form>

          {error ? (
            <div className="mt-4 rounded-xl border border-[#fed7aa] bg-[#fff7ed] px-4 py-3 text-sm text-[#9a3412]">
              Customer workflow fields are not ready yet. Run the latest Step 5
              migration, then refresh this page.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b bg-secondary/70 text-xs uppercase text-muted-foreground">
              <tr>
                <TableHead>Name</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>AI Status</TableHead>
                <TableHead>Lead Stage</TableHead>
                <TableHead>Converted</TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead>Action</TableHead>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr className="border-b last:border-0" key={customer.id}>
                  <td className="px-4 py-4">
                    <div className="font-semibold">{customer.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {customer.email ?? customer.phone ?? "No contact yet"}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant="secondary">
                      {formatPlatform(customer.platform)}
                    </Badge>
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant={customer.ai_enabled ? "success" : "warning"}>
                      {customer.ai_enabled ? "AI On" : "AI Off"}
                    </Badge>
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant="outline">
                      {formatLeadStage(customer.lead_stage)}
                    </Badge>
                  </td>
                  <td className="px-4 py-4">
                    {customer.converted ? (
                      <Badge variant="success">Converted</Badge>
                    ) : (
                      <Badge variant="secondary">Not converted</Badge>
                    )}
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">
                    {formatDate(customer.last_activity_at ?? customer.updated_at)}
                  </td>
                  <td className="px-4 py-4">
                    {customer.converted ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <CheckCircle2 className="size-4 text-accent-foreground" />
                        Synced
                      </span>
                    ) : (
                      <form action={markCustomerConverted}>
                        <input
                          name="customerId"
                          type="hidden"
                          value={customer.id}
                        />
                        <Button size="sm" type="submit" variant="outline">
                          Mark Converted
                        </Button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {customers.length === 0 ? (
          <div className="border-t px-6 py-12 text-center">
            <p className="font-semibold">No customers match these filters.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              New customer records will appear here as conversations begin.
            </p>
          </div>
        ) : null}
      </Card>
    </section>
  );
}

function SelectFilter({
  label,
  name,
  options,
  value,
}: {
  label: string;
  name: string;
  options: readonly string[];
  value: string;
}) {
  return (
    <div>
      <label className="sr-only" htmlFor={name}>
        {label}
      </label>
      <select
        className="h-10 w-full rounded-lg border bg-card px-3 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
        defaultValue={value}
        id={name}
        name={name}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {formatOption(option)}
          </option>
        ))}
      </select>
    </div>
  );
}

function TableHead({ children }: { children: ReactNode }) {
  return <th className="px-4 py-3 font-semibold">{children}</th>;
}

function formatOption(value: string) {
  if (value === "all") {
    return "All";
  }

  if (value === "not_converted") {
    return "Not Converted";
  }

  return formatLeadStage(formatPlatform(value).toLowerCase()).replace(
    "Follow Up",
    "Follow Up",
  );
}
