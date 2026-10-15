"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  full_name: z.string().trim().min(1, "სახელი აუცილებელია").max(120),
  position: z.enum(["housekeeper", "groundskeeper", "gardener", "security", "other"]),
  phone: z.string().trim().max(40).optional(),
  is_active: z.string().optional(),
});

export async function createEmployee(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("employees").insert({
    full_name: v.full_name,
    position: v.position,
    phone: v.phone || null,
  });
  if (error) return { error: "ვერ შეინახა: " + error.message };

  revalidatePath("/staff");
  revalidatePath("/operations");
  return { ok: true };
}

export async function updateEmployee(id: string, formData: FormData) {
  const empId = z.string().uuid().safeParse(id);
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!empId.success) return { error: "არასწორი მონაცემი" };
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("employees")
    .update({
      full_name: v.full_name,
      position: v.position,
      phone: v.phone || null,
      is_active: v.is_active === "on",
    })
    .eq("id", empId.data);
  if (error) return { error: "ვერ შეინახა: " + error.message };

  revalidatePath("/staff");
  revalidatePath("/operations");
  return { ok: true };
}

export async function createEmployees(formData: FormData) {
  const position = z
    .enum(["housekeeper", "groundskeeper", "gardener", "security", "other"])
    .safeParse(formData.get("position"));
  if (!position.success) return { error: "არასწორი პოზიცია" };

  const names = Array.from(
    new Set(
      String(formData.get("names") ?? "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
  if (names.length === 0) return { error: "ჩაწერე მინიმუმ ერთი სახელი" };
  if (names.length > 50 || names.some((n) => n.length > 120)) {
    return { error: "ძალიან ბევრი ან ძალიან გრძელი სახელი" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .insert(names.map((full_name) => ({ full_name, position: position.data })))
    .select("id");
  if (error) return { error: "ვერ შეინახა: " + error.message };
  if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" };

  revalidatePath("/staff");
  revalidatePath("/operations");
  return { ok: true };
}

export async function deleteEmployees(ids: string[]) {
  const parsed = z.array(z.string().uuid()).min(1).max(100).safeParse(ids);
  if (!parsed.success) return { error: "არასწორი მონაცემი" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .delete()
    .in("id", parsed.data)
    .select("id");
  if (error) return { error: "ვერ წაიშალა: " + error.message };
  if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" };

  revalidatePath("/staff");
  revalidatePath("/operations");
  return { ok: true };
}