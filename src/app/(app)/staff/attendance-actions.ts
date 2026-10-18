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
    .eq("is_active", true)
    .neq("position", "manager");
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

// ---------- თვის შემადგენლობა ----------
async function ensureRoster(supabase: Awaited<ReturnType<typeof createClient>>, ym: string) {
  const { count } = await supabase
    .from("attendance_roster")
    .select("employee_id", { count: "exact", head: true })
    .eq("ym", ym);
  if ((count ?? 0) > 0) return;

  const [y, m] = ym.split("-").map(Number);
  const last = String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0");
  const [{ data: act }, { data: rec }] = await Promise.all([
    supabase.from("employees").select("id").eq("is_active", true).neq("position", "manager"),
    supabase
      .from("attendance")
      .select("employee_id")
      .gte("date", `${ym}-01`)
      .lte("date", `${ym}-${last}`),
  ]);
  const ids = new Set([...(act ?? []).map((e) => e.id), ...(rec ?? []).map((r) => r.employee_id)]);
  if (ids.size > 0) {
    await supabase
      .from("attendance_roster")
      .upsert(
        Array.from(ids).map((employee_id) => ({ ym, employee_id })),
        { onConflict: "ym,employee_id", ignoreDuplicates: true }
      );
  }
}

const ymRe = /^\d{4}-\d{2}$/;

export async function addToRoster(ym: string, ids: string[]) {
  const y = z.string().regex(ymRe).safeParse(ym);
  const list = z.array(z.string().uuid()).min(1).max(100).safeParse(ids);
  if (!y.success || !list.success) return { error: "არასწორი მონაცემი" };

  const supabase = await createClient();
  await ensureRoster(supabase, y.data);
  const { data, error } = await supabase
    .from("attendance_roster")
    .upsert(
      list.data.map((employee_id) => ({ ym: y.data, employee_id })),
      { onConflict: "ym,employee_id" }
    )
    .select("employee_id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" };

  revalidatePath("/staff");
  return { ok: true };
}

export async function removeFromRoster(ym: string, employeeId: string) {
  const y = z.string().regex(ymRe).safeParse(ym);
  const e = z.string().uuid().safeParse(employeeId);
  if (!y.success || !e.success) return { error: "არასწორი მონაცემი" };

  const [yy, mm] = y.data.split("-").map(Number);
  const last = String(new Date(Date.UTC(yy, mm, 0)).getUTCDate()).padStart(2, "0");

  const supabase = await createClient();
  await ensureRoster(supabase, y.data);

  const { error: re } = await supabase
    .from("attendance_roster")
    .delete()
    .eq("ym", y.data)
    .eq("employee_id", e.data);
  if (re) return { error: re.message };

  const { error: ae } = await supabase
    .from("attendance")
    .delete()
    .eq("employee_id", e.data)
    .gte("date", `${y.data}-01`)
    .lte("date", `${y.data}-${last}`);
  if (ae) return { error: ae.message };

  revalidatePath("/staff");
  return { ok: true };
}

// ---------- გრაფიკის გენერატორი ----------
const dayRe = /^\d{4}-\d{2}-\d{2}$/;
const kinds = ["24h", "day", "night", "regular"] as const;

const patternSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("cycle"),
    every: z.coerce.number().int().min(1).max(31),
    ref: z.string().regex(dayRe),
    kind: z.enum(kinds),
    hours: z.coerce.number().min(0).max(24).optional(),
  }),
  z.object({
    type: z.literal("weekly"),
    hours: z.array(z.coerce.number().min(0).max(24)).length(7),
  }),
]);

const genSchema = z.object({
  ym: z.string().regex(ymRe),
  overwrite: z.boolean(),
  items: z
    .array(z.object({ employee_id: z.string().uuid(), pattern: patternSchema.nullable() }))
    .max(100),
});

function shiftOf(kind: string, hours?: number): [string, number] | null {
  if (kind === "24h") return ["24h", 24];
  if (kind === "day") return ["day", 12];
  if (kind === "night") return ["night", 12];
  if (!hours || hours <= 0) return null;
  return ["regular", hours];
}

