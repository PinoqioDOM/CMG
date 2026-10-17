"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { paymentMethodLabels, paymentStatusLabels } from "@/lib/labels";
import { PaymentDialog } from "./payment-dialog";
import { deletePayments, setPaymentMethod, setPaymentStatus } from "./actions";

export type PayRow = {
  id: string;
  resident: string;
  property: string;
  due: number;
  paid: number;
  balance: number;
  status: string;
  method: string | null;
  payerMethod: string | null;
  paidAt: string | null;
  comment: string | null;
};

const money = (n: number) => `${(Math.round(n * 100) / 100).toFixed(2)} ₾`;
const dmy = (s: string | null) => (s ? s.split("-").reverse().join(".") : "");

const badgeCls: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  partial: "bg-yellow-100 text-yellow-800",
  overdue: "bg-red-100 text-red-700",
  pending: "bg-muted",
};

const selCls = "h-9 rounded-md border bg-background px-2 text-sm";

export function PaymentsTable({
  rows,
  today,
  canEdit,
  monthLabel,
}: {
  rows: PayRow[];
  today: string;
  canEdit: boolean;
  monthLabel: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, start] = useTransition();

  const chosen = rows.filter((r) => selected.has(r.id)).map((r) => r.id);
  const allSelected = rows.length > 0 && chosen.length === rows.length;

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

  function changeStatus(id: string, value: string) {
    if (value !== "paid" && value !== "unpaid") return;
    start(async () => {
      const r = await setPaymentStatus([id], value);
      if (r?.error) alert(r.error);
    });
  }

  return (
    <div className={pending ? "opacity-70" : ""}>
      {canEdit && chosen.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3">
          <span className="text-sm font-medium">მონიშნულია: {chosen.length}</span>
          <Button className="h-9" disabled={pending} onClick={() => run(() => setPaymentStatus(chosen, "paid"))}>
            გადახდილად
          </Button>
          <Button
            variant="outline"
            className="h-9"
            disabled={pending}
            onClick={() => run(() => setPaymentStatus(chosen, "unpaid"))}
          >
            გადაუხდელად
          </Button>
          <select
            value=""
            disabled={pending}
            onChange={(e) => {
              const v = e.target.value;
              if (v) run(() => setPaymentMethod(chosen, v === "clear" ? "" : v));
            }}
            className={selCls}
          >
            <option value="">ტიპის შეცვლა...</option>
            <option value="cash">ნაღდი</option>
            <option value="transfer">გადარიცხვა</option>
            <option value="invoice">ინვოისით</option>
            <option value="clear">ტიპის გასუფთავება</option>
          </select>
          <Button
            variant="destructive"
            className="ml-auto h-9"
            disabled={pending}
            onClick={() => setConfirmOpen(true)}
          >
            წაშლა
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              {canEdit && (
                <th className="w-10 p-2">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={allSelected}
                    onChange={() =>
                      setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))
                    }
                    aria-label="ყველას მონიშვნა"
                  />
                </th>
              )}
              <th className="p-2">მობინადრე</th>
              <th className="p-2">ბინა / სახლი</th>
              <th className="p-2 text-right">გადასახდელი</th>
              <th className="p-2 text-right">გადახდილი</th>
              <th className="p-2 text-right">ნაშთი</th>
              <th className="p-2">სტატუსი</th>
              <th className="p-2">რით იხდის</th>
              <th className="p-2">კომენტარი</th>
              {canEdit && <th className="p-2" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="p-6 text-center text-muted-foreground">
                  ჩანაწერები არ არის
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const method = r.method ?? r.payerMethod;
              return (
                <tr key={r.id} className="border-b last:border-0">
                  {canEdit && (
                    <td className="p-2">
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={selected.has(r.id)}
                        onChange={() => toggle(r.id)}
                        aria-label={r.resident}
                      />
                    </td>
                  )}
                  <td className="p-2 font-medium">{r.resident}</td>
                  <td className="p-2 whitespace-nowrap">{r.property}</td>
                  <td className="p-2 text-right whitespace-nowrap">{money(r.due)}</td>
                  <td className="p-2 text-right whitespace-nowrap">
                    {money(r.paid)}
                    {r.paid > 0 && r.paidAt && (
                      <div className="text-xs text-muted-foreground">{dmy(r.paidAt)}</div>
                    )}
                  </td>
                  <td className="p-2 text-right whitespace-nowrap">
                    {r.balance > 0.001 ? money(r.balance) : "—"}
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`whitespace-nowrap rounded px-2 py-0.5 text-xs ${badgeCls[r.status] ?? "bg-muted"}`}
                      >
                        {paymentStatusLabels[r.status] ?? r.status}
                      </span>
                      {canEdit && (
                        <select
                          value=""
                          disabled={pending}
                          onChange={(e) => changeStatus(r.id, e.target.value)}
                          className="h-8 w-8 cursor-pointer rounded-md border bg-background text-xs"
                          aria-label="სტატუსის შეცვლა"
                          title="სტატუსის შეცვლა"
                        >
                          <option value="">▾</option>
                          <option value="paid">→ გადახდილი</option>
                          <option value="unpaid">→ გადაუხდელი</option>
                        </select>
                      )}
                    </div>
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    {method ? paymentMethodLabels[method] : "—"}
                  </td>
                  <td className="p-2">
                    <span className="line-clamp-2 max-w-56 text-xs">{r.comment}</span>
                  </td>
                  {canEdit && (
                    <td className="p-2">
                      <PaymentDialog
                        key={`${r.id}-${r.due}-${r.paid}-${r.paidAt}-${r.method}-${r.comment}`}
                        id={r.id}
                        label={`${r.resident} · ${r.property} · ${monthLabel}`}
                        due={r.due}
                        paid={r.paid}
                        paidAt={r.paidAt}
                        method={r.method}
                        defaultMethod={r.payerMethod}
                        comment={r.comment}
                        today={today}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`${chosen.length} გადახდის ჩანაწერის წაშლა`}
        description="მონიშნული თვის ჩანაწერები სამუდამოდ წაიშლება. ვადაგადაცილების გასწორება უბრალოდ „გადახდილად“ გადართვით გამოდის, ამიტომ წაშლა მხოლოდ შეცდომით შექმნილ ჩანაწერებს სჭირდება."
        confirmLabel="წაშლა"
        onConfirm={() => run(() => deletePayments(chosen))}
      />
    </div>
  );
}