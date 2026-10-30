"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();

export async function setSupplyQty(id: string, qty: number) {
  const i = uuid.safeParse(id);
  const q = z.number().int().min(0).max(9999).safeParse(qty);
  if (!i.success || !q.success) return { error: "არასწორი მონაცემი" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("supply_items")
    .update({ quantity_needed: q.data })
    .eq("id", i.data)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" };

  revalidatePath("/supplies");
  return { ok: true };
}

const supplySchema = z.object({
  name: z.string().trim().min(1, "სახელი აუცილებელია").max(200),
  volume: z.string().trim().max(60).optional(),
  unit_price: z.string().optional(),
  quantity_needed: z.coerce.number().int().min(0).max(9999),
  comment: z.string().trim().max(500).optional(),
  photo_url: z
    .string()
    .regex(/^supplies\/[\w-]+\.\w+$/)
    .optional()
    .or(z.literal("")),
  remove_photo: z.string().optional(),
});

export async function saveSupply(id: string | null, formData: FormData) {
  const parsed = supplySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  let price: number | null = null;
  if (v.unit_price && v.unit_price.trim() !== "") {
    price = Number(v.unit_price);
    if (!Number.isFinite(price) || price < 0) return { error: "ფასი არასწორია" };
  }

  const row: Record<string, unknown> = {
    name: v.name,
    volume: v.volume || null,
    unit_price: price,
    quantity_needed: v.quantity_needed,
    comment: v.comment || null,
  };
  if (v.photo_url) row.photo_url = v.photo_url;
  else if (v.remove_photo === "on") row.photo_url = null;

  const supabase = await createClient();
  if (id) {
    const i = uuid.safeParse(id);
    if (!i.success) return { error: "არასწორი მონაცემი" };

    const { data: old } = await supabase
      .from("supply_items")
      .select("photo_url")
      .eq("id", i.data)
      .single();

    const { data, error } = await supabase
      .from("supply_items")
      .update(row)
      .eq("id", i.data)
      .select("id");
    if (error) return { error: "ვერ შეინახა: " + error.message };
    if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" };

    if (old?.photo_url && "photo_url" in row) {
      await supabase.storage.from("photos").remove([old.photo_url]);
    }
  } else {
    const { data, error } = await supabase.from("supply_items").insert(row).select("id");
    if (error) return { error: "ვერ შეინახა: " + error.message };
    if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" };
  }

  revalidatePath("/supplies");
  return { ok: true };
}

export async function deleteSupply(id: string) {
  const i = uuid.safeParse(id);
  if (!i.success) return { error: "არასწორი მონაცემი" };

  const supabase = await createClient();
  const { data: old } = await supabase
    .from("supply_items")
    .select("photo_url")
    .eq("id", i.data)
    .single();

  const { data, error } = await supabase
    .from("supply_items")
    .delete()
    .eq("id", i.data)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" };

  if (old?.photo_url) await supabase.storage.from("photos").remove([old.photo_url]);

  revalidatePath("/supplies");
  return { ok: true };
}