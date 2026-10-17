"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SelectField } from "@/components/native-fields";
import { relationLabels } from "@/lib/labels";
import { methodOptions } from "./resident-form";
import { createResidents } from "./resident-actions";

export function BulkResidentForm({ properties }: { properties: { id: string; number: string }[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
    const r = await createResidents(fd);
    if ("error" in r) setError(r.error);
    else {
        setError("");
        setOpen(false);
    }
    });
  }

  return (
    <>
      <Button variant="outline" className="h-11" onClick={() => setOpen(true)}>
        + რამდენიმე
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>რამდენიმე მობინადრის დამატება</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <SelectField
              label="ბინა / სახლი (ყველასთვის ერთი)"
              name="property_id"
              defaultValue=""
              options={[
                { value: "", label: "აირჩიე..." },
                ...properties.map((p) => ({ value: p.id, label: p.number })),
              ]}
            />
            <div className="space-y-1.5">
              <label htmlFor="names" className="text-sm font-medium">
                სახელები (თითო ახალ ხაზზე)
              </label>
              <textarea
                id="names"
                name="names"
                rows={5}
                placeholder={"გიორგი ბერიძე\nნინო კვარაცხელია"}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="სტატუსი"
                name="relation"
                defaultValue="tenant"
                options={Object.entries(relationLabels).map(([value, label]) => ({ value, label }))}
              />
              <SelectField label="რით იხდის" name="payment_method" defaultValue="" options={methodOptions} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="h-11 w-full" disabled={pending}>
              {pending ? "..." : "დამატება"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}