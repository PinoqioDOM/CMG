"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { clearMonth } from "./attendance-actions";

export function ClearMonthButton({ ym, label }: { ym: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <Button
        variant="outline"
        className="h-11 text-red-600"
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        გრაფიკის წაშლა
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`${label}: გრაფიკის წაშლა`}
        description="ამ თვის ყველა თანამშრომლის ცვლა, დასვენება, შვებულება და გაცდენა წაიშლება. თანამშრომლები სიაში დარჩებიან."
        confirmLabel="წაშლა"
        onConfirm={() =>
          start(async () => {
            const r = await clearMonth(ym);
            if ("error" in r) alert(r.error);
            else alert(`წაიშალა ${r.count} ჩანაწერი`);
          })
        }
      />
    </>
  );
}