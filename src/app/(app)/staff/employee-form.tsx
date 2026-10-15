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
import { positionLabels } from "@/lib/labels";
import { createEmployee, updateEmployee } from "./actions";

export type Employee = {
  id: string;
  full_name: string;
  position: string;
  phone: string | null;
  is_active: boolean;
};

export function EmployeeForm({ employee }: { employee?: Employee }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = employee ? await updateEmployee(employee.id, fd) : await createEmployee(fd);
      if (r?.error) setError(r.error);
      else {
        setError("");
        setOpen(false);
      }
    });
  }

  return (
    <>
      <Button
        variant={employee ? "outline" : "default"}
        className={employee ? "h-9" : "h-11"}
        onClick={() => setOpen(true)}
      >
        {employee ? "შეცვლა" : "+ თანამშრომელი"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{employee ? "თანამშრომლის რედაქტირება" : "ახალი თანამშრომელი"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              label="სახელი და გვარი"
              name="full_name"
              defaultValue={employee?.full_name}
              required
            />
            <SelectField
              label="პოზიცია"
              name="position"
              defaultValue={employee?.position ?? "other"}
              options={Object.entries(positionLabels).map(([value, label]) => ({ value, label }))}
            />
            <FormField label="ტელეფონი" name="phone" defaultValue={employee?.phone ?? ""} />
            {employee && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="is_active"
                  defaultChecked={employee.is_active}
                  className="size-4"
                />
                აქტიურია (არააქტიური აღარ ჩანს „შემსრულებლის“ სიაში)
              </label>
            )}
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