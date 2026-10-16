import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { monthNames, positionLabels } from "@/lib/labels";
import { Checklist, type Item } from "./checklist";
import { TemplatesManager, type Template } from "./templates-manager";
import { Supplies } from "./supplies";
import { SupplyForm, type Supply } from "./supply-form";

type SearchParams = Promise<{ tab?: string; role?: string; date?: string }>;

const roles = ["housekeeper", "groundskeeper", "gardener"] as const;
type Role = (typeof roles)[number];

const tabCls = (active: boolean) =>
  `rounded-md px-3 py-2 text-sm ${active ? "bg-muted font-medium" : "text-muted-foreground"}`;
const pillCls = "rounded-md border px-3 py-2 text-sm";

function shiftDay(date: string, d: number) {
  const [y, m, day] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day) + d * 86400000).toISOString().slice(0, 10);
}
const dmy = (s: string) => s.split("-").reverse().join(".");

async function Content({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const sp = await searchParams;

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tbilisi" });
  const tab = sp.tab === "supplies" ? "supplies" : sp.tab === "templates" ? "templates" : "checklist";
  const role: Role = roles.includes(sp.role as Role) ? (sp.role as Role) : "housekeeper";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? (sp.date as string) : today;

  const link = (o: Record<string, string>) =>
    `/services?${new URLSearchParams({ tab, role, date, ...o }).toString()}`;

  const supabase = await createClient();

  const tabs = (
    <div className="mb-4 flex gap-1">
      <Link href={link({ tab: "checklist" })} className={tabCls(tab === "checklist")}>
        ჩეკლისტი
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
      {roles.map((r) => (
        <Link key={r} href={link({ role: r })} className={tabCls(role === r)}>
          {positionLabels[r]}
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
        <PageHeader title="სერვისები" description="ჩეკლისტის შაბლონები" />
        {tabs}
        {roleTabs}
        <TemplatesManager role={role} templates={(data ?? []) as Template[]} />
      </>
    );
  }

  // ---------- ჩეკლისტი ----------
  const ym = date.slice(0, 7);
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();

  const { data: tpl } = await supabase
    .from("checklist_templates")
    .select("id, title, frequency, sort_order")
    .eq("position", role)
    .eq("is_active", true)
    .order("sort_order");
  const templates = tpl ?? [];
  const ids = templates.map((t) => t.id);

  const { data: logsData } = ids.length
    ? await supabase
        .from("checklist_logs")
        .select("template_id, done_date")
        .in("template_id", ids)
        .gte("done_date", `${ym}-01`)
        .lte("done_date", `${ym}-${String(last).padStart(2, "0")}`)
    : { data: [] as { template_id: string; done_date: string }[] };
  const logs = logsData ?? [];

  const items: Item[] = templates.map((t) => ({
    id: t.id,
    title: t.title,
    frequency: t.frequency as "daily" | "monthly",
    done:
      t.frequency === "daily"
        ? logs.some((l) => l.template_id === t.id && l.done_date === date)
        : logs.some((l) => l.template_id === t.id),
  }));

  return (
    <>
      <PageHeader title="სერვისები" description="ჩეკლისტები" />
      {tabs}
      {roleTabs}

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

      <Checklist
        key={`${role}-${date}`}
        items={items}
        date={date}
        dayLabel={dmy(date)}
        monthLabel={`${monthNames[m - 1]} ${y}`}
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