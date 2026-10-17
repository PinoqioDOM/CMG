import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/data-table";
import { monthNames } from "@/lib/labels";
import { GenerateButton } from "./generate-button";
import { PaymentsTable, type PayRow } from "./payments-table";

type SearchParams = Promise<{
  tab?: string;
  ym?: string;
  status?: string;
  type?: string;
  q?: string;
}>;

type Prop = { id: string; type: "apartment" | "house"; number: string };
type Pay = {
  id: string;
  property_id: string;
  year: number;
  month: number;
  amount_due: number;
  amount_paid: number;
  paid_at: string | null;
  payment_method: string | null;
  comment: string | null;
  balance: number;
  status: string;
};
type Audit = {
  id: number;
  action: string;
  old_data: Partial<Pay> | null;
  new_data: Partial<Pay> | null;
  changed_by: string | null;
  changed_at: string;
};

const num = (s: string) => parseInt(s.replace(/\D/g, ""), 10) || 0;
const sortProps = (a: Prop, b: Prop) =>
  a.type === b.type ? num(a.number) - num(b.number) : a.type === "apartment" ? -1 : 1;
const money = (n: number) => `${(Math.round(n * 100) / 100).toFixed(2)} ₾`;

function shift(ym: string, d: number) {
  const [y, m] = ym.split("-").map(Number);
  const t = y * 12 + (m - 1) + d;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

const tabCls = (active: boolean) =>
  `rounded-md px-3 py-2 text-sm ${active ? "bg-muted font-medium" : "text-muted-foreground"}`;
const pillCls = "rounded-md border px-3 py-2 text-sm";

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
  const nowYM = today.slice(0, 7);
  const ym = /^\d{4}-\d{2}$/.test(sp.ym ?? "") ? (sp.ym as string) : nowYM;
  const [year, month] = ym.split("-").map(Number);
  const [cy, cm] = nowYM.split("-").map(Number);
  const status = sp.status ?? "all";
  const type = sp.type ?? "all";
  const q = (sp.q ?? "").trim().toLowerCase();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single();
  const isManager = me?.role === "manager";
  const canEdit = isManager || me?.role === "assistant";
  const tab = sp.tab === "debts" ? "debts" : sp.tab === "history" && isManager ? "history" : "month";

  const [{ data: propsData }, { data: resData }] = await Promise.all([
    supabase.from("properties").select("id, type, number"),
    supabase
      .from("residents")
      .select("property_id, full_name, is_primary, payment_method")
      .order("is_primary", { ascending: false }),
  ]);
  const props = (propsData ?? []) as Prop[];
  const propMap = new Map(props.map((p) => [p.id, p]));
  const owners = new Map<string, string[]>();
  const payerMethod = new Map<string, string>();
  (resData ?? []).forEach((r) => {
    owners.set(r.property_id, [...(owners.get(r.property_id) ?? []), r.full_name]);
    if (r.payment_method && !payerMethod.has(r.property_id)) {
      payerMethod.set(r.property_id, r.payment_method);
    }
  });
  const ownerOf = (id: string) => (owners.get(id) ?? []).join(" / ");

  const link = (o: Record<string, string>) => {
    const p = new URLSearchParams();
    const base: Record<string, string> = { tab, ym, status, type, q: sp.q ?? "", ...o };
    Object.entries(base).forEach(([k, v]) => v && p.set(k, v));
    return `/finance?${p.toString()}`;
  };

  const header = (
    <PageHeader
      title="ფინანსები"
      action={
        <div className="flex flex-wrap gap-2">
          <a
            href="https://client.asg.ge/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center rounded-md border px-3 text-sm"
          >
            ASG ↗
          </a>
          <a
            href={`/finance/export?ym=${ym}`}
            className="inline-flex h-11 items-center rounded-md border px-3 text-sm"
          >
            Excel: თვე
          </a>
          <a
            href="/finance/export?all=1"
            className="inline-flex h-11 items-center rounded-md border px-3 text-sm"
          >
            Excel: ყველა
          </a>
        </div>
      }
    />
  );

  const tabs = (
    <div className="mb-4 flex flex-wrap gap-1">
      <Link href={link({ tab: "month" })} className={tabCls(tab === "month")}>
        თვე
      </Link>
      <Link href={link({ tab: "debts" })} className={tabCls(tab === "debts")}>
        დავალიანება
      </Link>
      <Link href="/finance/residents" className={tabCls(false)}>
        მობინადრეები
      </Link>
      {isManager && (
        <Link href={link({ tab: "history" })} className={tabCls(tab === "history")}>
          ისტორია
        </Link>
      )}
    </div>
  );

  // ---------- დავალიანება ----------
  if (tab === "debts") {
    const { data } = await supabase.from("payments_view").select("*").gt("balance", 0).limit(3000);
    const past = ((data ?? []) as Pay[]).filter((p) => p.year * 100 + p.month < cy * 100 + cm);

    const grouped = new Map<string, { id: string; total: number; months: number; oldest: number }>();
    past.forEach((p) => {
      const g = grouped.get(p.property_id) ?? {
        id: p.property_id,
        total: 0,
        months: 0,
        oldest: 999999,
      };
      g.total += p.balance;
      g.months += 1;
      g.oldest = Math.min(g.oldest, p.year * 100 + p.month);
      grouped.set(p.property_id, g);
    });
    const rows = Array.from(grouped.values())
      .filter((g) => propMap.has(g.id))
      .sort((a, b) => b.total - a.total);
    const grand = rows.reduce((s, r) => s + r.total, 0);

    const cols: Column<(typeof rows)[number]>[] = [
      { header: "მობინადრე", cell: (r) => ownerOf(r.id) || "—" },
      { header: "ბინა / სახლი", cell: (r) => propMap.get(r.id)!.number },
      { header: "თვე", cell: (r) => r.months, className: "text-right" },
      {
        header: "დაწყებული",
        cell: (r) => `${monthNames[(r.oldest % 100) - 1]} ${Math.floor(r.oldest / 100)}`,
      },
      {
        header: "დავალიანება",
        cell: (r) => <b className="text-red-600">{money(r.total)}</b>,
        className: "text-right",
      },
    ];

    return (
      <>
        {header}
        {tabs}
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat label="ჯამური დავალიანება" value={money(grand)} tone="text-red-600" />
          <Stat label="მობინადრე დავალიანებით" value={String(rows.length)} />
        </div>
        <DataTable rows={rows} columns={cols} empty="დავალიანება არ არის 🎉" />
      </>
    );
  }

  // ---------- ისტორია ----------
  if (tab === "history") {
    const { data } = await supabase
      .from("audit_log")
      .select("id, action, old_data, new_data, changed_by, changed_at")
      .eq("table_name", "payments")
      .or("action.neq.INSERT,changed_by.not.is.null")
      .order("changed_at", { ascending: false })
      .limit(100);
    const { data: profs } = await supabase.from("profiles").select("id, full_name");
    const names = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
    const rows = ((data ?? []) as Audit[]).map((a) => ({ ...a, id: String(a.id) }));

    const describe = (a: Audit) => {
      if (a.action === "DELETE") return "წაიშალა";
      if (a.action === "INSERT") return "დაემატა";
      const o = a.old_data ?? {};
      const n = a.new_data ?? {};
      const parts: string[] = [];
      if (o.amount_paid !== n.amount_paid)
        parts.push(`გადახდილი: ${money(Number(o.amount_paid))} → ${money(Number(n.amount_paid))}`);
      if (o.amount_due !== n.amount_due)
        parts.push(`გადასახდელი: ${money(Number(o.amount_due))} → ${money(Number(n.amount_due))}`);
      if ((o.payment_method ?? "") !== (n.payment_method ?? "")) parts.push("ტიპი შეიცვალა");
      if ((o.comment ?? "") !== (n.comment ?? "")) parts.push("კომენტარი შეიცვალა");
      return parts.join("; ") || "შეიცვალა";
    };

    const cols: Column<(typeof rows)[number]>[] = [
      {
        header: "როდის",
        cell: (a) =>
          new Date(a.changed_at).toLocaleString("en-GB", {
            timeZone: "Asia/Tbilisi",
            dateStyle: "short",
            timeStyle: "short",
          }),
      },
      { header: "ვინ", cell: (a) => (a.changed_by ? (names.get(a.changed_by) ?? "—") : "—") },
      {
        header: "ბინა / სახლი",
        cell: (a) => {
          const d = a.new_data ?? a.old_data ?? {};
          const p = d.property_id ? propMap.get(d.property_id) : undefined;
          const who = d.property_id ? ownerOf(d.property_id) : "";
          return p
            ? `${who ? who + " · " : ""}${p.number} · ${String(d.month).padStart(2, "0")}.${d.year}`
            : "—";
        },
      },
      { header: "ცვლილება", cell: (a) => describe(a as unknown as Audit) },
    ];

    return (
      <>
        {header}
        {tabs}
        <DataTable rows={rows} columns={cols} empty="ცვლილებები ჯერ არ არის" />
      </>
    );
  }

  // ---------- თვე ----------
  const { data: paysData } = await supabase
    .from("payments_view")
    .select("*")
    .eq("year", year)
    .eq("month", month);

  const all = ((paysData ?? []) as Pay[])
    .filter((p) => propMap.has(p.property_id))
    .sort((a, b) => sortProps(propMap.get(a.property_id)!, propMap.get(b.property_id)!));

  const totalDue = all.reduce((s, p) => s + p.amount_due, 0);
  const totalPaid = all.reduce((s, p) => s + p.amount_paid, 0);
  const totalDebt = all.reduce((s, p) => s + Math.max(p.balance, 0), 0);

  const rows = all.filter((p) => {
    if (type !== "all" && propMap.get(p.property_id)!.type !== type) return false;
    if (status === "unpaid" && !(p.balance > 0.001)) return false;
    if (status === "paid" && !(p.balance <= 0.001)) return false;
    if (q) {
      const hay = [ownerOf(p.property_id), propMap.get(p.property_id)!.number, p.comment ?? ""]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const tableRows: PayRow[] = rows.map((p) => ({
    id: p.id,
    resident: ownerOf(p.property_id) || "—",
    property: propMap.get(p.property_id)!.number,
    due: p.amount_due,
    paid: p.amount_paid,
    balance: p.balance,
    status: p.status,
    method: p.payment_method,
    payerMethod: payerMethod.get(p.property_id) ?? null,
    paidAt: p.paid_at,
    comment: p.comment,
  }));

  return (
    <>
      {header}
      {tabs}

      <div className="mb-4 flex items-center gap-2">
        <Link href={link({ ym: shift(ym, -1) })} className={pillCls}>
          ←
        </Link>
        <div className="min-w-44 text-center font-semibold">
          {monthNames[month - 1]} {year}
        </div>
        <Link href={link({ ym: shift(ym, 1) })} className={pillCls}>
          →
        </Link>
        {ym !== nowYM && (
          <Link href={link({ ym: nowYM })} className="px-2 text-sm text-muted-foreground underline">
            დღეს
          </Link>
        )}
      </div>

      {all.length === 0 ? (
        <div className="space-y-3 rounded-lg border p-6 text-center">
          <p className="text-muted-foreground">ამ თვეში გადახდის ჩანაწერები ჯერ არ არის.</p>
          {canEdit && <GenerateButton year={year} month={month} />}
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="გადასახდელი" value={money(totalDue)} />
            <Stat label="გადახდილი" value={money(totalPaid)} tone="text-green-700" />
            <Stat
              label="დარჩენილი"
              value={money(totalDebt)}
              tone={totalDebt > 0 ? "text-red-600" : ""}
            />
            <Stat
              label="მობინადრე"
              value={`${all.filter((p) => p.balance <= 0.001).length} / ${all.length} გადახდილი`}
            />
          </div>

          <form action="/finance" method="get" className="mb-3 flex flex-wrap items-center gap-2">
            <input type="hidden" name="ym" value={ym} />
            {status !== "all" && <input type="hidden" name="status" value={status} />}
            {type !== "all" && <input type="hidden" name="type" value={type} />}
            <Input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="ძიება: მობინადრე, ბინა, კომენტარი..."
              className="h-11 min-w-48 flex-1"
            />
            <Button type="submit" className="h-11">
              ძიება
            </Button>
            {q && (
              <Link href={link({ q: "" })} className="px-2 text-sm text-muted-foreground underline">
                გასუფთავება
              </Link>
            )}
          </form>

          <div className="mb-4 flex flex-wrap gap-1">
            {[
              ["all", "ყველა"],
              ["unpaid", "გადაუხდელი"],
              ["paid", "გადახდილი"],
            ].map(([v, l]) => (
              <Link key={v} href={link({ status: v })} className={tabCls(status === v)}>
                {l}
              </Link>
            ))}
            <span className="mx-2 border-l" />
            {[
              ["all", "ყველა"],
              ["apartment", "ბინები"],
              ["house", "სახლები"],
            ].map(([v, l]) => (
              <Link key={v} href={link({ type: v })} className={tabCls(type === v)}>
                {l}
              </Link>
            ))}
          </div>

          <PaymentsTable
            key={`${ym}-${status}-${type}-${q}`}
            rows={tableRows}
            today={today}
            canEdit={canEdit}
            monthLabel={`${monthNames[month - 1]} ${year}`}
          />
        </>
      )}
    </>
  );
}

export default function FinancePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">იტვირთება...</div>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}