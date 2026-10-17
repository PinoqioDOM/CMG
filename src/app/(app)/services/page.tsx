import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { monthNames, positionLabels } from "@/lib/labels";
import { dm, dmy, monthRange, periodTitle, weekRange } from "@/lib/plan";
import { Checklist, type Item } from "./checklist";
import { ClosePlanButtons } from "./close-plan-buttons";
import { TemplatesManager, type Template } from "./templates-manager";
import { Supplies } from "./supplies";
import { SupplyForm, type Supply } from "./supply-form";
import { ServiceForm } from "./service-form";

type SearchParams = Promise<{ tab?: string; role?: string; date?: string }>;

type Closure = {
  id: string;
  period_type: "week" | "month";
  period_start: string;
  period_end: string;
};
type ArchiveRow = Closure & {
  closed_at: string;
  snapshot: { items: { title: string; frequency: string; dates: string[] }[] };
};

const defaults = ["housekeeper", "groundskeeper", "gardener"];
const groupLabel = (g: string) => positionLabels[g] ?? g;
const freqLabel: Record<string, string> = {
  daily: "დღიური",
  weekly: "კვირეული",
  monthly: "თვიური",
};

const tabCls = (active: boolean) =>
  `rounded-md px-3 py-2 text-sm ${active ? "bg-muted font-medium" : "text-muted-foreground"}`;
const pillCls = "rounded-md border px-3 py-2 text-sm";

const shiftDay = (date: string, d: number) => {
  const [y, m, day] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day) + d * 86400000).toISOString().slice(0, 10);
};

