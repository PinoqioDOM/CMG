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
import { SelectField, TextareaField } from "@/components/native-fields";
import { createClient } from "@/lib/supabase/client";
import { priorityLabels } from "@/lib/labels";
import { createIncident } from "./actions";

const locations = [
  "Park View",
  "ცენტრალური სკვერი",
  "იაპონური ბაღი",
  "შლაგბაუმი",
  "პარკინგი",
  "თაუნჰაუსები",
];

export function IncidentForm() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("photo") as File | null;
    fd.delete("photo");

    start(async () => {
      if (file && file.size > 0) {
        if (file.size > 10 * 1024 * 1024) {
          setError("ფოტო 10 მბ-ზე დიდია");
          return;
        }
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `incidents/${crypto.randomUUID()}.${ext || "jpg"}`;
        const { error: upErr } = await createClient()
          .storage.from("photos")
          .upload(path, file, { contentType: file.type });
        if (upErr) {
          setError("ფოტო ვერ აიტვირთა");
          return;
        }
        fd.set("photo_url", path);
      }
      const r = await createIncident(fd);
      if (r?.error) setError(r.error);
      else {
        setError("");
        setOpen(false);
      }
    });
  }

  return (
    <>
      <Button className="h-11" onClick={() => setOpen(true)}>
        + ინციდენტი
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ახალი ინციდენტი</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField label="რა მოხდა" name="title" required />
            <TextareaField label="დეტალები" name="description" />
            <FormField label="ადგილი" name="location" list="locations" />
            <datalist id="locations">
              {locations.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="პრიორიტეტი"
                name="priority"
                defaultValue="normal"
                options={Object.entries(priorityLabels).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
              <FormField label="ვინ შეგვატყობინა" name="reported_by" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="photo" className="text-sm font-medium">
                ფოტო
              </label>
              <input id="photo" name="photo" type="file" accept="image/*" className="w-full text-sm" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="h-11 w-full" disabled={pending}>
              {pending ? "იტვირთება..." : "შენახვა"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}