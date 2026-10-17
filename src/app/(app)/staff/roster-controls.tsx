"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addToRoster, removeFromRoster } from "./attendance-actions";

export function AddToRoster({
  ym,
  candidates,
}: {
  ym: string;
  candidates: { id: string; full_name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    start(async () => {
      const r = await addToRoster(ym, Array.from(selected));
      if (r?.error) setError(r.error);
      else {
        setError("");
        setSelected(new Set());
        setOpen(false);
      }
    });
  }

  return (
    <>
      <Button variant="outline" className="h-11" onClick={() => setOpen(true)}>
        + თანამშრომელი
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>თანამშრომლის დამატება ამ თვის ცხრილში</DialogTitle>
          </DialogHeader>
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {"ყველა აქტიური თანამშრომელი უკვე ცხრილშია. ახალი თანამშრომელი დაამატე „თანამშრომლები\" ჩანართში."}
            </p>
          ) : (
            <div className="space-y-2">
              {candidates.map((c) => (
                <label key={c.id} className="flex min-h-11 items-center gap-3 rounded-lg border p-3">
                  <input
                    type="checkbox"
                    className="size-5"
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                  />
                  {c.full_name}
                </label>
              ))}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button
                className="h-11 w-full"
                disabled={pending || selected.size === 0}
                onClick={submit}
              >
                დამატება ({selected.size})
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RemoveFromRoster({
  ym,
  employeeId,
  name,
}: {
  ym: string;
  employeeId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  return (
    <>
      <button
        type="button"
        aria-label="ამ თვის ცხრილიდან ამოღება"
        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted"
        onClick={() => setOpen(true)}
      >
        <X className="size-3.5" />
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`${name}: ამოღება ცხრილიდან`}
        description="ამ თვის ცხრილიდან ამოიღება და ამ თვის მონიშვნები წაიშლება. თანამშრომელი სიიდან არ წაიშლება, სხვა თვეებზე გავლენას არ იქონიებს."
        confirmLabel="ამოღება"
        onConfirm={() =>
          start(async () => {
            const r = await removeFromRoster(ym, employeeId);
            if (r?.error) alert(r.error);
          })
        }
      />
    </>
  );
}