import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { ResidentsList } from "../residents-list";
import { ResidentForm, type Resident } from "../resident-form";
import { BulkResidentForm } from "../bulk-resident-form";

const num = (s: string) => parseInt(s.replace(/\D/g, ""), 10) || 0;
const tabCls = (active: boolean) =>
  `rounded-md px-3 py-2 text-sm ${active ? "bg-muted font-medium" : "text-muted-foreground"}`;

async function Content() {
  await connection();
  const supabase = await createClient();

  const [{ data: resData }, { data: propData }] = await Promise.all([
    supabase
      .from("residents")
      .select("id, property_id, full_name, relation, phone, company_id, payment_method, is_primary, notes"),
    supabase.from("properties").select("id, number, type"),
  ]);

  const props = [...(propData ?? [])].sort((a, b) =>
    a.type === b.type ? num(a.number) - num(b.number) : a.type === "apartment" ? -1 : 1
  );
  const order = new Map(props.map((p, i) => [p.id, i]));
  const residents = ((resData ?? []) as Resident[]).sort(
    (a, b) =>
      (order.get(a.property_id) ?? 0) - (order.get(b.property_id) ?? 0) ||
      Number(b.is_primary) - Number(a.is_primary) ||
      a.full_name.localeCompare(b.full_name, "ka")
  );
  const properties = props.map((p) => ({ id: p.id, number: p.number }));

  return (
    <>
      <PageHeader
        title="გადახდები"
        description="მობინადრეები"
        action={
          <div className="flex flex-wrap gap-2">
            <BulkResidentForm properties={properties} />
            <ResidentForm properties={properties} />
          </div>
        }
      />
      <div className="mb-4 flex gap-1">
        <Link href="/finance" className={tabCls(false)}>
          თვე
        </Link>
        <Link href="/finance?tab=debts" className={tabCls(false)}>
          დავალიანება
        </Link>
        <Link href="/finance/residents" className={tabCls(true)}>
          მობინადრეები
        </Link>
        <Link href="/finance/period" className={tabCls(false)}>
          პერიოდი
        </Link>
      </div>
      <ResidentsList residents={residents} properties={properties} />
    </>
  );
}

export default function ResidentsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">იტვირთება...</div>}>
      <Content />
    </Suspense>
  );
}