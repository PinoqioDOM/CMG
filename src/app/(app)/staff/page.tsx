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

type SearchParams = Promise<{ tab?: string; ym?: string }>;

const order = ["security", "housekeeper", "groundskeeper", "gardener", "other"];
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
            <div className="flex gap-2">
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

  const { data: recData } = await supabase
    .from("attendance")
    .select("employee_id, date, shift_type, hours, status, note")
    .gte("date", `${ym}-01`)
    .lte("date", `${ym}-${String(days).padStart(2, "0")}`);
  const records = (recData ?? []) as Rec[];
  const withRecords = new Set(records.map((r) => r.employee_id));
  const shown: Emp[] = employees
    .filter((e) => e.is_active || withRecords.has(e.id))
    .map((e) => ({ id: e.id, full_name: e.full_name, position: e.position, is_active: e.is_active }));

  return (
    <>
      <PageHeader title="პერსონალი" description="დასწრება და ცვლები" />
      {tabs}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/staff?ym=${shift(ym, -1)}`} className={pillCls}>
          ←
        </Link>
        <div className="min-w-44 text-center font-semibold">
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
        <div className="ml-auto">
          <ContinueButton year={year} month={month} />
        </div>
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