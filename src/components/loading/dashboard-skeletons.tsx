import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function InboxSkeleton() {
  return (
    <section
      aria-label="Loading inbox"
      className="grid min-h-[calc(100vh-172px)] gap-4 xl:grid-cols-[320px_minmax(0,1fr)_340px]"
    >
      <Card className="shadow-sm">
        <CardHeader className="space-y-4">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-10 w-full" />
          <div className="flex gap-2 overflow-hidden">
            {[56, 78, 82, 64].map((width) => (
              <Skeleton className="h-8 shrink-0" key={width} style={{ width }} />
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[0, 1, 2, 3, 4].map((item) => (
            <div className="flex gap-3 rounded-lg border p-3" key={item}>
              <Skeleton className="size-11 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="flex min-h-[560px] flex-col overflow-hidden shadow-sm">
        <div className="flex items-center gap-3 border-b p-4">
          <Skeleton className="size-11 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="flex-1 space-y-5 p-5">
          <Skeleton className="h-16 w-3/5 rounded-lg" />
          <Skeleton className="ml-auto h-16 w-2/3 rounded-lg" />
          <Skeleton className="h-20 w-4/5 rounded-lg" />
          <Skeleton className="ml-auto h-14 w-1/2 rounded-lg" />
        </div>
        <div className="flex gap-2 border-t p-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-28" />
        </div>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="space-y-5 p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-12 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
          {[0, 1, 2, 3, 4].map((item) => (
            <div className="flex items-center gap-3" key={item}>
              <Skeleton className="size-8 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          ))}
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </CardContent>
      </Card>
    </section>
  );
}

export function CustomersSkeleton() {
  return (
    <section aria-label="Loading customers" className="space-y-5">
      <Card className="shadow-sm">
        <CardHeader className="space-y-3">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <Skeleton className="h-10 w-full" key={item} />
          ))}
        </CardContent>
      </Card>
      <Card className="overflow-hidden shadow-sm">
        <div className="border-b bg-secondary/60 px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="space-y-0">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div className="grid grid-cols-4 gap-6 border-b px-4 py-5 last:border-0" key={item}>
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-36 max-w-full" />
              </div>
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-8 w-28" />
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}

export function AnalyticsSkeleton() {
  return (
    <section aria-label="Loading analytics" className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Card className="shadow-sm" key={item}>
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-3 w-36 max-w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {[0, 1, 2, 3].map((item) => (
          <Card className="shadow-sm" key={item}>
            <CardHeader className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-72 max-w-full" />
            </CardHeader>
            <CardContent className="space-y-5">
              {[0, 1, 2, 3].map((bar) => (
                <div className="space-y-2" key={bar}>
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-full rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
