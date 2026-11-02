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

type Prop = { id: string; number: string; fee: number };

const selCls = "h-11 w-full rounded-md border bg-background px-3 text-sm";

export function ResidentForm({
  resident,
  properties,
}: {
  resident?: Resident;
  properties: Prop[];
}) {
  const feeOf = (id: string) => properties.find((p) => p.id === id)?.fee;

  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [propId, setPropId] = useState(resident?.property_id ?? "");
  const [fee, setFee] = useState(String(feeOf(resident?.property_id ?? "") ?? ""));
  const isNew = propId === "new";

  function onProperty(id: string) {
    setPropId(id);
    setFee(id === "new" ? "" : String(feeOf(id) ?? ""));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await saveResident(resident?.id ?? null, fd);
      if ("error" in r) setError(r.error);
      else {
        setError("");
        if (!resident) {
          setPropId("");
          setFee("");
        }
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
        <DialogContent className="max-h-[92vh] overflow-y-auto">
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
              <div className="space-y-1.5">
                <label htmlFor="property_id" className="text-sm font-medium">
                  ბინა / სახლი
                </label>
                <select
                  id="property_id"
                  name="property_id"
                  value={propId}
                  onChange={(e) => onProperty(e.target.value)}
                  className={selCls}
                >
                  <option value="">აირჩიე...</option>
                  <option value="new">+ ახალი ბინა / სახლი</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.number}
                    </option>
                  ))}
                </select>
              </div>
              <SelectField
                label="სტატუსი"
                name="relation"
                defaultValue={resident?.relation ?? "owner"}
                options={Object.entries(relationLabels).map(([value, label]) => ({ value, label }))}
              />
            </div>

            {isNew && (
              <div className="grid grid-cols-2 gap-3 rounded-lg border p-3">
                <SelectField
                  label="ტიპი"
                  name="new_type"
                  defaultValue="house"
                  options={[
                    { value: "house", label: "სახლი" },
                    { value: "apartment", label: "ბინა" },
                  ]}
                />
                <FormField label="ნომერი" name="new_number" type="number" min="1" placeholder="22" />
              </div>
            )}

            <div className="space-y-2 rounded-lg border p-3">
              <FormField
                label="თვიური გადასახადი (₾)"
                name="monthly_fee"
                type="number"
                step="0.01"
                min="0"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                გადასახადი ბინა/სახლზეა, ამიტომ ერთი ბინის ყველა მობინადრეზე საერთოა.
              </p>
              {!isNew && propId && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="apply_fee" defaultChecked className="size-4" />
                  თანხის შეცვლისას განახლდეს მიმდინარე და მომავალი თვეების გადასახდელიც
                </label>
              )}
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
              მთავარი (მისი სახელით ჩანს გადახდებში პირველად)
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