async function Content({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const sp = await searchParams;

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tbilisi" });
  const tab =
    sp.tab === "supplies"
      ? "supplies"
      : sp.tab === "templates"
        ? "templates"
        : sp.tab === "archive"
          ? "archive"
          : "checklist";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? (sp.date as string) : today;

  const supabase = await createClient();

  const { data: posRows } = await supabase.from("checklist_templates").select("position");
  const groups = Array.from(
    new Set([...defaults, ...(posRows ?? []).map((r) => r.position as string)])
  );
  const role = groups.includes(sp.role ?? "") ? (sp.role as string) : groups[0];

  const link = (o: Record<string, string>) =>
    `/services?${new URLSearchParams({ tab, role, date, ...o }).toString()}`;

  const tabs = (
    <div className="mb-4 flex flex-wrap gap-1">
      <Link href={link({ tab: "checklist" })} className={tabCls(tab === "checklist")}>
        დასუფთავების გეგმა
      </Link>
      <Link href={link({ tab: "archive" })} className={tabCls(tab === "archive")}>
        არქივი
      </Link>
      <Link href={link({ tab: "supplies" })} className={tabCls(tab === "supplies")}>
        მომარაგება
      </Link>
      <Link href={link({ tab: "templates" })} className={tabCls(tab === "templates")}>
        შაბლონები
      </Link>
    </div>
  );

  const roleTabs = (
    <div className="mb-4 flex flex-wrap gap-1">
      {groups.map((g) => (
        <Link key={g} href={link({ role: g })} className={tabCls(role === g)}>
          {groupLabel(g)}
        </Link>
      ))}
    </div>
  );

  // ---------- მომარაგება ----------
  if (tab === "supplies") {
    const { data } = await supabase
      .from("supply_items")
      .select("id, name, volume, unit_price, quantity_needed, comment, photo_url")
      .order("name");
    const supplies = (data ?? []) as Supply[];

    const photoUrls: Record<string, string> = {};
    const paths = supplies.map((s) => s.photo_url).filter((p): p is string => !!p);
    if (paths.length) {
      const { data: signed } = await supabase.storage.from("photos").createSignedUrls(paths, 3600);
      signed?.forEach((s) => {
        if (s.path && s.signedUrl) photoUrls[s.path] = s.signedUrl;
      });
    }

    return (
      <>
        <PageHeader title="სერვისები" description="მომარაგება" action={<SupplyForm />} />
        {tabs}
        <Supplies items={supplies} photoUrls={photoUrls} />
      </>
    );
  }

  // ---------- შაბლონები ----------
  if (tab === "templates") {
    const { data } = await supabase
      .from("checklist_templates")
      .select("id, title, frequency")
      .eq("position", role)
      .order("sort_order");
    return (
      <>
        <PageHeader title="სერვისები" description="გეგმის შაბლონები" action={<ServiceForm />} />
        {tabs}
        {roleTabs}
        <TemplatesManager
          role={role}
          templates={(data ?? []) as Template[]}
          isCustom={!defaults.includes(role)}
        />
      </>
    );
  }

  // ---------- არქივი ----------
  if (tab === "archive") {
    const { data } = await supabase
      .from("checklist_closures")
      .select("id, period_type, period_start, period_end, closed_at, snapshot")
      .eq("position", role)
      .order("period_end", { ascending: false })
      .limit(100);
    const rows = (data ?? []) as ArchiveRow[];

    return (
      <>
        <PageHeader title="სერვისები" description="დახურული გეგმების არქივი" />
        {tabs}
        {roleTabs}
        <div className="space-y-2">
          {rows.length === 0 && (
            <p className="text-muted-foreground">დახურული გეგმები ჯერ არ არის</p>
          )}
          {rows.map((r) => {
            const t = periodTitle(r.period_type, r.period_start, r.period_end);
            const summary = (["daily", "weekly", "monthly"] as const)
              .map((f) => {
                const list = r.snapshot.items.filter((i) => i.frequency === f);
                if (list.length === 0) return null;
                const done = list.filter((i) => i.dates.length > 0).length;
                return `${freqLabel[f]} ${done}/${list.length}`;
              })
              .filter(Boolean)
              .join(" · ");
            return (
              <Link
                key={r.id}
                href={`/services/archive/${r.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 hover:bg-muted/40"
              >
                <div>
                  <div className="font-medium">
                    {t.title} <span className="text-muted-foreground">· {t.sub}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">{summary}</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  დახურულია:{" "}
                  {new Date(r.closed_at).toLocaleDateString("en-GB", { timeZone: "Asia/Tbilisi" })}
                </div>
              </Link>
            );
          })}
        </div>
      </>
    );
  }

  // ---------- დასუფთავების გეგმა ----------
  const month = monthRange(date);
  const week = weekRange(date);
  const [y, m] = month.start.split("-").map(Number);
  const rangeStart = week.start < month.start ? week.start : month.start;
  const rangeEnd = week.end > month.end ? week.end : month.end;

  const { data: tpl } = await supabase
    .from("checklist_templates")
    .select("id, title, frequency, sort_order")
    .eq("position", role)
    .eq("is_active", true)
    .order("sort_order");
  const templates = tpl ?? [];
  const ids = templates.map((t) => t.id);

  const [{ data: logsData }, { data: closData }] = await Promise.all([
    ids.length
      ? supabase
          .from("checklist_logs")
          .select("template_id, done_date")
          .in("template_id", ids)
          .gte("done_date", rangeStart)
          .lte("done_date", rangeEnd)
      : Promise.resolve({ data: [] as { template_id: string; done_date: string }[] }),
    supabase
      .from("checklist_closures")
      .select("id, period_type, period_start, period_end")
      .eq("position", role)
      .lte("period_start", rangeEnd)
      .gte("period_end", rangeStart)
      .order("period_start"),
  ]);
  const logs = logsData ?? [];
  const closures = (closData ?? []) as Closure[];

  const weekClosure = closures.find(
    (c) => c.period_type === "week" && c.period_start === week.start
  );
  const monthClosure = closures.find(
    (c) => c.period_type === "month" && c.period_start === month.start
  );
  const inMonth = closures.filter(
    (c) => c.period_end >= month.start && c.period_start <= month.end
  );

  const inRange = (t: string, from: string, to: string) =>
    logs.some((l) => l.template_id === t && l.done_date >= from && l.done_date <= to);

  const items: Item[] = templates.map((t) => ({
    id: t.id,
    title: t.title,
    frequency: t.frequency as Item["frequency"],
    done:
      t.frequency === "daily"
        ? inRange(t.id, date, date)
        : t.frequency === "weekly"
          ? inRange(t.id, week.start, week.end)
          : inRange(t.id, month.start, month.end),
  }));

  const closedAny = !!(weekClosure || monthClosure);

  return (
    <>
      <PageHeader title="სერვისები" description="დასუფთავების გეგმა" />
      {tabs}
      {roleTabs}

      {inMonth.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {inMonth.map((c) => {
            const t = periodTitle(c.period_type, c.period_start, c.period_end);
            return (
              <Link
                key={c.id}
                href={`/services/archive/${c.id}`}
                className="rounded-full bg-green-100 px-3 py-1 text-sm text-green-800"
              >
                ✓ {t.title} · {t.sub}
              </Link>
            );
          })}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={link({ date: shiftDay(date, -1) })} className={pillCls}>
          ←
        </Link>
        <div className="min-w-32 text-center font-semibold">{dmy(date)}</div>
        <Link href={link({ date: shiftDay(date, 1) })} className={pillCls}>
          →
        </Link>
        {date !== today && (
          <Link href={link({ date: today })} className="px-2 text-sm text-muted-foreground underline">
            დღეს
          </Link>
        )}
      </div>

      <ClosePlanButtons
        role={role}
        date={date}
        weekText={`${dm(week.start)}–${dm(week.end)}`}
        monthText={`${monthNames[m - 1]} ${y}`}
        weekClosedId={weekClosure?.id ?? null}
        monthClosedId={monthClosure?.id ?? null}
      />

      <Checklist
        key={`${role}-${date}-${closedAny}-${monthClosure ? "m" : ""}`}
        items={items}
        date={date}
        dayLabel={dmy(date)}
        weekLabel={`${dm(week.start)} – ${dm(week.end)}`}
        monthLabel={`${monthNames[m - 1]} ${y}`}
        locked={{
          daily: closedAny,
          weekly: closedAny,
          monthly: !!monthClosure,
        }}
      />
    </>
  );
}

export default function ServicesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">იტვირთება...</div>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}