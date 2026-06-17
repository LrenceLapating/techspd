import Link from "next/link";
import { Sparkles } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type AuthCardProps = {
  children: React.ReactNode;
  description: string;
  footer: React.ReactNode;
  title: string;
};

export function AuthCard({
  children,
  description,
  footer,
  title,
}: AuthCardProps) {
  return (
    <main className="dashboard-grid flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="size-5" />
          </div>
          <span className="text-xl font-semibold tracking-tight">TechSpd</span>
        </Link>
        <Card className="shadow-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>
            {children}
            <div className="mt-6 text-center text-sm text-muted-foreground">
              {footer}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
