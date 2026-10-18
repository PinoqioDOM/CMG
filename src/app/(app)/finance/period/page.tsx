import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/data-table";
import { monthNames, paymentMethodLabels } from "@/lib/labels";

type SearchParams = Promise<{ from?: string; to?: string }>;

type Pay = {
  id: string;
  property_id: string;
  year: number;
  month: number;
  amount_paid: number;
  paid_at: string;
  payment_method: string | null;
};

const dayRe = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (ts: number) => new Date(ts).toISOString().slice(0, 10);
const dmy = (s: string) => s.split("-").reverse().join(".");
const money = (n: number) => `${(Math.round(n * 100) / 100).toFixed(2)} ₾`;

function cycleOf(today: string, back: number) {
  const [y, m, d] = today.split("-").map(Number);
  let idx = y * 12 + (m - 1) - (d >= 25 ? 0 : 1) - back;
  const sy = Math.floor(idx / 12);
  const sm = (idx % 12) + 1;
  idx += 1;
  return {
    from: `${sy}-${pad(sm)}-25`,
    to: `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}-24`,
  };
}

function weekOf(today: string, back: number) {
  const [y, m, d] = today.split("-").map(Number);
  const ts = Date.UTC(y, m - 1, d);
  const off = (new Date(ts).getUTCDay() + 6) % 7;
  const start = ts - off * 86400000 - back * 7 * 86400000;
  return { from: iso(start), to: iso(start + 6 * 86400000) };
}

function monthOf(today: string, back: number) {
  const [y, m] = today.split("-").map(Number);
  const idx = y * 12 + (m - 1) - back;
  const yy = Math.floor(idx / 12);
  const mm = (idx % 12) + 1;
  const last = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  return { from: `${yy}-${pad(mm)}-01`, to: `${yy}-${pad(mm)}-${pad(last)}` };
}

const tabCls = (active: boolean) =>
  `rounded-md px-3 py-2 text-sm ${active ? "bg-muted font-medium" : "text-muted-foreground"}`;
const num = (s: string) => parseInt(s.replace(/\D/g, ""), 10) || 0;

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

