import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { CustomersSkeleton } from "@/components/loading/dashboard-skeletons";
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
  const filterKey = JSON.stringify(filters);

  return (
    <DashboardShell
      activeSection="Customers"
      companyName={context.companyName}
      counts={context.counts}
      email={context.email}
    >
      <Suspense fallback={<CustomersSkeleton />} key={filterKey}>
        <CustomersContent filters={filters} />
      </Suspense>
    </DashboardShell>
  );
}

async function CustomersContent({
  filters,
}: {
  filters: ReturnType<typeof normalizeCustomerFilters>;
}) {
  const { customers, error } = await getCustomers(filters);

  return <CustomersModule customers={customers} error={error} filters={filters} />;
}
