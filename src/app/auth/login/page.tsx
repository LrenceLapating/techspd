import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/app/auth/actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to your TechSpd company workspace."
      footer={
        <>
          New to TechSpd?{" "}
          <Link className="font-medium text-primary hover:underline" href="/auth/signup">
            Create an account
          </Link>
        </>
      }
    >
      <form action={signIn} className="space-y-4">
        <FormMessage error={params.error} message={params.message} />
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            autoComplete="email"
            id="email"
            name="email"
            placeholder="you@company.com"
            required
            type="email"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="password">Password</Label>
            <Link
              className="text-sm font-medium text-primary hover:underline"
              href="/auth/forgot-password"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            autoComplete="current-password"
            id="password"
            name="password"
            required
            type="password"
          />
        </div>
        <SubmitButton pendingText="Signing in...">Sign in</SubmitButton>
      </form>
    </AuthCard>
  );
}
