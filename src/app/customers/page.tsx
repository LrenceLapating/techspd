import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { CustomersModule } from "@/components/sales/customers-module";
import { getDashboardContext } from "@/lib/dashboard/context";
import { getCustomers, normalizeCustomerFilters } from "@/lib/sales/data";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await getDashboardContext();

  if (!context.isConfigured) {
    redirect("/");
  }

  const filters = normalizeCustomerFilters((await searchParams) ?? {});
  const { customers, error } = await getCustomers(filters);

  return (
    <DashboardShell
      activeSection="Customers"
      companyName={context.companyName}
      counts={context.counts}
      email={context.email}
    >
      <CustomersModule customers={customers} error={error} filters={filters} />
    </DashboardShell>
  );
}
