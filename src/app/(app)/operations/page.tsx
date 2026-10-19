import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Kanban, type Task } from "./kanban";
import { TaskForm } from "./task-form";
import { IncidentForm } from "./incident-form";
import { IncidentList, type Incident } from "./incident-list";

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: Task["status"];
  priority: string;
  due_date: string | null;
  employees: { full_name: string } | { full_name: string }[] | null;
};

type SearchParams = Promise<{ tab?: string; status?: string; q?: string }>;

const tabCls = (active: boolean) =>
  `rounded-md px-3 py-2 text-sm ${active ? "bg-muted font-medium" : "text-muted-foreground"}`;

async function Content({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const sp = await searchParams;
  const isIncidents = sp.tab === "incidents";
  const q = (sp.q ?? "").trim();
  const safeQ = q.replace(/[,()%*\\"]/g, " ").trim();
  // ძიებისას, თუ სტატუსი არ აურჩევიათ, ვეძებთ ყველაში
  const status = sp.status ?? (safeQ ? "all" : "active");

  const supabase = await createClient();

  const { data: employees } = await supabase
    .from("employees")
    .select("id, full_name")
    .eq("is_active", true)
    .order("full_name");

  let tasks: Task[] = [];
  let incidents: Incident[] = [];
  const photoUrls: Record<string, string> = {};

  if (isIncidents) {
    let query = supabase
      .from("incidents")
      .select("id, title, description, location, performer, status, priority, created_at, photo_url")
      .order("created_at", { ascending: false })
      .limit(500);

    if (status === "active") query = query.in("status", ["open", "in_progress"]);
    else if (status === "resolved") query = query.eq("status", "resolved");

    if (safeQ) {
      const p = `"%${safeQ}%"`;
      query = query.or(
        `title.ilike.${p},description.ilike.${p},location.ilike.${p},performer.ilike.${p}`
      );
    }

    const { data } = await query;
    incidents = (data ?? []) as Incident[];

    const paths = incidents.map((i) => i.photo_url).filter((p): p is string => !!p);
    if (paths.length) {
      const { data: signed } = await supabase.storage.from("photos").createSignedUrls(paths, 3600);
      signed?.forEach((s) => {
        if (s.path && s.signedUrl) photoUrls[s.path] = s.signedUrl;
      });
    }
  } else {
    const { data } = await supabase
      .from("tasks")
      .select("id, title, description, category, status, priority, due_date, employees(full_name)")
      .order("created_at", { ascending: false })
      .limit(200);
    tasks = ((data ?? []) as unknown as TaskRow[]).map((t) => {
      const emp = Array.isArray(t.employees) ? t.employees[0] : t.employees;
      return {
        id: t.id,
        title: t.title,
        description: t.description,
        category: t.category,
        status: t.status,
        priority: t.priority,
        due_date: t.due_date,
        assignee: emp?.full_name ?? null,
      };
    });
  }

  const qParam = q ? `&q=${encodeURIComponent(q)}` : "";

  return (
    <>
      <PageHeader
        title="კვირის გეგმა"
        action={isIncidents ? <IncidentForm /> : <TaskForm employees={employees ?? []} />}
      />

      <div className="mb-4 flex gap-1">
        <Link href="/operations/plan" className={tabCls(false)}>
          კვირის გეგმა
        </Link>
        <Link href="/operations" className={tabCls(!isIncidents)}>
          დაფა
        </Link>
        <Link href="/operations?tab=incidents" className={tabCls(isIncidents)}>
          ტექნიკური რეპორტი
        </Link>
      </div>

      {isIncidents ? (
        <>
          <form action="/operations" method="get" className="mb-3 flex gap-2">
            <input type="hidden" name="tab" value="incidents" />
            {sp.status && <input type="hidden" name="status" value={sp.status} />}
            <Input
              name="q"
              defaultValue={q}
              placeholder="ძიება: სათაური, აღწერა, ადგილი, შემსრულებელი..."
              className="h-11"
            />
            <Button type="submit" className="h-11">
              ძიება
            </Button>
            {q && (
              <Link
                href={`/operations?tab=incidents${sp.status ? `&status=${sp.status}` : ""}`}
                className="flex h-11 items-center px-2 text-sm text-muted-foreground underline"
              >
                გასუფთავება
              </Link>
            )}
          </form>

          <div className="mb-4 flex items-center gap-1">
            {[
              ["active", "აქტიური"],
              ["resolved", "გადაწყვეტილი"],
              ["all", "ყველა"],
            ].map(([value, label]) => (
              <Link
                key={value}
                href={`/operations?tab=incidents&status=${value}${qParam}`}
                className={tabCls(status === value)}
              >
                {label}
              </Link>
            ))}
            <span className="ml-auto text-sm text-muted-foreground">
              {incidents.length} შედეგი
            </span>
          </div>

          <IncidentList incidents={incidents} photoUrls={photoUrls} />
        </>
      ) : (
        <Kanban tasks={tasks} />
      )}
    </>
  );
}

export default function OperationsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">იტვირთება...</div>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}