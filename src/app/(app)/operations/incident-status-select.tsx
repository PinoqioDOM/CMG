"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { incidentStatusLabels } from "@/lib/labels";
import { updateIncidentStatus } from "./actions";

const solvers = ["გენო", "დაშვებები", "სიმეტრია", "გუნდი", "ხელოსანი", "მობინადრე"];

export function IncidentStatusSelect({
  id,
  status,
  performer,
}: {
  id: string;
  status: string;
  performer: string | null;
}) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tbilisi" });

  const [value, setValue] = useState(status);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [by, setBy] = useState(performer ?? "");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function onChange(next: string) {
    if (next === "resolved") {
      setDate(today);
      setBy(performer ?? "");
      setError("");
      setOpen(true);
      return;
    }
    const prev = value;
    setValue(next);
    start(async () => {
      const r = await updateIncidentStatus(id, next);
      if (r?.error) {
        alert(r.error);
        setValue(prev);
      }
    });
  }

  function confirmResolved() {
    start(async () => {
      const r = await updateIncidentStatus(id, "resolved", date, by);
      if (r?.error) setError(r.error);
      else {
        setValue("resolved");
        setOpen(false);
      }
    });
  }

  return (
    <>
      <select
        value={value}
        disabled={pending}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border bg-background px-2 text-sm"
      >
        {Object.entries(incidentStatusLabels).map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>გადაწყვეტილად მონიშვნა</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="resolved-on" className="text-sm font-medium">
                როდის გადაწყდა
              </label>
              <input
                id="resolved-on"
                type="date"
                value={date}
                max={today}
                onChange={(e) => setDate(e.target.value)}
                className="h-11 w-full rounded-md border bg-background px-3 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="resolved-by" className="text-sm font-medium">
                ვინ გადაწყვიტა
              </label>
              <input
                id="resolved-by"
                value={by}
                onChange={(e) => setBy(e.target.value)}
                placeholder="აირჩიე ან ჩაწერე..."
                className="h-11 w-full rounded-md border bg-background px-3 text-sm"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {solvers.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setBy(s)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      by === s ? "bg-foreground text-background" : "hover:bg-muted"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button className="h-11 w-full" disabled={pending} onClick={confirmResolved}>
              {pending ? "..." : "შენახვა"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}