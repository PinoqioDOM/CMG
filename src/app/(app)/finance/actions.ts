"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const paySchema = z.object({
  amount_due: z.coerce.number().min(0, "თანხა არასწორია"),
  amount_paid: z.coerce.number().min(0, "თანხა არასწორია"),
  paid_at: z.string().optional(),
  payment_method: z.enum(["cash", "transfer", "invoice", ""]).optional(),
  comment: z.string().trim().max(1000).optional(),
});

export async function recordPayment(id: string, formData: FormData) {
  const paymentId = z.string().uuid().safeParse(id);
  const parsed = paySchema.safeParse(Object.fromEntries(formData));
  if (!paymentId.success) return { error: "არასწორი მონაცემი" };
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .update({
      amount_due: v.amount_due,
      amount_paid: v.amount_paid,
      paid_at: v.amount_paid > 0 && v.paid_at ? v.paid_at : null,
      payment_method: v.payment_method || null,
      comment: v.comment || null,
    })
    .eq("id", paymentId.data)
    .select("id");

  if (error) return { error: "ვერ შეინახა: " + error.message };
  if (!data || data.length === 0) return { error: "ამ ცვლილების უფლება მხოლოდ მენეჯერს აქვს" };

  revalidatePath("/finance");
  return { ok: true };
}

export async function generateMonth(year: number, month: number) {
  const y = z.number().int().min(2024).max(2100).safeParse(year);
  const m = z.number().int().min(1).max(12).safeParse(month);
  if (!y.success || !m.success) return { error: "არასწორი თვე" };

  const supabase = await createClient();
  const { data: props, error: pe } = await supabase
    .from("properties")
    .select("id, monthly_fee")
    .eq("is_active", true);
  if (pe) return { error: pe.message };

  const rows = (props ?? []).map((p) => ({
    property_id: p.id,
    year: y.data,
    month: m.data,
    amount_due: p.monthly_fee,
  }));

  const { data, error } = await supabase
    .from("payments")
    .upsert(rows, { onConflict: "property_id,year,month", ignoreDuplicates: true })
    .select("id");

  if (error) return { error: "ვერ შეიქმნა: " + error.message };
  if (!data || data.length === 0) return { error: "ამ ცვლილების უფლება მხოლოდ მენეჯერს აქვს" };

  revalidatePath("/finance");
  return { ok: true };
}

const idsSchema = z.array(z.string().uuid()).min(1).max(200);

export async function setPaymentStatus(ids: string[], status: string) {
  const list = idsSchema.safeParse(ids);
  const s = z.enum(["paid", "unpaid"]).safeParse(status);
  if (!list.success || !s.success) return { error: "არასწორი მონაცემი" };

  const supabase = await createClient();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tbilisi" });

  if (s.data === "unpaid") {
    const { data, error } = await supabase
      .from("payments")
      .update({ amount_paid: 0, paid_at: null, payment_method: null })
      .in("id", list.data)
      .select("id");
    if (error) return { error: error.message };
    if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" };
  } else {
    const { data: rows, error } = await supabase
      .from("payments")
      .select("id, amount_due, paid_at")
      .in("id", list.data);
    if (error) return { error: error.message };

    const res = await Promise.all(
      (rows ?? []).map((r) =>
        supabase
          .from("payments")
          .update({ amount_paid: r.amount_due, paid_at: r.paid_at ?? today })
          .eq("id", r.id)
          .select("id")
      )
    );
    const bad = res.find((r) => r.error);
    if (bad?.error) return { error: bad.error.message };
    if (res.every((r) => !r.data || r.data.length === 0)) {
      return { error: "ცვლილების უფლება არ გაქვს" };
    }
  }

  revalidatePath("/finance");
  return { ok: true };
}

export async function setPaymentMethod(ids: string[], method: string) {
  const list = idsSchema.safeParse(ids);
  const m = z.enum(["cash", "transfer", "invoice", ""]).safeParse(method);
  if (!list.success || !m.success) return { error: "არასწორი მონაცემი" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .update({ payment_method: m.data || null })
    .in("id", list.data)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" };

  revalidatePath("/finance");
  return { ok: true };
}

export async function deletePayments(ids: string[]) {
  const list = idsSchema.safeParse(ids);
  if (!list.success) return { error: "არასწორი მონაცემი" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments")
    .delete()
    .in("id", list.data)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" };

  revalidatePath("/finance");
  return { ok: true };
}