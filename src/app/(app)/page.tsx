import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { monthNames, positionLabels } from "@/lib/labels";

const money = (n: number) => `${(Math.round(n * 100) / 100).toFixed(2)} ₾`;
const dmy = (s: string) => s.split("-").reverse().join(".");
const dayDiff = (a: string, b: string) => {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y1, m1 - 1, d1) - Date.UTC(y2, m2 - 1, d2)) / 86400000);
};
const addDays = (s: string, n: number) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * 86400000).toISOString().slice(0, 10);
};

const shiftLabels: Record<string, string> = {
  "24h": "24 სთ",
  night: "ღამე",
  day: "დღე",
  regular: "სამუშაო დღე",
};
const shiftOrder = ["24h", "night", "day", "regular"];

type Pay = {
  property_id: string;
  year: number;
  month: number;
  amount_due: number;
  amount_paid: number;
  balance: number;
};
type Att = {
  employee_id: string;
  shift_type: string | null;
  hours: number | null;
  status: string;
};
type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
};
type Incident = {
  id: string;
  title: string;
  location: string | null;
  status: string;
  priority: string;
  created_at: string;
};
type DocRow = { id: string; title: string; folder_name: string; expires_at: string };

function Card({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="block space-y-3 rounded-lg border p-4 hover:bg-muted/40">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-sm text-muted-foreground">→</span>
      </div>
      {children}
    </Link>
  );
}

