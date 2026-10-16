"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  title: z.string().trim().min(1, "სათაური აუცილებელია").max(200),
  folder_name: z.string().trim().min(1, "ფოლდერი აუცილებელია").max(60),
  property_id: z.union([z.string().uuid(), z.literal("")]).optional(),
  expires_at: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).optional(),
  file_url: z
    .union([
      z
        .string()
        .max(2000)
        .refine((u) => /^https?:\/\/\S+$/.test(u), "ბმული არასწორია"),
      z.literal(""),
    ])
    .optional(),
  file_path: z.union([z.string().regex(/^files\/[\w-]+\.\w+$/), z.literal("")]).optional(),
  file_name: z.string().trim().max(255).optional(),
  size_bytes: z.coerce.number().int().min(0).optional(),
});

export async function saveDocument(id: string | null, formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const row: Record<string, unknown> = {
    title: v.title,
    folder_name: v.folder_name,
    property_id: v.property_id || null,
    expires_at: v.expires_at || null,
    file_url: v.file_url || null,
  };
  if (v.file_path) {
    row.file_path = v.file_path;
    row.file_name = v.file_name || null;
    row.size_bytes = v.size_bytes ?? null;
  }

  if (id) {
    const docId = z.string().uuid().safeParse(id);
    if (!docId.success) return { error: "არასწორი მონაცემი" };

    const { data: old } = await supabase
      .from("documents")
      .select("file_path")
      .eq("id", docId.data)
      .single();

    const { data, error } = await supabase
      .from("documents")
      .update(row)
      .eq("id", docId.data)
      .select("id");
    if (error) return { error: "ვერ შეინახა: " + error.message };
    if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" };

    if (v.file_path && old?.file_path && old.file_path !== v.file_path) {
      await supabase.storage.from("documents").remove([old.file_path]);
    }
  } else {
    if (!v.file_path && !v.file_url) return { error: "ატვირთე ფაილი ან ჩასვი ბმული" };
    const { data, error } = await supabase
      .from("documents")
      .insert({ ...row, uploaded_by: user?.id })
      .select("id");
    if (error) return { error: "ვერ შეინახა: " + error.message };
    if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" };
  }

  revalidatePath("/documents");
  return { ok: true };
}

export async function deleteDocument(id: string) {
  const docId = z.string().uuid().safeParse(id);
  if (!docId.success) return { error: "არასწორი მონაცემი" };

  const supabase = await createClient();
  const { data: old } = await supabase
    .from("documents")
    .select("file_path")
    .eq("id", docId.data)
    .single();

  const { data, error } = await supabase
    .from("documents")
    .delete()
    .eq("id", docId.data)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" };

  if (old?.file_path) await supabase.storage.from("documents").remove([old.file_path]);

  revalidatePath("/documents");
  return { ok: true };
}