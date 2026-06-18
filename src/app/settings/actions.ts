"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function saveCompanyProfile(formData: FormData) {
  const companyName = formValue(formData, "companyName");
  const companyEmail = formValue(formData, "companyEmail");

  if (!companyName || !companyEmail) {
    return { error: "Company name and primary contact are required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Unauthorized" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.company_id) {
    return {
      error: profileError?.message ?? "Company profile was not found.",
    };
  }

  const [companyResult, contactResult] = await Promise.all([
    supabase
      .from("companies")
      .update({ name: companyName })
      .eq("id", profile.company_id),
    supabase
      .from("users")
      .update({ email: companyEmail })
      .eq("id", user.id)
      .eq("company_id", profile.company_id),
  ]);

  if (companyResult.error || contactResult.error) {
    return {
      error:
        companyResult.error?.message ??
        contactResult.error?.message ??
        "Company profile was not saved.",
    };
  }

  revalidatePath("/settings");
  return { success: true };
}
