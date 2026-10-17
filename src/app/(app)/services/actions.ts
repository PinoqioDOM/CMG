"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// ---------- ჩეკლისტი ----------
export async function toggleChecklist(
  templateId: string,
  date: string,
  frequency: string,
  done: boolean
) {
  const t = uuid.safeParse(templateId);
  const d = day.safeParse(date);
  const f = z.enum(["daily", "weekly", "monthly"]).safeParse(frequency);
  if (!t.success || !d.success || !f.success) return { error: "არასწორი მონაცემი" };

  const supabase = await createClient();

  if (done) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("checklist_logs").upsert(
      { template_id: t.data, done_date: d.data, done_by: user?.id },
      { onConflict: "template_id,done_date", ignoreDuplicates: true }
    );
    if (error) return { error: error.message };
  } else {
    let q = supabase.from("checklist_logs").delete().eq("template_id", t.data);
    if (f.data === "daily") {
      q = q.eq("done_date", d.data);
    } else if (f.data === "weekly") {
      const [y, m, dd] = d.data.split("-").map(Number);
      const ts = Date.UTC(y, m - 1, dd);
      const offset = (new Date(ts).getUTCDay() + 6) % 7; // ორშაბათიდან
      const start = new Date(ts - offset * 86400000).toISOString().slice(0, 10);
      const end = new Date(ts + (6 - offset) * 86400000).toISOString().slice(0, 10);
      q = q.gte("done_date", start).lte("done_date", end);
    } else {
      const [y, m] = d.data.split("-").map(Number);
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const ym = d.data.slice(0, 7);
      q = q.gte("done_date", `${ym}-01`).lte("done_date", `${ym}-${String(last).padStart(2, "0")}`);
    }
    const { error } = await q;
    if (error) return { error: error.message };
  }

  revalidatePath("/services");
  return { ok: true };
}

// ---------- შაბლონები ----------
const tplSchema = z.object({
  position: z.enum(["housekeeper", "groundskeeper", "gardener"]),
  frequency: z.enum(["daily", "monthly"]),
  title: z.string().trim().min(1, "სათაური აუცილებელია").max(200),
});

export async function addTemplate(formData: FormData) {
  const parsed = tplSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("checklist_templates")
    .select("sort_order")
    .eq("position", v.position)
    .eq("frequency", v.frequency)
    .order("sort_order", { ascending: false })
    .limit(1);

  const { data, error } = await supabase
    .from("checklist_templates")
    .insert({ ...v, sort_order: (last?.[0]?.sort_order ?? 0) + 1 })
    .select("id");
  if (error) return { error: "ვერ დაემატა: " + error.message };
  if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" };

  revalidatePath("/services");
  return { ok: true };
}

export async function renameTemplate(id: string, title: string) {
  const i = uuid.safeParse(id);
  const t = z.string().trim().min(1).max(200).safeParse(title);
  if (!i.success || !t.success) return { error: "არასწორი მონაცემი" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("checklist_templates")
    .update({ title: t.data })
    .eq("id", i.data)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" };

  revalidatePath("/services");
  return { ok: true };
}

export async function deleteTemplate(id: string) {
  const i = uuid.safeParse(id);
  if (!i.success) return { error: "არასწორი მონაცემი" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("checklist_templates")
    .delete()
    .eq("id", i.data)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" };

  revalidatePath("/services");
  return { ok: true };
}

export async function setTemplateFrequency(id: string, frequency: string) {
  const i = uuid.safeParse(id);
  const f = z.enum(["daily", "weekly", "monthly"]).safeParse(frequency);
  if (!i.success || !f.success) return { error: "არასწორი მონაცემი" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("checklist_templates")
    .update({ frequency: f.data })
    .eq("id", i.data)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" };

  revalidatePath("/services");
  return { ok: true };
}

export async function deleteService(name: string) {
  const n = z.string().trim().min(1).max(60).safeParse(name);
  if (!n.success) return { error: "არასწორი მონაცემი" };
  if (["housekeeper", "groundskeeper", "gardener"].includes(n.data)) {
    return { error: "ძირითადი სერვისის წაშლა შეუძლებელია" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("checklist_templates").delete().eq("position", n.data);
  if (error) return { error: error.message };

  revalidatePath("/services");
  return { ok: true };
}

// ---------- მომარაგება ----------
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

  revalidatePath("/services");
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

  revalidatePath("/services");
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

  revalidatePath("/services");
  return { ok: true };
}