async function Content({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const sp = await searchParams;

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tbilisi" });
  const def = cycleOf(today, 0);
  const valid = dayRe.test(sp.from ?? "") && dayRe.test(sp.to ?? "") && (sp.from as string) <= (sp.to as string);
  const from = valid ? (sp.from as string) : def.from;
  const to = valid ? (sp.to as string) : def.to;

  const presets = [
    { label: "ეს 25→25", ...cycleOf(today, 0) },
    { label: "წინა 25→25", ...cycleOf(today, 1) },
    { label: "ეს კვირა", ...weekOf(today, 0) },
    { label: "წინა კვირა", ...weekOf(today, 1) },
    { label: "ეს თვე (1–31)", ...monthOf(today, 0) },
    { label: "წინა თვე", ...monthOf(today, 1) },
  ];

  const supabase = await createClient();
  const [{ data: payData }, { data: undated }, { data: propsData }, { data: resData }] =
    await Promise.all([
      supabase
        .from("payments_view")
        .select("id, property_id, year, month, amount_paid, paid_at, payment_method")
        .gt("amount_paid", 0)
        .gte("paid_at", from)
        .lte("paid_at", to)
        .order("paid_at")
        .limit(2000),
      supabase
        .from("payments_view")
        .select("amount_paid")
        .gt("amount_paid", 0)
        .is("paid_at", null)
        .limit(3000),
      supabase.from("properties").select("id, number, type"),
      supabase
        .from("residents")
        .select("property_id, full_name, is_primary")
        .order("is_primary", { ascending: false }),
    ]);

  const pays = (payData ?? []) as Pay[];
  const propMap = new Map((propsData ?? []).map((p) => [p.id, p]));
  const owners = new Map<string, string[]>();
  (resData ?? []).forEach((r) => {
    owners.set(r.property_id, [...(owners.get(r.property_id) ?? []), r.full_name]);
  });
  const ownerOf = (id: string) => (owners.get(id) ?? []).join(" / ") || "—";

  const total = pays.reduce((s, p) => s + p.amount_paid, 0);
  const byMethod = new Map<string, { sum: number; count: number }>();
  pays.forEach((p) => {
    const k = p.payment_method ?? "none";
    const g = byMethod.get(k) ?? { sum: 0, count: 0 };
    g.sum += p.amount_paid;
    g.count += 1;
    byMethod.set(k, g);
  });
  const byType = { apartment: 0, house: 0 };
  pays.forEach((p) => {
    const t = propMap.get(p.property_id)?.type;
    if (t === "apartment") byType.apartment += p.amount_paid;
    if (t === "house") byType.house += p.amount_paid;
  });

  const undatedRows = undated ?? [];
  const undatedSum = undatedRows.reduce((s, r) => s + Number(r.amount_paid), 0);

  const days =
    Math.round(
      (Date.UTC(...(to.split("-").map(Number) as [number, number, number]).map((v, i) => (i === 1 ? v - 1 : v)) as [number, number, number]) -
        Date.UTC(...(from.split("-").map(Number) as [number, number, number]).map((v, i) => (i === 1 ? v - 1 : v)) as [number, number, number])) /
        86400000
    ) + 1;

  const rows = pays
    .filter((p) => propMap.has(p.property_id))
    .sort((a, b) => {
      const pa = propMap.get(a.property_id)!;
      const pb = propMap.get(b.property_id)!;
      return a.paid_at.localeCompare(b.paid_at) ||
        (pa.type === pb.type ? num(pa.number) - num(pb.number) : pa.type === "apartment" ? -1 : 1);
    });

  const cols: Column<(typeof rows)[number]>[] = [
    { header: "თარიღი", cell: (p) => dmy(p.paid_at) },
    { header: "მობინადრე", cell: (p) => ownerOf(p.property_id) },
    { header: "ბინა / სახლი", cell: (p) => propMap.get(p.property_id)!.number },
    { header: "რომელი თვისთვის", cell: (p) => `${monthNames[p.month - 1]} ${p.year}` },
    { header: "რით", cell: (p) => (p.payment_method ? paymentMethodLabels[p.payment_method] : "—") },
    {
      header: "თანხა",
      cell: (p) => <b>{money(p.amount_paid)}</b>,
      className: "text-right",
    },
  ];

  return (
    <>
      <PageHeader title="ფინანსები" description="პერიოდის ანგარიში" />

      <div className="mb-4 flex flex-wrap gap-1">
        <Link href="/finance" className={tabCls(false)}>
          თვე
        </Link>
        <Link href="/finance?tab=debts" className={tabCls(false)}>
          დავალიანება
        </Link>
        <Link href="/finance/period" className={tabCls(true)}>
          პერიოდი
        </Link>
        <Link href="/finance/residents" className={tabCls(false)}>
          მობინადრეები
        </Link>
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        {presets.map((p) => (
          <Link
            key={p.label}
            href={`/finance/period?from=${p.from}&to=${p.to}`}
            className={`${tabCls(p.from === from && p.to === to)} border`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <form
        action="/finance/period"
        method="get"
        className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border p-3"
      >
        <label className="space-y-1 text-xs">
          საიდან
          <input
            type="date"
            name="from"
            defaultValue={from}
            key={from}
            className="block h-11 rounded-md border bg-background px-2 text-sm"
          />
        </label>
        <label className="space-y-1 text-xs">
          სანამდე (ჩათვლით)
          <input
            type="date"
            name="to"
            defaultValue={to}
            key={to}
            className="block h-11 rounded-md border bg-background px-2 text-sm"
          />
        </label>
        <Button type="submit" className="h-11">
          ჩვენება
        </Button>
      </form>

      <div className="mb-2 text-sm text-muted-foreground">
        {dmy(from)} – {dmy(to)} · {days} დღე
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="მიღებული თანხა" value={money(total)} tone="text-green-700" />
        <Stat label="გადახდების რაოდენობა" value={String(pays.length)} />
        <Stat label="ბინები" value={money(byType.apartment)} />
        <Stat label="სახლები" value={money(byType.house)} />
      </div>

      {byMethod.size > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          {Array.from(byMethod.entries()).map(([k, g]) => (
            <span key={k} className="rounded-lg border px-3 py-1.5">
              {k === "none" ? "ტიპი არ არის" : paymentMethodLabels[k]}:{" "}
              <b>{money(g.sum)}</b>{" "}
              <span className="text-muted-foreground">({g.count})</span>
            </span>
          ))}
        </div>
      )}

      <DataTable rows={rows} columns={cols} empty="ამ პერიოდში გადახდა არ ჩაწერილა" />

      {undatedRows.length > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          თარიღის გარეშე გადახდები (ძველი ჩანაწერები): {undatedRows.length} ჩანაწერი,{" "}
          {money(undatedSum)}. პერიოდის ჯამში არ შედის.
        </p>
      )}
    </>
  );
}

export default function PeriodPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">იტვირთება...</div>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}