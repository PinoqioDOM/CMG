"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { monthRange, weekRange, dm } from "@/lib/plan";

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

  // დახურული პერიოდი დაბლოკილია
  const { data: tpl } = await supabase
    .from("checklist_templates")
    .select("position, frequency")
    .eq("id", t.data)
    .single();
  if (tpl) {
    const { data: locks } = await supabase
      .from("checklist_closures")
      .select("period_type")
      .eq("position", tpl.position)
      .lte("period_start", d.data)
      .gte("period_end", d.data);
    const locked = (locks ?? []).some(
      (l) => l.period_type === "month" || (l.period_type === "week" && tpl.frequency !== "monthly")
    );
    if (locked) return { error: "ეს პერიოდი დახურულია. ჯერ გახსენი." };
  }

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
      const w = weekRange(d.data);
      q = q.gte("done_date", w.start).lte("done_date", w.end);
    } else {
      const mo = monthRange(d.data);
      q = q.gte("done_date", mo.start).lte("done_date", mo.end);
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

// ---------- გეგმის დახურვა ----------
function containedWeeks(start: string, end: string) {
  const [y, m, d] = start.split("-").map(Number);
  let ts = Date.UTC(y, m - 1, d);
  while (new Date(ts).getUTCDay() !== 1) ts += 86400000;
  const [ey, em, ed] = end.split("-").map(Number);
  const endTs = Date.UTC(ey, em - 1, ed);
  const out: string[] = [];
  while (ts + 6 * 86400000 <= endTs) {
    out.push(new Date(ts).toISOString().slice(0, 10));
    ts += 7 * 86400000;
  }
  return out;
}

export async function closePlan(position: string, type: string, anchor: string) {
  const p = z.string().trim().min(1).max(60).safeParse(position);
  const ty = z.enum(["week", "month"]).safeParse(type);
  const a = day.safeParse(anchor);
  if (!p.success || !ty.success || !a.success) return { error: "არასწორი მონაცემი" };

  const { start, end } = ty.data === "week" ? weekRange(a.data) : monthRange(a.data);
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("checklist_closures")
    .select("id")
    .eq("position", p.data)
    .eq("period_type", ty.data)
    .eq("period_start", start)
    .limit(1);
  if (existing && existing.length > 0) return { error: "ეს გეგმა უკვე დახურულია" };

  if (ty.data === "month") {
    const starts = containedWeeks(start, end);
    if (starts.length > 0) {
      const { data: closed } = await supabase
        .from("checklist_closures")
        .select("period_start")
        .eq("position", p.data)
        .eq("period_type", "week")
        .in("period_start", starts);
      const closedSet = new Set((closed ?? []).map((c) => c.period_start as string));
      const missing = starts.filter((s) => !closedSet.has(s));
      if (missing.length > 0) {
        const labels = missing.map((s) => {
          const w = weekRange(s);
          return `${dm(w.start)}–${dm(w.end)}`;
        });
        return { error: "ჯერ დახურე კვირის გეგმა: " + labels.join(", ") };
      }
    }
  }

  const { data: tpl } = await supabase
    .from("checklist_templates")
    .select("id, title, frequency, sort_order")
    .eq("position", p.data)
    .eq("is_active", true)
    .order("sort_order");
  const templates = (tpl ?? []).filter((t) => (ty.data === "week" ? t.frequency !== "monthly" : true));
  if (templates.length === 0) return { error: "ამ სერვისში პუნქტები არ არის" };

  const { data: logs } = await supabase
    .from("checklist_logs")
    .select("template_id, done_date")
    .in(
      "template_id",
      templates.map((t) => t.id)
    )
    .gte("done_date", start)
    .lte("done_date", end)
    .order("done_date");

  const items = templates.map((t) => ({
    title: t.title,
    frequency: t.frequency,
    dates: (logs ?? []).filter((l) => l.template_id === t.id).map((l) => l.done_date as string),
  }));

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("checklist_closures")
    .insert({
      position: p.data,
      period_type: ty.data,
      period_start: start,
      period_end: end,
      snapshot: { items },
      closed_by: user?.id,
    })
    .select("id");
  if (error) return { error: "ვერ დაიხურა: " + error.message };
  if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" };

  revalidatePath("/services", "layout");
  return { ok: true, id: data[0].id as string };
}

export async function reopenPlan(id: string) {
  const i = uuid.safeParse(id);
  if (!i.success) return { error: "არასწორი მონაცემი" };

  const supabase = await createClient();
  const { data: c } = await supabase
    .from("checklist_closures")
    .select("position, period_type, period_start, period_end")
    .eq("id", i.data)
    .single();
  if (!c) return { error: "ჩანაწერი ვერ მოიძებნა" };

  if (c.period_type === "week") {
    const { data: months } = await supabase
      .from("checklist_closures")
      .select("id")
      .eq("position", c.position)
      .eq("period_type", "month")
      .lte("period_start", c.period_end)
      .gte("period_end", c.period_start)
      .limit(1);
    if (months && months.length > 0) return { error: "ჯერ გახსენი თვის გეგმა" };
  }

  const { data, error } = await supabase
    .from("checklist_closures")
    .delete()
    .eq("id", i.data)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" };

  revalidatePath("/services", "layout");
  return { ok: true };
}