import { AuthCard } from "@/components/auth/auth-card";
import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePassword } from "@/app/auth/actions";

type UpdatePasswordPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function UpdatePasswordPage({
  searchParams,
}: UpdatePasswordPageProps) {
  const params = await searchParams;

  return (
    <AuthCard
      title="Choose a new password"
      description="Set a fresh password for your TechSpd account."
      footer="You can sign in with the new password once it is updated."
    >
      <form action={updatePassword} className="space-y-4">
        <FormMessage error={params.error} message={params.message} />
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            autoComplete="new-password"
            id="password"
            minLength={8}
            name="password"
            placeholder="Minimum 8 characters"
            required
            type="password"
          />
        </div>
        <SubmitButton pendingText="Updating password...">
          Update password
        </SubmitButton>
      </form>
    </AuthCard>
  );
}
