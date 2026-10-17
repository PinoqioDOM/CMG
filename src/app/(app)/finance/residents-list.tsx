"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DeleteButton } from "@/components/delete-button";
import { paymentMethodLabels, relationLabels } from "@/lib/labels";
import { ResidentForm, type Resident } from "./resident-form";
import { deleteResidents, setResidentsMethod } from "./resident-actions";

export function ResidentsList({
  residents,
  properties,
}: {
  residents: Resident[];
  properties: { id: string; number: string }[];
}) {
  const propName = useMemo(() => new Map(properties.map((p) => [p.id, p.number])), [properties]);
  const [q, setQ] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, start] = useTransition();

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return residents.filter((r) => {
      if (methodFilter === "none" && r.payment_method) return false;
      if (methodFilter && methodFilter !== "none" && r.payment_method !== methodFilter) return false;
      if (!t) return true;
      return [r.full_name, r.phone, r.company_id, propName.get(r.property_id)]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(t));
    });
  }, [residents, q, methodFilter, propName]);

  const chosen = shown.filter((r) => selected.has(r.id)).map((r) => r.id);
  const allSelected = shown.length > 0 && chosen.length === shown.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function run(fn: () => Promise<{ error?: string } | { ok: boolean }>) {
    start(async () => {
      const r = await fn();
      if ("error" in r && r.error) alert(r.error);
      else setSelected(new Set());
    });
  }

  return (
    <div className={pending ? "opacity-70" : ""}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ძიება: სახელი, ბინა, ტელეფონი..."
          className="h-11 min-w-48 flex-1"
        />
        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="h-11 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">ყველა ტიპი</option>
          <option value="cash">ნაღდი</option>
          <option value="transfer">გადარიცხვა</option>
          <option value="invoice">ინვოისით</option>
          <option value="none">ტიპი მითითებული არ არის</option>
        </select>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border p-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={allSelected}
            onChange={() => setSelected(allSelected ? new Set() : new Set(shown.map((r) => r.id)))}
          />
          ყველას მონიშვნა ({chosen.length} / {shown.length})
        </label>
        {chosen.length > 0 && (
          <>
            <select
              value=""
              disabled={pending}
              onChange={(e) => {
                const v = e.target.value;
                if (v) run(() => setResidentsMethod(chosen, v === "clear" ? "" : v));
              }}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value="">რით იხდის: შეცვლა...</option>
              <option value="cash">ნაღდი</option>
              <option value="transfer">გადარიცხვა</option>
              <option value="invoice">ინვოისით</option>
              <option value="clear">გასუფთავება</option>
            </select>
            <Button
              variant="destructive"
              className="ml-auto h-9"
              disabled={pending}
              onClick={() => setConfirmOpen(true)}
            >
              წაშლა ({chosen.length})
            </Button>
          </>
        )}
      </div>

      <div className="space-y-2">
        {shown.length === 0 && <p className="text-muted-foreground">მობინადრეები ვერ მოიძებნა</p>}
        {shown.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
            <input
              type="checkbox"
              className="size-4"
              checked={selected.has(r.id)}
              onChange={() => toggle(r.id)}
              aria-label={r.full_name}
            />
            <div className="min-w-48 flex-1">
              <div className="font-medium leading-snug">
                {r.full_name} {r.is_primary && <span title="მთავარი">★</span>}
              </div>
              <div className="text-sm text-muted-foreground">
                {[
                  `🏠 ${propName.get(r.property_id) ?? "—"}`,
                  relationLabels[r.relation],
                  r.phone,
                  r.company_id ? `კოდი ${r.company_id}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
              {r.notes && <div className="text-xs text-muted-foreground">{r.notes}</div>}
            </div>
            <span className="whitespace-nowrap rounded bg-muted px-2 py-0.5 text-xs">
              {r.payment_method ? paymentMethodLabels[r.payment_method] : "ტიპი არ არის"}
            </span>
            <ResidentForm
              key={`${r.id}-${r.full_name}-${r.property_id}-${r.relation}-${r.phone}-${r.payment_method}-${r.is_primary}-${r.notes}-${r.company_id}`}
              resident={r}
              properties={properties}
            />
            <DeleteButton
              action={() => deleteResidents([r.id])}
              title="მობინადრის წაშლა"
              description={`„${r.full_name}" წაიშლება სიიდან. ბინის გადახდების ისტორია არ იშლება.`}
            />
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`${chosen.length} მობინადრის წაშლა`}
        description="მონიშნული მობინადრეები სიიდან წაიშლება. ბინის გადახდების ისტორია არ იშლება."
        confirmLabel="წაშლა"
        onConfirm={() => run(() => deleteResidents(chosen))}
      />
    </div>
  );
}