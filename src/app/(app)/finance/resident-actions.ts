"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const uuid = z.string().uuid();
const method = z.enum(["cash", "transfer", "invoice", ""]);
const idsSchema = z.array(uuid).min(1).max(200);

const nowYM = (): [number, number] => {
  const s = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tbilisi" });
  return [Number(s.slice(0, 4)), Number(s.slice(5, 7))];
};

const schema = z.object({
  new_type: z.enum(["apartment", "house"]).optional(),
  new_number: z.string().trim().max(6).optional(),
  monthly_fee: z.string().optional(),
  apply_fee: z.string().optional(),
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

// ბინა/სახლი აქტიურია და მიმდინარე თვეში გადახდის ჩანაწერი აქვს
async function syncProperty(supabase: Supabase, propertyId: string) {
  const { data: p } = await supabase
    .from("properties")
    .select("id, monthly_fee, is_active")
    .eq("id", propertyId)
    .single();
  if (!p) return;
  if (!p.is_active) await supabase.from("properties").update({ is_active: true }).eq("id", p.id);
  const [y, m] = nowYM();
  await supabase.from("payments").upsert(
    { property_id: p.id, year: y, month: m, amount_due: p.monthly_fee },
    { onConflict: "property_id,year,month", ignoreDuplicates: true }
  );
}

// ბინა/სახლი, სადაც მობინადრე აღარ არის: გამოირთვება და მომავალი გადაუხდელი თვეები იშლება
async function cleanupEmpty(supabase: Supabase, propIds: string[]) {
  const [y, m] = nowYM();
  for (const pid of propIds) {
    const { count } = await supabase
      .from("residents")
      .select("id", { count: "exact", head: true })
      .eq("property_id", pid);
    if ((count ?? 0) > 0) continue;
    await supabase.from("properties").update({ is_active: false }).eq("id", pid);
    await supabase
      .from("payments")
      .delete()
      .eq("property_id", pid)
      .eq("amount_paid", 0)
      .or(`year.gt.${y},and(year.eq.${y},month.gte.${m})`);
  }
}

export async function saveResident(id: string | null, formData: FormData) {
  const pidRaw = String(formData.get("property_id") ?? "");
  if (pidRaw !== "new" && !uuid.safeParse(pidRaw).success) {
    return { error: "აირჩიე ბინა ან სახლი" };
  }
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  const rid = id ? uuid.safeParse(id) : null;
  if (rid && !rid.success) return { error: "არასწორი მონაცემი" };

  let fee: number | null = null;
  if (v.monthly_fee && v.monthly_fee.trim() !== "") {
    fee = Number(v.monthly_fee);
    if (!Number.isFinite(fee) || fee < 0) return { error: "გადასახადი არასწორია" };
  }

  const supabase = await createClient();
  const [cy, cm] = nowYM();

  // ძველი ბინა (თუ მობინადრე სხვა ბინაში გადაჰყავს)
  let oldPropertyId: string | null = null;
  if (rid?.success) {
    const { data: old } = await supabase
      .from("residents")
      .select("property_id")
      .eq("id", rid.data)
      .single();
    oldPropertyId = old?.property_id ?? null;
  }

  let propertyId: string;

  if (pidRaw === "new") {
    if (!v.new_type || !/^\d{1,4}$/.test(v.new_number ?? "")) {
      return { error: "მიუთითე ახალი ბინის/სახლის ნომერი" };
    }
    const number = `${v.new_type === "apartment" ? "ბინა" : "სახლი"} #${Number(v.new_number)}`;
    const { data: exists } = await supabase
      .from("properties")
      .select("id")
      .eq("number", number)
      .limit(1);
    if (exists && exists.length > 0) return { error: `${number} უკვე არსებობს, აირჩიე სიიდან` };

    const { data: created, error: ce } = await supabase
      .from("properties")
      .insert({ type: v.new_type, number, monthly_fee: fee ?? 0, is_active: true })
      .select("id");
    if (ce) return { error: "ვერ შეიქმნა: " + ce.message };
    if (!created || created.length === 0) return { error: "ცვლილების უფლება არ გაქვს" };
    propertyId = created[0].id as string;
  } else {
    propertyId = pidRaw;
    if (fee !== null) {
      const { data: cur } = await supabase
        .from("properties")
        .select("monthly_fee")
        .eq("id", propertyId)
        .single();
      if (cur && Number(cur.monthly_fee) !== fee) {
        const { data: up, error: ue } = await supabase
          .from("properties")
          .update({ monthly_fee: fee })
          .eq("id", propertyId)
          .select("id");
        if (ue) return { error: "გადასახადი ვერ შეინახა: " + ue.message };
        if (!up || up.length === 0) return { error: "ცვლილების უფლება არ გაქვს" };

        // მიმდინარე და მომავალი თვეების გადასახდელი ახალი თანხით
        if (v.apply_fee === "on") {
          await supabase
            .from("payments")
            .update({ amount_due: fee })
            .eq("property_id", propertyId)
            .or(`year.gt.${cy},and(year.eq.${cy},month.gte.${cm})`);
        }
      }
    }
  }

  const primary = v.is_primary === "on";
  const row = {
    property_id: propertyId,
    full_name: v.full_name,
    relation: v.relation,
    phone: v.phone || null,
    company_id: v.company_id || null,
    payment_method: v.payment_method || null,
    is_primary: primary,
    notes: v.notes || null,
  };

  if (primary) {
    let q = supabase.from("residents").update({ is_primary: false }).eq("property_id", propertyId);
    if (rid?.success) q = q.neq("id", rid.data);
    await q;
  }

  const { data, error } = rid?.success
    ? await supabase.from("residents").update(row).eq("id", rid.data).select("id")
    : await supabase.from("residents").insert(row).select("id");
  if (error) return { error: "ვერ შეინახა: " + error.message };
  if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" };

  await syncProperty(supabase, propertyId);
  if (oldPropertyId && oldPropertyId !== propertyId) await cleanupEmpty(supabase, [oldPropertyId]);

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

  await syncProperty(supabase, property.data);
  return done();
}

export async function deleteResidents(ids: string[]) {
  const list = idsSchema.safeParse(ids);
  if (!list.success) return { error: "არასწორი მონაცემი" };

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("residents")
    .select("id, property_id")
    .in("id", list.data);
  const propIds = Array.from(new Set((before ?? []).map((r) => r.property_id as string)));

  const { data, error } = await supabase.from("residents").delete().in("id", list.data).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" };

  await cleanupEmpty(supabase, propIds);
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