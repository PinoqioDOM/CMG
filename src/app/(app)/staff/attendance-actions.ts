"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  employee_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(["24h", "day", "night", "regular", "day_off", "vacation", "absent"]),
  hours: z.coerce.number().min(0.5).max(24).optional(),
  note: z.string().trim().max(200).optional(),
  repeat: z.enum(["none", "every", "weekdays"]).default("none"),
  every: z.coerce.number().int().min(1).max(31).optional(),
});

function datesFor(start: string, repeat: string, every?: number) {
  const [y, m, d] = start.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const fmt = (day: number) => `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const out = new Set<string>([start]);
  if (repeat === "every" && every) {
    for (let x = d + every; x <= last; x += every) out.add(fmt(x));
  }
  if (repeat === "weekdays") {
    for (let x = d; x <= last; x++) {
      const wd = new Date(Date.UTC(y, m - 1, x)).getUTCDay();
      if (wd >= 1 && wd <= 5) out.add(fmt(x));
    }
  }
  return Array.from(out);
}

export async function setAttendance(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "არასწორი მონაცემი" };
  const v = parsed.data;
  if (v.kind === "regular" && !v.hours) return { error: "მიუთითე საათები" };

  let shift_type: string | null = null;
  let hours: number | null = null;
  let status = "present";
  if (v.kind === "24h") [shift_type, hours] = ["24h", 24];
  else if (v.kind === "day") [shift_type, hours] = ["day", 12];
  else if (v.kind === "night") [shift_type, hours] = ["night", 12];
  else if (v.kind === "regular") [shift_type, hours] = ["regular", v.hours ?? null];
  else status = v.kind;

  const rows = datesFor(v.date, v.repeat, v.every).map((date) => ({
    employee_id: v.employee_id,
    date,
    shift_type,
    hours,
    status,
    note: v.note || null,
  }));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance")
    .upsert(rows, { onConflict: "employee_id,date" })
    .select("id");
  if (error) return { error: "ვერ შეინახა: " + error.message };
  if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" };

  revalidatePath("/staff");
  return { ok: true };
}

export async function clearAttendance(employeeId: string, date: string) {
  const e = z.string().uuid().safeParse(employeeId);
  const d = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(date);
  if (!e.success || !d.success) return { error: "არასწორი მონაცემი" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance")
    .delete()
    .eq("employee_id", e.data)
    .eq("date", d.data);
  if (error) return { error: error.message };

  revalidatePath("/staff");
  return { ok: true };
}

export async function continueMonth(year: number, month: number) {
  const y = z.number().int().min(2024).max(2100).safeParse(year);
  const m = z.number().int().min(1).max(12).safeParse(month);
  if (!y.success || !m.success) return { error: "არასწორი თვე" } as const;

  const DAY = 86400000;
  const first = Date.UTC(y.data, m.data - 1, 1);
  const days = new Date(Date.UTC(y.data, m.data, 0)).getUTCDate();
  const iso = (ts: number) => new Date(ts).toISOString().slice(0, 10);

  const supabase = await createClient();
  const { data: emps, error: ee } = await supabase
    .from("employees")
    .select("id")
    .eq("is_active", true);
  if (ee) return { error: ee.message } as const;

  const { data: recs, error: re } = await supabase
    .from("attendance")
    .select("employee_id, date, shift_type, hours, status")
    .gte("date", iso(first - 21 * DAY))
    .lte("date", iso(first + (days - 1) * DAY))
    .limit(5000);
  if (re) return { error: re.message } as const;

  const map = new Map((recs ?? []).map((r) => [`${r.employee_id}|${r.date}`, r]));
  const rows: {
    employee_id: string;
    date: string;
    shift_type: string | null;
    hours: number | null;
    status: string;
    note: string | null;
  }[] = [];

  for (const e of emps ?? []) {
    for (let d = 0; d < days; d++) {
      const ts = first + d * DAY;
      const date = iso(ts);
      if (map.has(`${e.id}|${date}`)) continue;
      const src = map.get(`${e.id}|${iso(ts - 21 * DAY)}`);
      if (!src || (src.status !== "present" && src.status !== "day_off")) continue;
      rows.push({
        employee_id: e.id,
        date,
        shift_type: src.shift_type,
        hours: src.hours,
        status: src.status,
        note: null,
      });
      map.set(`${e.id}|${date}`, { ...src, date });
    }
  }

  if (rows.length === 0) return { ok: true, count: 0 } as const;

  const { data, error } = await supabase
    .from("attendance")
    .upsert(rows, { onConflict: "employee_id,date", ignoreDuplicates: true })
    .select("id");
  if (error) return { error: error.message } as const;
  if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" } as const;

  revalidatePath("/staff");
  return { ok: true, count: data.length } as const;
}

export async function moveAttendance(
  fromEmp: string,
  fromDate: string,
  toEmp: string,
  toDate: string
) {
  const uuid = z.string().uuid();
  const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
  if (
    !uuid.safeParse(fromEmp).success ||
    !uuid.safeParse(toEmp).success ||
    !day.safeParse(fromDate).success ||
    !day.safeParse(toDate).success
  ) {
    return { error: "არასწორი მონაცემი" };
  }
  if (fromEmp === toEmp && fromDate === toDate) return { ok: true };

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("attendance")
    .select("id, employee_id, date, shift_type, hours, status, note")
    .or(
      `and(employee_id.eq.${fromEmp},date.eq.${fromDate}),and(employee_id.eq.${toEmp},date.eq.${toDate})`
    );
  if (error) return { error: error.message };

  const src = rows?.find((r) => r.employee_id === fromEmp && r.date === fromDate);
  const dst = rows?.find((r) => r.employee_id === toEmp && r.date === toDate);
  if (!src) return { error: "გადასატანი ჩანაწერი ვერ მოიძებნა" };

  const pick = (r: NonNullable<typeof src>) => ({
    shift_type: r.shift_type,
    hours: r.hours,
    status: r.status,
    note: r.note,
  });

  const payload = [{ employee_id: toEmp, date: toDate, ...pick(src) }];
  // თუ სამიზნე უჯრა დაკავებულია, ადგილებს ვუცვლით
  if (dst) payload.push({ employee_id: fromEmp, date: fromDate, ...pick(dst) });

  const { data, error: upErr } = await supabase
    .from("attendance")
    .upsert(payload, { onConflict: "employee_id,date" })
    .select("id");
  if (upErr) return { error: "ვერ გადავიდა: " + upErr.message };
  if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" };

  if (!dst) {
    const { error: delErr } = await supabase.from("attendance").delete().eq("id", src.id);
    if (delErr) return { error: delErr.message };
  }

  revalidatePath("/staff");
  return { ok: true };
}