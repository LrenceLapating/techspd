import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/app/auth/actions";

type ForgotPasswordPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const params = await searchParams;

  return (
    <AuthCard
      title="Reset your password"
      description="Enter your email and we will send password reset instructions."
      footer={
        <>
          Remembered your password?{" "}
          <Link className="font-medium text-primary hover:underline" href="/auth/login">
            Sign in
          </Link>
        </>
      }
    >
      <form action={requestPasswordReset} className="space-y-4">
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
        <SubmitButton pendingText="Sending instructions...">
          Send reset link
        </SubmitButton>
      </form>
    </AuthCard>
  );
}
