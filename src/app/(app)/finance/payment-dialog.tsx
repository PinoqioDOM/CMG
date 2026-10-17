"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/form-field";
import { SelectField } from "@/components/native-fields";
import { deletePayments, recordPayment } from "./actions";

export function PaymentDialog({
  id,
  label,
  due,
  paid,
  paidAt,
  method,
  defaultMethod,
  comment,
  today,
}: {
  id: string;
  label: string;
  due: number;
  paid: number;
  paidAt: string | null;
  method: string | null;
  defaultMethod: string | null;
  comment: string | null;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [dueAmount, setDueAmount] = useState(String(due));
  const [paidAmount, setPaidAmount] = useState(String(paid));
  const [paidDate, setPaidDate] = useState(paidAt ?? "");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await recordPayment(id, fd);
      if (r?.error) setError(r.error);
      else {
        setError("");
        setOpen(false);
      }
    });
  }

  function remove() {
    if (!confirm("ამ თვის გადახდის ჩანაწერი სამუდამოდ წაიშლება. გავაგრძელო?")) return;
    start(async () => {
      const r = await deletePayments([id]);
      if (r?.error) setError(r.error);
      else setOpen(false);
    });
  }

  return (
    <>
      <Button variant="outline" className="h-9" onClick={() => setOpen(true)}>
        შეცვლა
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="გადასახდელი (₾)"
                name="amount_due"
                type="number"
                step="0.01"
                min="0"
                value={dueAmount}
                onChange={(e) => setDueAmount(e.target.value)}
              />
              <FormField
                label="გადახდილი (₾)"
                name="amount_paid"
                type="number"
                step="0.01"
                min="0"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              className="h-10 w-full"
              onClick={() => {
                setPaidAmount(dueAmount);
                setPaidDate(paidDate || today);
              }}
            >
              სრულად გადახდა ({dueAmount} ₾)
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="გადახდის თარიღი"
                name="paid_at"
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
              />
              <SelectField
                label="რით იხდის"
                name="payment_method"
                defaultValue={method ?? defaultMethod ?? ""}
                options={[
                  { value: "", label: "—" },
                  { value: "cash", label: "ნაღდი" },
                  { value: "transfer", label: "გადარიცხვა" },
                  { value: "invoice", label: "ინვოისით" },
                ]}
              />
            </div>
            <FormField label="კომენტარი" name="comment" defaultValue={comment ?? ""} />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="h-11 w-full" disabled={pending}>
              {pending ? "..." : "შენახვა"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-10 w-full text-red-600"
              disabled={pending}
              onClick={remove}
            >
              ჩანაწერის წაშლა
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}