export async function generateSchedule(input: unknown) {
  const parsed = genSchema.safeParse(input);
  if (!parsed.success) return { error: "არასწორი მონაცემი" } as const;
  const v = parsed.data;

  const [y, m] = v.ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const rows: {
    employee_id: string;
    date: string;
    shift_type: string;
    hours: number;
    status: string;
    note: null;
  }[] = [];

  for (const it of v.items) {
    const p = it.pattern;
    if (!p) continue;
    if (p.type === "cycle" && p.kind === "regular" && !p.hours) {
      return { error: "ციკლისთვის მიუთითე საათები" } as const;
    }
    const [ry, rm, rd] = p.type === "cycle" ? p.ref.split("-").map(Number) : [0, 0, 0];

    for (let d = 1; d <= last; d++) {
      const ts = Date.UTC(y, m - 1, d);
      let shift: [string, number] | null = null;

      if (p.type === "cycle") {
        const diff = Math.round((ts - Date.UTC(ry, rm - 1, rd)) / 86400000);
        if (((diff % p.every) + p.every) % p.every === 0) shift = shiftOf(p.kind, p.hours);
      } else {
        const h = p.hours[new Date(ts).getUTCDay()];
        if (h > 0) shift = h === 24 ? ["24h", 24] : h === 12 ? ["day", 12] : ["regular", h];
      }
      if (!shift) continue;

      rows.push({
        employee_id: it.employee_id,
        date: `${v.ym}-${String(d).padStart(2, "0")}`,
        shift_type: shift[0],
        hours: shift[1],
        status: "present",
        note: null,
      });
    }
  }

  const supabase = await createClient();

  // თვის ცხრილში გამოჩნდნენ
  const ids = v.items.map((i) => i.employee_id);
  if (ids.length) {
    const r = await addToRoster(v.ym, ids);
    if ("error" in r && r.error) return { error: r.error } as const;
  }

  let count = 0;
  if (rows.length > 0) {
    const { data, error } = await supabase
      .from("attendance")
      .upsert(rows, { onConflict: "employee_id,date", ignoreDuplicates: !v.overwrite })
      .select("id");
    if (error) return { error: "ვერ შეინახა: " + error.message } as const;
    count = data?.length ?? 0;
  }

  // წესების შენახვა მომდევნო თვეებისთვის
  const withPattern = v.items.filter((i) => i.pattern);
  if (withPattern.length) {
    await supabase.from("schedule_patterns").upsert(
      withPattern.map((i) => ({
        employee_id: i.employee_id,
        pattern: i.pattern,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "employee_id" }
    );
  }
  const cleared = v.items.filter((i) => !i.pattern).map((i) => i.employee_id);
  if (cleared.length) {
    await supabase.from("schedule_patterns").delete().in("employee_id", cleared);
  }

  revalidatePath("/staff");
  return { ok: true, count } as const;
}

// ---------- თვის გრაფიკის წაშლა ----------
export async function clearMonth(ym: string) {
  const y = z.string().regex(ymRe).safeParse(ym);
  if (!y.success) return { error: "არასწორი თვე" } as const;

  const [yy, mm] = y.data.split("-").map(Number);
  const last = String(new Date(Date.UTC(yy, mm, 0)).getUTCDate()).padStart(2, "0");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attendance")
    .delete()
    .gte("date", `${y.data}-01`)
    .lte("date", `${y.data}-${last}`)
    .select("id");
  if (error) return { error: error.message } as const;

  revalidatePath("/staff");
  return { ok: true, count: data?.length ?? 0 } as const;
}

// ---------- გენერატორის (ცხრილის) შენახვა ----------
const saveSchema = z.object({
  ym: z.string().regex(ymRe),
  changes: z
    .array(
      z.object({
        employee_id: z.string().uuid(),
        date: z.string().regex(dayRe),
        kind: z
          .enum(["24h", "day", "night", "regular", "day_off", "vacation", "absent"])
          .nullable(),
        hours: z.coerce.number().min(0.5).max(24).optional(),
      })
    )
    .max(2000),
});

export async function saveSchedule(input: unknown) {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { error: "არასწორი მონაცემი" } as const;
  const { ym, changes } = parsed.data;

  const upserts: {
    employee_id: string;
    date: string;
    shift_type: string | null;
    hours: number | null;
    status: string;
    note: null;
  }[] = [];
  const deletes = new Map<string, string[]>();

  for (const c of changes) {
    if (!c.date.startsWith(ym)) continue;
    if (c.kind === null) {
      deletes.set(c.employee_id, [...(deletes.get(c.employee_id) ?? []), c.date]);
      continue;
    }
    let shift_type: string | null = null;
    let hours: number | null = null;
    let status = "present";
    if (c.kind === "24h") [shift_type, hours] = ["24h", 24];
    else if (c.kind === "day") [shift_type, hours] = ["day", 12];
    else if (c.kind === "night") [shift_type, hours] = ["night", 12];
    else if (c.kind === "regular") {
      if (!c.hours) return { error: "მიუთითე საათები" } as const;
      [shift_type, hours] = ["regular", c.hours];
    } else status = c.kind;

    upserts.push({ employee_id: c.employee_id, date: c.date, shift_type, hours, status, note: null });
  }

  const supabase = await createClient();

  if (upserts.length > 0) {
    const { data, error } = await supabase
      .from("attendance")
      .upsert(upserts, { onConflict: "employee_id,date" })
      .select("id");
    if (error) return { error: "ვერ შეინახა: " + error.message } as const;
    if (!data || data.length === 0) return { error: "ცვლილების უფლება არ გაქვს" } as const;
  }

  const results = await Promise.all(
    Array.from(deletes.entries()).map(([employee_id, dates]) =>
      supabase.from("attendance").delete().eq("employee_id", employee_id).in("date", dates)
    )
  );
  const bad = results.find((r) => r.error);
  if (bad?.error) return { error: bad.error.message } as const;

  revalidatePath("/staff");
  return { ok: true, saved: upserts.length, removed: Array.from(deletes.values()).flat().length } as const;
}