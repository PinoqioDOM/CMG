"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();
const method = z.enum(["cash", "transfer", "invoice", ""]);
const idsSchema = z.array(uuid).min(1).max(200);

const schema = z.object({
  property_id: z.string().uuid("აირჩიე ბინა ან სახლი"),
  full_name: z.string().trim().min(1, "სახელი აუცილებელია").max(160),
  relation: z.enum(["owner", "tenant", "contact"]),
  phone: z.string().trim().max(40).optional(),
  company_id: z.string().trim().max(40).optional(),
  payment_method: method.optional(),
  is_primary: z.string().optional(),
  notes: z.string().trim().max(500).optional(),
});

function done() {
  revalidatePath("/finance/residents");
  revalidatePath("/finance");
  return { ok: true as const };
}

export async function saveResident(id: string | null, formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  const rid = id ? uuid.safeParse(id) : null;
  if (rid && !rid.success) return { error: "არასწორი მონაცემი" };

  const primary = v.is_primary === "on";
  const row = {
    property_id: v.property_id,
    full_name: v.full_name,
    relation: v.relation,
    phone: v.phone || null,
    company_id: v.company_id || null,
    payment_method: v.payment_method || null,
    is_primary: primary,
    notes: v.notes || null,
  };

  const supabase = await createClient();

  if (primary) {
    let q = supabase.from("residents").update({ is_primary: false }).eq("property_id", v.property_id);
    if (rid?.success) q = q.neq("id", rid.data);
    await q;
  }

  const { data, error } = rid?.success
    ? await supabase.from("residents").update(row).eq("id", rid.data).select("id")
    : await supabase.from("residents").insert(row).select("id");
  if (error) return { error: "ვერ შეინახა: " + error.message };
  if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" };

  return done();
}

export async function createResidents(formData: FormData) {
  const property = z.string().uuid("აირჩიე ბინა ან სახლი").safeParse(formData.get("property_id"));
  const relation = z.enum(["owner", "tenant", "contact"]).safeParse(formData.get("relation"));
  const pm = method.safeParse(formData.get("payment_method") ?? "");
  if (!property.success) return { error: property.error.issues[0].message };
  if (!relation.success || !pm.success) return { error: "არასწორი მონაცემი" };

  const names = Array.from(
    new Set(
      String(formData.get("names") ?? "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
  if (names.length === 0) return { error: "ჩაწერე მინიმუმ ერთი სახელი" };
  if (names.length > 50 || names.some((n) => n.length > 160)) {
    return { error: "ძალიან ბევრი ან ძალიან გრძელი სახელი" };
  }

  const supabase = await createClient();
  const { count } = await supabase
    .from("residents")
    .select("id", { count: "exact", head: true })
    .eq("property_id", property.data);

  const rows = names.map((full_name, i) => ({
    property_id: property.data,
    full_name,
    relation: relation.data,
    payment_method: pm.data || null,
    is_primary: (count ?? 0) === 0 && i === 0,
  }));

  const { data, error } = await supabase.from("residents").insert(rows).select("id");
  if (error) return { error: "ვერ შეინახა: " + error.message };
  if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" };

  return done();
}

export async function deleteResidents(ids: string[]) {
  const list = idsSchema.safeParse(ids);
  if (!list.success) return { error: "არასწორი მონაცემი" };

  const supabase = await createClient();
  const { data, error } = await supabase.from("residents").delete().in("id", list.data).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" };

  return done();
}

export async function setResidentsMethod(ids: string[], m: string) {
  const list = idsSchema.safeParse(ids);
  const pm = method.safeParse(m);
  if (!list.success || !pm.success) return { error: "არასწორი მონაცემი" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("residents")
    .update({ payment_method: pm.data || null })
    .in("id", list.data)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" };

  return done();
}