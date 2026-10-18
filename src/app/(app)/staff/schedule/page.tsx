import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { monthNames } from "@/lib/labels";
import type { Employee } from "../employee-form";
import type { Rec } from "../attendance-grid";
import { ScheduleEditor } from "./schedule-editor";

type SearchParams = Promise<{ ym?: string }>;

const order = ["assistant", "security", "housekeeper", "groundskeeper", "gardener", "other"];

async function Content({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const sp = await searchParams;

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tbilisi" });
  const ym = /^\d{4}-\d{2}$/.test(sp.ym ?? "") ? (sp.ym as string) : today.slice(0, 7);
  const [year, month] = ym.split("-").map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const supabase = await createClient();
  const [{ data: empData }, { data: recData }, { data: rosterData }] = await Promise.all([
    supabase.from("employees").select("id, full_name, position, phone, is_active"),
    supabase
      .from("attendance")
      .select("employee_id, date, shift_type, hours, status, note")
      .gte("date", `${ym}-01`)
      .lte("date", `${ym}-${String(days).padStart(2, "0")}`),
    supabase.from("attendance_roster").select("employee_id").eq("ym", ym),
  ]);

  const records = (recData ?? []) as Rec[];
  const withRecords = new Set(records.map((r) => r.employee_id));
  const rosterIds = new Set((rosterData ?? []).map((r) => r.employee_id as string));
  const hasRoster = rosterIds.size > 0;

  const employees = ((empData ?? []) as Employee[])
    .filter(
      (e) =>
        e.position !== "manager" &&
        (withRecords.has(e.id) || (hasRoster ? rosterIds.has(e.id) : e.is_active))
    )
    .sort(
      (a, b) =>
        order.indexOf(a.position) - order.indexOf(b.position) ||
        a.full_name.localeCompare(b.full_name, "ka")
    )
    .map((e) => ({ id: e.id, full_name: e.full_name }));

  return (
    <>
      <PageHeader
        title="გრაფიკის გენერატორი"
        description={`${monthNames[month - 1]} ${year}`}
      />
      <ScheduleEditor
        key={ym}
        ym={ym}
        employees={employees}
        records={records}
        year={year}
        month={month}
        days={days}
        today={today}
      />
    </>
  );
}

export default function SchedulePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">იტვირთება...</div>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}