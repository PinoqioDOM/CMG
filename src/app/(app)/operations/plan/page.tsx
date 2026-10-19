import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { monthNames } from "@/lib/labels";
import { PlanBoard, type PlanTask } from "./plan-board";

type SearchParams = Promise<{ ym?: string }>;

type Row = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: PlanTask["status"];
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
  employees: { full_name: string } | { full_name: string }[] | null;
};

const iso = (ts: number) => new Date(ts).toISOString().slice(0, 10);
const tabCls = (active: boolean) =>
  `rounded-md px-3 py-2 text-sm ${active ? "bg-muted font-medium" : "text-muted-foreground"}`;
const pillCls = "rounded-md border px-3 py-2 text-sm";

function shift(ym: string, d: number) {
  const [y, m] = ym.split("-").map(Number);
  const t = y * 12 + (m - 1) + d;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

const select =
  "id, title, description, category, status, priority, due_date, assigned_to, employees(full_name)";

function toTask(r: Row): PlanTask {
  const emp = Array.isArray(r.employees) ? r.employees[0] : r.employees;
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    status: r.status,
    priority: r.priority,
    due_date: r.due_date,
    assigned_to: r.assigned_to,
    assignee: emp?.full_name ?? null,
  };
}

async function Content({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const sp = await searchParams;

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tbilisi" });
  const nowYM = today.slice(0, 7);
  const ym = /^\d{4}-\d{2}$/.test(sp.ym ?? "") ? (sp.ym as string) : nowYM;
  const [y, m] = ym.split("-").map(Number);

  // კვირები ორშაბათიდან კვირამდე, რომ მთელი თვე დაიფაროს
  const firstTs = Date.UTC(y, m - 1, 1);
  const lastTs = Date.UTC(y, m, 0);
  const startTs = firstTs - ((new Date(firstTs).getUTCDay() + 6) % 7) * 86400000;
  const endTs = lastTs + (6 - ((new Date(lastTs).getUTCDay() + 6) % 7)) * 86400000;

  const weeks: string[][] = [];
  for (let ts = startTs; ts <= endTs; ts += 7 * 86400000) {
    weeks.push(Array.from({ length: 7 }, (_, i) => iso(ts + i * 86400000)));
  }

  const supabase = await createClient();
  const [{ data: dated }, { data: undated }, { data: emps }] = await Promise.all([
    supabase
      .from("tasks")
      .select(select)
      .gte("due_date", iso(startTs))
      .lte("due_date", iso(endTs))
      .limit(800),
    supabase
      .from("tasks")
      .select(select)
      .is("due_date", null)
      .neq("status", "done")
      .limit(200),
    supabase.from("employees").select("id, full_name").eq("is_active", true).order("full_name"),
  ]);

  const tasks = [
    ...((dated ?? []) as unknown as Row[]),
    ...((undated ?? []) as unknown as Row[]),
  ].map(toTask);

  return (
    <>
      <PageHeader title="კვირის გეგმა" description={`${monthNames[m - 1]} ${y}`} />

      <div className="mb-4 flex gap-1">
        <Link href="/operations/plan" className={tabCls(true)}>
          კვირის გეგმა
        </Link>
        <Link href="/operations" className={tabCls(false)}>
          დაფა
        </Link>
        <Link href="/operations?tab=incidents" className={tabCls(false)}>
          ტექნიკური რეპორტი
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/operations/plan?ym=${shift(ym, -1)}`} className={pillCls}>
          ←
        </Link>
        <div className="min-w-44 text-center font-semibold">
          {monthNames[m - 1]} {y}
        </div>
        <Link href={`/operations/plan?ym=${shift(ym, 1)}`} className={pillCls}>
          →
        </Link>
        {ym !== nowYM && (
          <Link href="/operations/plan" className="px-2 text-sm text-muted-foreground underline">
            დღეს
          </Link>
        )}
      </div>

      <PlanBoard
        key={ym}
        ym={ym}
        weeks={weeks}
        tasks={tasks}
        employees={(emps ?? []) as { id: string; full_name: string }[]}
        today={today}
      />
    </>
  );
}

export default function PlanPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">იტვირთება...</div>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}