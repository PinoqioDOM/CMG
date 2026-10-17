"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/form-field";
import { SelectField } from "@/components/native-fields";
import { frequencyLabels } from "@/lib/labels";
import { addTemplate } from "./actions";

export function ServiceForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("position") ?? "").trim();
    start(async () => {
      const r = await addTemplate(fd);
      if (r?.error) setError(r.error);
      else {
        setError("");
        setOpen(false);
        router.push(`/services?tab=templates&role=${encodeURIComponent(name)}`);
      }
    });
  }

  return (
    <>
      <Button className="h-11" onClick={() => setOpen(true)}>
        + სერვისი
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ახალი სერვისი</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField label="სერვისის სახელი" name="position" placeholder="მაგ. ლიფტი" required />
            <FormField label="პირველი პუნქტი" name="title" placeholder="მაგ. ლიფტის შემოწმება" required />
            <SelectField
              label="სიხშირე"
              name="frequency"
              defaultValue="weekly"
              options={Object.entries(frequencyLabels).map(([value, label]) => ({ value, label }))}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="h-11 w-full" disabled={pending}>
              {pending ? "..." : "შექმნა"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}