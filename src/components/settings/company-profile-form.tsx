"use client";

import { useState } from "react";
import { saveCompanyProfile } from "@/app/settings/actions";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";

export function CompanyProfileForm({
  companyName,
  email,
}: {
  companyName: string;
  email: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function save(formData: FormData) {
    setMessage(null);
    setIsError(false);

    try {
      const result = await saveCompanyProfile(formData);

      if (result.error) {
        setIsError(true);
        setMessage(result.error);
        return;
      }

      setMessage("Profile saved.");
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : "Company profile was not saved.",
      );
    }
  }

  return (
    <form action={save} className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="company-name">
          Company name
        </label>
        <Input
          defaultValue={companyName}
          id="company-name"
          name="companyName"
          placeholder="Company name"
          required
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="company-email">
          Primary contact
        </label>
        <Input
          defaultValue={email}
          id="company-email"
          name="companyEmail"
          placeholder="owner@company.com"
          required
          type="email"
        />
      </div>
      <div className="flex items-end gap-3">
        <SubmitButton
          className="min-w-32"
          pendingText="Saving..."
          variant="outline"
        >
          Save Profile
        </SubmitButton>
        {message ? (
          <p
            className={isError ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
            role={isError ? "alert" : "status"}
          >
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