function Big({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <div>
      <div className={`text-2xl font-bold ${tone ?? ""}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

async function Content() {
  await connection();
  const supabase = await createClient();

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tbilisi" });
  const [cy, cm] = today.split("-").map(Number);
  const plus30 = addDays(today, 30);

  const [
    { data: curPays },
    { data: debtRows },
    { data: props },
    { data: att },
    { data: emps },
    { data: tasks },
    { count: incCount },
    { data: incs },
    { data: docs },
    { data: tpl },
    { data: logs },
  ] = await Promise.all([
    supabase.from("payments_view").select("*").eq("year", cy).eq("month", cm),
    supabase.from("payments_view").select("*").gt("balance", 0).limit(3000),
    supabase.from("properties").select("id, number"),
    supabase
      .from("attendance")
      .select("employee_id, shift_type, hours, status")
      .eq("date", today),
    supabase.from("employees").select("id, full_name"),
    supabase
      .from("tasks")
      .select("id, title, status, priority, due_date")
      .neq("status", "done")
      .limit(200),
    supabase
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "in_progress"]),
    supabase
      .from("incidents")
      .select("id, title, location, status, priority, created_at")
      .in("status", ["open", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("documents")
      .select("id, title, folder_name, expires_at")
      .not("expires_at", "is", null)
      .lte("expires_at", plus30)
      .order("expires_at")
      .limit(8),
    supabase
      .from("checklist_templates")
      .select("id, position")
      .eq("frequency", "daily")
      .eq("is_active", true),
    supabase.from("checklist_logs").select("template_id").eq("done_date", today),
  ]);

  // ---------- ფინანსები ----------
  const propName = new Map((props ?? []).map((p) => [p.id, p.number as string]));
  const cur = (curPays ?? []) as Pay[];
  const curDue = cur.reduce((s, p) => s + p.amount_due, 0);
  const curPaid = cur.reduce((s, p) => s + p.amount_paid, 0);

  const past = ((debtRows ?? []) as Pay[]).filter(
    (p) => p.year * 100 + p.month < cy * 100 + cm
  );
  const debtByProp = new Map<string, { total: number; months: number }>();
  past.forEach((p) => {
    const g = debtByProp.get(p.property_id) ?? { total: 0, months: 0 };
    g.total += p.balance;
    g.months += 1;
    debtByProp.set(p.property_id, g);
  });
  const debtors = Array.from(debtByProp.entries())
    .map(([id, g]) => ({ id, ...g }))
    .sort((a, b) => b.total - a.total);
  const totalDebt = debtors.reduce((s, d) => s + d.total, 0);

  // ---------- დღევანდელი ცვლა ----------
  const empName = new Map((emps ?? []).map((e) => [e.id, e.full_name as string]));
  const attRows = (att ?? []) as Att[];
  const working = attRows.filter((a) => a.status === "present");
  const offRows = attRows.filter((a) => a.status !== "present");
  const groups = shiftOrder
    .map((k) => ({
      key: k,
      list: working.filter((a) => (a.shift_type ?? "regular") === k),
    }))
    .filter((g) => g.list.length > 0);

  // ---------- დავალებები ----------
  const taskRows = (tasks ?? []) as Task[];
  const todo = taskRows.filter((t) => t.status === "todo").length;
  const inProgress = taskRows.filter((t) => t.status === "in_progress").length;
  const overdueTasks = taskRows.filter((t) => t.due_date && t.due_date < today).length;
  const topTasks = [...taskRows]
    .sort((a, b) => {
      const ao = a.due_date && a.due_date < today ? 0 : 1;
      const bo = b.due_date && b.due_date < today ? 0 : 1;
      if (ao !== bo) return ao - bo;
      const ap = a.priority === "high" ? 0 : 1;
      const bp = b.priority === "high" ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
    })
    .slice(0, 5);

  // ---------- დოკუმენტები ----------
  const docRows = (docs ?? []) as DocRow[];
  const expiredDocs = docRows.filter((d) => d.expires_at < today).length;

  // ---------- ჩეკლისტი ----------
  const doneIds = new Set((logs ?? []).map((l) => l.template_id));
  const checklist = (["housekeeper", "groundskeeper", "gardener"] as const).map((r) => {
    const ids = (tpl ?? []).filter((t) => t.position === r).map((t) => t.id);
    return { role: r, total: ids.length, done: ids.filter((id) => doneIds.has(id)).length };
  });

  const incidents = (incs ?? []) as Incident[];

  return (
    <>
      <PageHeader
        title="მთავარი"
        description={`${dmy(today)} · ${monthNames[cm - 1]} ${cy}`}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* ფინანსები */}
        <Card title="ფინანსები" href="/finance">
          <div className="grid grid-cols-3 gap-3">
            <Big value={money(curDue)} label="ამ თვეში" />
            <Big value={money(curPaid)} label="გადახდილი" tone="text-green-700" />
            <Big
              value={money(totalDebt)}
              label="ვადაგადაცილებული"
              tone={totalDebt > 0 ? "text-red-600" : ""}
            />
          </div>
          {debtors.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {debtors.slice(0, 4).map((d) => (
                <li key={d.id} className="flex justify-between">
                  <span>
                    {propName.get(d.id)} <span className="text-muted-foreground">· {d.months} თვე</span>
                  </span>
                  <b className="text-red-600">{money(d.total)}</b>
                </li>
              ))}
              {debtors.length > 4 && (
                <li className="text-muted-foreground">+ კიდევ {debtors.length - 4} ობიექტი</li>
              )}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">ვადაგადაცილებული გადახდა არ არის 🎉</p>
          )}
        </Card>

        {/* დღევანდელი ცვლა */}
        <Card title="დღევანდელი ცვლა" href="/staff">
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">დღეს ცვლა მონიშნული არ არის</p>
          ) : (
            <div className="space-y-2 text-sm">
              {groups.map((g) => (
                <div key={g.key}>
                  <div className="text-xs text-muted-foreground">{shiftLabels[g.key]}</div>
                  <div className="font-medium">
                    {g.list.map((a) => empName.get(a.employee_id) ?? "—").join(", ")}
                  </div>
                </div>
              ))}
            </div>
          )}
          {offRows.length > 0 && (
            <p className="text-xs text-muted-foreground">
              არ არის: {offRows.length} (დასვენება/შვებულება/გაცდენა)
            </p>
          )}
        </Card>

        {/* დავალებები */}
        <Card title="ღია დავალებები" href="/operations">
          <div className="grid grid-cols-3 gap-3">
            <Big value={String(todo)} label="გასაკეთებელი" />
            <Big value={String(inProgress)} label="მიმდინარე" />
            <Big
              value={String(overdueTasks)}
              label="ვადაგასული"
              tone={overdueTasks > 0 ? "text-red-600" : ""}
            />
          </div>
          {topTasks.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {topTasks.map((t) => (
                <li key={t.id} className="flex justify-between gap-2">
                  <span className="line-clamp-1">{t.title}</span>
                  <span
                    className={`whitespace-nowrap text-xs ${
                      t.due_date && t.due_date < today ? "text-red-600" : "text-muted-foreground"
                    }`}
                  >
                    {t.due_date ? dmy(t.due_date) : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">ღია დავალება არ არის</p>
          )}
        </Card>

        {/* ინციდენტები */}
        <Card title="ღია ინციდენტები" href="/operations?tab=incidents">
          <Big
            value={String(incCount ?? 0)}
            label="აქტიური"
            tone={(incCount ?? 0) > 0 ? "text-amber-600" : ""}
          />
          {incidents.length > 0 && (
            <ul className="space-y-1 text-sm">
              {incidents.map((i) => (
                <li key={i.id} className="flex justify-between gap-2">
                  <span className="line-clamp-1">{i.title}</span>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {i.location ?? ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* დოკუმენტები */}
        <Card title="ხელშეკრულებებისა და დოკუმენტების ვადები" href="/documents?exp=1">
          {docRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">30 დღეში ვადა არავის გასდის</p>
          ) : (
            <>
              <Big
                value={String(expiredDocs)}
                label="ვადაგასული"
                tone={expiredDocs > 0 ? "text-red-600" : ""}
              />
              <ul className="space-y-1 text-sm">
                {docRows.slice(0, 5).map((d) => {
                  const left = dayDiff(d.expires_at, today);
                  return (
                    <li key={d.id} className="flex justify-between gap-2">
                      <span className="line-clamp-1">{d.title}</span>
                      <span
                        className={`whitespace-nowrap text-xs ${
                          left < 0 ? "text-red-600" : "text-amber-600"
                        }`}
                      >
                        {left < 0 ? "ვადა გაუვიდა" : `${left} დღე`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>

        {/* ჩეკლისტი */}
        <Card title="დღევანდელი დასუფთავების გეგმა" href="/services">
          <div className="space-y-3">
            {checklist.map((c) => (
              <div key={c.role}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{positionLabels[c.role]}</span>
                  <span className="text-muted-foreground">
                    {c.done} / {c.total}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded bg-muted">
                  <div
                    className="h-full bg-green-500"
                    style={{ width: `${c.total ? (c.done / c.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">იტვირთება...</div>}>
      <Content />
    </Suspense>
  );
}