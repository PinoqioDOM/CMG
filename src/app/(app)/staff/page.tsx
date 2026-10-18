import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { monthNames } from "@/lib/labels";
import { EmployeeForm, type Employee } from "./employee-form";
import { BulkAddForm } from "./bulk-add-form";
import { EmployeeList } from "./employee-list";
import { AttendanceGrid, type Emp, type Rec } from "./attendance-grid";
import { ContinueButton } from "./continue-button";
import { AddToRoster } from "./roster-controls";
import { ScheduleGenerator, type Pattern } from "./schedule-generator";
import { ClearMonthButton } from "./clear-month-button";

type SearchParams = Promise<{ tab?: string; ym?: string }>;

const order = ["manager", "assistant", "security", "housekeeper", "groundskeeper", "gardener", "other"];
const tabCls = (active: boolean) =>
  `rounded-md px-3 py-2 text-sm ${active ? "bg-muted font-medium" : "text-muted-foreground"}`;
const pillCls = "rounded-md border px-3 py-2 text-sm";

function shift(ym: string, d: number) {
  const [y, m] = ym.split("-").map(Number);
  const t = y * 12 + (m - 1) + d;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

async function Content({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const sp = await searchParams;
  const tab = sp.tab === "employees" ? "employees" : "attendance";

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tbilisi" });
  const nowYM = today.slice(0, 7);
  const ym = /^\d{4}-\d{2}$/.test(sp.ym ?? "") ? (sp.ym as string) : nowYM;
  const [year, month] = ym.split("-").map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const supabase = await createClient();
  const { data: empData } = await supabase
    .from("employees")
    .select("id, full_name, position, phone, is_active");
  const employees = ((empData ?? []) as Employee[]).sort(
    (a, b) =>
      order.indexOf(a.position) - order.indexOf(b.position) ||
      a.full_name.localeCompare(b.full_name, "ka")
  );

  const tabs = (
    <div className="mb-4 flex gap-1">
      <Link href={`/staff?ym=${ym}`} className={tabCls(tab === "attendance")}>
        დასწრება
      </Link>
      <Link href={`/staff?tab=employees&ym=${ym}`} className={tabCls(tab === "employees")}>
        თანამშრომლები
      </Link>
    </div>
  );

  if (tab === "employees") {
    return (
      <>
        <PageHeader
          title="პერსონალი"
          action={
            <div className="flex flex-wrap gap-2">
              <BulkAddForm />
              <EmployeeForm />
            </div>
          }
        />
        {tabs}
        <EmployeeList employees={employees} />
      </>
    );
  }

  const [{ data: recData }, { data: rosterData }, { data: patData }] = await Promise.all([
    supabase
      .from("attendance")
      .select("employee_id, date, shift_type, hours, status, note")
      .gte("date", `${ym}-01`)
      .lte("date", `${ym}-${String(days).padStart(2, "0")}`),
    supabase.from("attendance_roster").select("employee_id").eq("ym", ym),
    supabase.from("schedule_patterns").select("employee_id, pattern"),
  ]);

  const records = (recData ?? []) as Rec[];
  const withRecords = new Set(records.map((r) => r.employee_id));
  const rosterIds = new Set((rosterData ?? []).map((r) => r.employee_id as string));
  const hasRoster = rosterIds.size > 0;

  const shownEmployees = employees.filter(
    (e) =>
      e.position !== "manager" &&
      (withRecords.has(e.id) || (hasRoster ? rosterIds.has(e.id) : e.is_active))
  );
  const shown: Emp[] = shownEmployees.map((e) => ({
    id: e.id,
    full_name: e.full_name,
    position: e.position,
    is_active: e.is_active,
  }));
  const shownIds = new Set(shown.map((e) => e.id));
  const candidates = employees
    .filter((e) => e.is_active && e.position !== "manager" && !shownIds.has(e.id))
    .map((e) => ({ id: e.id, full_name: e.full_name }));

  const patterns: Record<string, Pattern> = {};
  (patData ?? []).forEach((p) => {
    patterns[p.employee_id as string] = p.pattern as Pattern;
  });

  return (
    <>
      <PageHeader title="პერსონალი" description="დასწრება და ცვლები" />
      {tabs}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/staff?ym=${shift(ym, -1)}`} className={pillCls}>
          ←
        </Link>
        <div className="min-w-40 text-center font-semibold">
          {monthNames[month - 1]} {year}
        </div>
        <Link href={`/staff?ym=${shift(ym, 1)}`} className={pillCls}>
          →
        </Link>
        {ym !== nowYM && (
          <Link href="/staff" className="px-2 text-sm text-muted-foreground underline">
            დღეს
          </Link>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={`/staff/schedule?ym=${ym}`}
          className="inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          გრაფიკის გენერატორი
        </Link>
        <ScheduleGenerator
          key={`${ym}-${shown.map((e) => e.id).join(",")}`}
          ym={ym}
          employees={shown.map((e) => ({ id: e.id, full_name: e.full_name }))}
          patterns={patterns}
        />
        <AddToRoster ym={ym} candidates={candidates} />
        <ContinueButton year={year} month={month} />
        <ClearMonthButton ym={ym} label={`${monthNames[month - 1]} ${year}`} />
      </div>

      <AttendanceGrid
        key={ym}
        employees={shown}
        records={records}
        year={year}
        month={month}
        days={days}
        today={today}
      />
    </>
  );
}

export default function StaffPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">იტვირთება...</div>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}