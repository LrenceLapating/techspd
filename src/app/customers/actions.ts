"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function markCustomerConverted(formData: FormData) {
  const customerId = formValue(formData, "customerId");

  if (!customerId) {
    return;
  }

  const supabase = await createClient();

  await supabase
    .from("customers")
    .update({
      converted: true,
      converted_at: new Date().toISOString(),
      lead_stage: "converted",
    })
    .eq("id", customerId);

  revalidatePath("/customers");
  revalidatePath("/conversions");
}
