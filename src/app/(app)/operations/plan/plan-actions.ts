"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function done() {
  revalidatePath("/operations/plan");
  return { ok: true as const };
}

export async function addPlanItem(scope: string, periodStart: string, title: string) {
  const s = z.enum(["week", "month"]).safeParse(scope);
  const p = day.safeParse(periodStart);
  const t = z.string().trim().min(1).max(300).safeParse(title);
  if (!s.success || !p.success || !t.success) return { error: "არასწორი მონაცემი" } as const;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();

  const { data, error } = await supabase
    .from("plan_items")
    .insert({
      scope: s.data,
      period_start: p.data,
      title: t.data,
      sort_order: Math.floor(Date.now() / 1000),
      created_by: auth?.claims?.sub,
    })
    .select("id");
  if (error) return { error: "ვერ დაემატა: " + error.message } as const;
  if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" } as const;
  return done();
}

export async function togglePlanItem(id: string, value: boolean) {
  const i = uuid.safeParse(id);
  if (!i.success) return { error: "არასწორი მონაცემი" } as const;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plan_items")
    .update({ done: value })
    .eq("id", i.data)
    .select("id");
  if (error) return { error: error.message } as const;
  if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" } as const;
  return done();
}

export async function renamePlanItem(id: string, title: string) {
  const i = uuid.safeParse(id);
  const t = z.string().trim().min(1).max(300).safeParse(title);
  if (!i.success || !t.success) return { error: "არასწორი მონაცემი" } as const;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plan_items")
    .update({ title: t.data })
    .eq("id", i.data)
    .select("id");
  if (error) return { error: error.message } as const;
  if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" } as const;
  return done();
}

export async function deletePlanItem(id: string) {
  const i = uuid.safeParse(id);
  if (!i.success) return { error: "არასწორი მონაცემი" } as const;

  const supabase = await createClient();
  const { data, error } = await supabase.from("plan_items").delete().eq("id", i.data).select("id");
  if (error) return { error: error.message } as const;
  if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" } as const;
  return done();
}

export async function saveReport(date: string, body: string) {
  const d = day.safeParse(date);
  const b = z.string().max(5000).safeParse(body);
  if (!d.success || !b.success) return { error: "არასწორი მონაცემი" } as const;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("day_reports")
    .upsert(
      { date: d.data, body: b.data, updated_by: user?.id, updated_at: new Date().toISOString() },
      { onConflict: "date" }
    )
    .select("date");
  if (error) return { error: error.message } as const;
  if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" } as const;
  return done();
}