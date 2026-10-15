"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DeleteButton } from "@/components/delete-button";
import { positionLabels } from "@/lib/labels";
import { EmployeeForm, type Employee } from "./employee-form";
import { deleteEmployees } from "./actions";

export function EmployeeList({ employees }: { employees: Employee[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [, start] = useTransition();

  const count = employees.filter((e) => selected.has(e.id)).length;
  const allSelected = employees.length > 0 && count === employees.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded-lg border p-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={allSelected}
            onChange={() =>
              setSelected(allSelected ? new Set() : new Set(employees.map((e) => e.id)))
            }
          />
          ყველას მონიშვნა ({count})
        </label>
        {count > 0 && (
          <Button variant="destructive" className="h-9" onClick={() => setConfirmOpen(true)}>
            წაშლა ({count})
          </Button>
        )}
      </div>

      {employees.map((e) => (
        <div key={e.id} className="flex items-center gap-3 rounded-lg border p-3">
          <input
            type="checkbox"
            className="size-4"
            checked={selected.has(e.id)}
            onChange={() => toggle(e.id)}
            aria-label={e.full_name}
          />
          <div className="flex-1">
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
          <DeleteButton
            action={() => deleteEmployees([e.id])}
            title="თანამშრომლის წაშლა"
            description={`„${e.full_name}" და მისი დასწრების მთელი ისტორია სამუდამოდ წაიშლება. ისტორიის შესანარჩუნებლად გამორთე „აქტიურია".`}
          />
        </div>
      ))}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`${count} თანამშრომლის წაშლა`}
        description="მონიშნულების დასწრების მთელი ისტორია სამუდამოდ წაიშლება. ისტორიის შესანარჩუნებლად ჯობია გამორთო „აქტიურია“."
        confirmLabel="წაშლა"
        onConfirm={() =>
          start(async () => {
            const r = await deleteEmployees(employees.filter((e) => selected.has(e.id)).map((e) => e.id));
            if (r?.error) alert(r.error);
            else setSelected(new Set());
          })
        }
      />
    </div>
  );
}