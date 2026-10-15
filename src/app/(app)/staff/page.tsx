import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { positionLabels } from "@/lib/labels";
import { EmployeeForm, type Employee } from "./employee-form";

async function Content() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase
    .from("employees")
    .select("id, full_name, position, phone, is_active")
    .order("is_active", { ascending: false })
    .order("full_name");
  const employees = (data ?? []) as Employee[];

  return (
    <>
      <PageHeader title="პერსონალი" description="თანამშრომლების სია" action={<EmployeeForm />} />
      <div className="space-y-2">
        {employees.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <div className={`font-medium ${e.is_active ? "" : "text-muted-foreground line-through"}`}>
                {e.full_name}
              </div>
              <div className="text-sm text-muted-foreground">
                {positionLabels[e.position]}
                {e.phone ? ` · ${e.phone}` : ""}
                {!e.is_active ? " · არააქტიური" : ""}
              </div>
            </div>
            <EmployeeForm employee={e} />
          </div>
        ))}
      </div>
    </>
  );
}

export default function StaffPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">იტვირთება...</div>}>
      <Content />
    </Suspense>
  );
}