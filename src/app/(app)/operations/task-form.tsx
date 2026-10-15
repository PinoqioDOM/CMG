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
import { categoryLabels, priorityLabels } from "@/lib/labels";
import { createTask } from "./actions";

const toOptions = (m: Record<string, string>) =>
  Object.entries(m).map(([value, label]) => ({ value, label }));

export function TaskForm({ employees }: { employees: { id: string; full_name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await createTask(fd);
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
        + დავალება
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ახალი დავალება</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField label="სათაური" name="title" required />
            <TextareaField label="აღწერა" name="description" />
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="კატეგორია"
                name="category"
                defaultValue="general"
                options={toOptions(categoryLabels)}
              />
              <SelectField
                label="პრიორიტეტი"
                name="priority"
                defaultValue="normal"
                options={toOptions(priorityLabels)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="ვადა" name="due_date" type="date" />
              <SelectField
                label="შემსრულებელი"
                name="assigned_to"
                options={[
                  { value: "", label: "—" },
                  ...employees.map((e) => ({ value: e.id, label: e.full_name })),
                ]}
              />
            </div>
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