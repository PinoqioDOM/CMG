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
import { positionLabels } from "@/lib/labels";
import { createEmployees } from "./actions";

export function BulkAddForm() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await createEmployees(fd);
      if (r?.error) setError(r.error);
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
            <DialogTitle>რამდენიმე თანამშრომლის დამატება</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="names" className="text-sm font-medium">
                სახელები (თითო ახალ ხაზზე)
              </label>
              <textarea
                id="names"
                name="names"
                rows={6}
                placeholder={"გიორგი ბერიძე\nნინო კვარაცხელია"}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                required
              />
            </div>
            <SelectField
              label="პოზიცია (ყველასთვის ერთნაირი)"
              name="position"
              defaultValue="other"
              options={Object.entries(positionLabels).map(([value, label]) => ({ value, label }))}
            />
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