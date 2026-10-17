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
import { relationLabels } from "@/lib/labels";
import { saveResident } from "./resident-actions";

export type Resident = {
  id: string;
  property_id: string;
  full_name: string;
  relation: string;
  phone: string | null;
  company_id: string | null;
  payment_method: string | null;
  is_primary: boolean;
  notes: string | null;
};

export const methodOptions = [
  { value: "", label: "—" },
  { value: "cash", label: "ნაღდი" },
  { value: "transfer", label: "გადარიცხვა" },
  { value: "invoice", label: "ინვოისით" },
];

export function ResidentForm({
  resident,
  properties,
}: {
  resident?: Resident;
  properties: { id: string; number: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
    const r = await saveResident(resident?.id ?? null, fd);
    if ("error" in r) setError(r.error);
    else {
        setError("");
        setOpen(false);
    }
    });
  }

  return (
    <>
      <Button
        variant={resident ? "outline" : "default"}
        className={resident ? "h-9" : "h-11"}
        onClick={() => setOpen(true)}
      >
        {resident ? "შეცვლა" : "+ მობინადრე"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{resident ? "მობინადრის რედაქტირება" : "ახალი მობინადრე"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              label="სახელი და გვარი / კომპანია"
              name="full_name"
              defaultValue={resident?.full_name}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="ბინა / სახლი"
                name="property_id"
                defaultValue={resident?.property_id ?? ""}
                options={[
                  { value: "", label: "აირჩიე..." },
                  ...properties.map((p) => ({ value: p.id, label: p.number })),
                ]}
              />
              <SelectField
                label="სტატუსი"
                name="relation"
                defaultValue={resident?.relation ?? "owner"}
                options={Object.entries(relationLabels).map(([value, label]) => ({ value, label }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="ტელეფონი" name="phone" defaultValue={resident?.phone ?? ""} />
              <SelectField
                label="რით იხდის"
                name="payment_method"
                defaultValue={resident?.payment_method ?? ""}
                options={methodOptions}
              />
            </div>
            <FormField
              label="საიდენტიფიკაციო კოდი (შპს-სთვის)"
              name="company_id"
              defaultValue={resident?.company_id ?? ""}
            />
            <FormField label="შენიშვნა" name="notes" defaultValue={resident?.notes ?? ""} />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="is_primary"
                defaultChecked={resident?.is_primary ?? false}
                className="size-4"
              />
              მთავარი (მისი სახელით ჩანს ფინანსებში პირველად)
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="h-11 w-full" disabled={pending}>
              {pending ? "..." : "შენახვა"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}