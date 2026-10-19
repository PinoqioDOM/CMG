"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const taskSchema = z.object({
  title: z.string().trim().min(1, "სათაური აუცილებელია").max(200),
  description: z.string().trim().max(2000).optional(),
  category: z.enum(["cleaning", "gardening", "security", "general"]),
  priority: z.enum(["low", "normal", "high"]),
  due_date: z.string().optional(),
  assigned_to: z.union([z.string().uuid(), z.literal("")]).optional(),
});

export async function createTask(formData: FormData) {
  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const v = parsed.data;

  const { error } = await supabase.from("tasks").insert({
    title: v.title,
    description: v.description || null,
    category: v.category,
    priority: v.priority,
    due_date: v.due_date || null,
    assigned_to: v.assigned_to || null,
    created_by: user?.id,
  });
  if (error) return { error: "ვერ შეინახა: " + error.message };

  revalidatePath("/operations");
  return { ok: true };
}

export async function updateTaskStatus(id: string, status: string) {
  const s = z.enum(["todo", "in_progress", "done"]).safeParse(status);
  const taskId = z.string().uuid().safeParse(id);
  if (!s.success || !taskId.success) return { error: "არასწორი მონაცემი" };

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update({ status: s.data }).eq("id", taskId.data);
  if (error) return { error: error.message };

  revalidatePath("/operations");
  return { ok: true };
}

const incidentSchema = z.object({
  title: z.string().trim().min(1, "სათაური აუცილებელია").max(200),
  description: z.string().trim().max(3000).optional(),
  location: z.string().trim().max(120).optional(),
  priority: z.enum(["low", "normal", "high"]),
  reported_by: z.string().trim().max(120).optional(),
  photo_url: z.string().regex(/^incidents\/[\w-]+\.\w+$/).optional().or(z.literal("")),
});

export async function createIncident(formData: FormData) {
  const parsed = incidentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const v = parsed.data;

  const { error } = await supabase.from("incidents").insert({
    title: v.title,
    description: v.description || null,
    location: v.location || null,
    priority: v.priority,
    reported_by: v.reported_by || null,
    photo_url: v.photo_url || null,
    created_by: user?.id,
  });
  if (error) return { error: "ვერ შეინახა: " + error.message };

  revalidatePath("/operations");
  return { ok: true };
}

export async function updateIncidentStatus(id: string, status: string) {
  const s = z.enum(["open", "in_progress", "resolved"]).safeParse(status);
  const incidentId = z.string().uuid().safeParse(id);
  if (!s.success || !incidentId.success) return { error: "არასწორი მონაცემი" };

  const resolved = s.data === "resolved";
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tbilisi" });

  const supabase = await createClient();
  const { error } = await supabase
    .from("incidents")
    .update({
      status: s.data,
      resolved_at: resolved ? new Date().toISOString() : null,
      completed_on: resolved ? today : null,
    })
    .eq("id", incidentId.data);
  if (error) return { error: error.message };

  revalidatePath("/operations");
  return { ok: true };
}

export async function deleteTask(id: string) {
  const taskId = z.string().uuid().safeParse(id);
  if (!taskId.success) return { error: "არასწორი მონაცემი" };

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId.data);
  if (error) return { error: error.message };

  revalidatePath("/operations");
  return { ok: true };
}

export async function deleteIncident(id: string) {
  const incidentId = z.string().uuid().safeParse(id);
  if (!incidentId.success) return { error: "არასწორი მონაცემი" };

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("incidents")
    .select("photo_url")
    .eq("id", incidentId.data)
    .single();

  const { error } = await supabase.from("incidents").delete().eq("id", incidentId.data);
  if (error) return { error: error.message };

  if (row?.photo_url) await supabase.storage.from("photos").remove([row.photo_url]);

  revalidatePath("/operations");
  return { ok: true };
}

const updateSchema = taskSchema.extend({
  status: z.enum(["todo", "in_progress", "done"]),
});

export async function updateTask(id: string, formData: FormData) {
  const tid = z.string().uuid().safeParse(id);
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!tid.success) return { error: "არასწორი მონაცემი" };
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({
      title: v.title,
      description: v.description || null,
      category: v.category,
      priority: v.priority,
      due_date: v.due_date || null,
      assigned_to: v.assigned_to || null,
      status: v.status,
    })
    .eq("id", tid.data)
    .select("id");
  if (error) return { error: "ვერ შეინახა: " + error.message };
  if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" };

  revalidatePath("/operations", "layout");
  return { ok: true };
}

export async function setTaskDate(id: string, date: string | null) {
  const tid = z.string().uuid().safeParse(id);
  const d = z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()])
    .safeParse(date);
  if (!tid.success || !d.success) return { error: "არასწორი მონაცემი" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update({ due_date: d.data })
    .eq("id", tid.data)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" };

  revalidatePath("/operations", "layout");
  return { ok: true };
}