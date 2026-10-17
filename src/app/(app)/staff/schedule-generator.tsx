"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { generateSchedule } from "./attendance-actions";

export type Pattern =
  | { type: "cycle"; every: number; ref: string; kind: string; hours?: number }
  | { type: "weekly"; hours: number[] };

type Row = {
  mode: "none" | "cycle" | "weekly";
  every: string;
  ref: string;
  kind: string;
  hours: string;
  week: string[]; // ორშ..კვ
};

const weekLabels = ["ორშ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ", "კვ"];

function fromPattern(p: Pattern | undefined, ym: string): Row {
  const base: Row = {
    mode: "none",
    every: "3",
    ref: `${ym}-01`,
    kind: "24h",
    hours: "7",
    week: ["7", "7", "7", "7", "7", "", ""],
  };
  if (!p) return base;
  if (p.type === "cycle") {
    return {
      ...base,
      mode: "cycle",
      every: String(p.every),
      ref: p.ref,
      kind: p.kind,
      hours: p.hours ? String(p.hours) : "7",
    };
  }
  return {
    ...base,
    mode: "weekly",
    week: [1, 2, 3, 4, 5, 6, 0].map((wd) => (p.hours[wd] ? String(p.hours[wd]) : "")),
  };
}

const sel = "h-10 rounded-md border bg-background px-2 text-sm";

export function ScheduleGenerator({
  ym,
  employees,
  patterns,
}: {
  ym: string;
  employees: { id: string; full_name: string }[];
  patterns: Record<string, Pattern>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(employees.map((e) => [e.id, fromPattern(patterns[e.id], ym)]))
  );

  const set = (id: string, patch: Partial<Row>) =>
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  function submit() {
    const items = employees.map((e) => {
      const r = rows[e.id];
      if (r.mode === "cycle") {
        return {
          employee_id: e.id,
          pattern: {
            type: "cycle" as const,
            every: Number(r.every),
            ref: r.ref,
            kind: r.kind,
            hours: r.kind === "regular" ? Number(r.hours) : undefined,
          },
        };
      }
      if (r.mode === "weekly") {
        const hours = [0, 0, 0, 0, 0, 0, 0];
        r.week.forEach((h, i) => {
          hours[(i + 1) % 7] = Number(h) || 0;
        });
        return { employee_id: e.id, pattern: { type: "weekly" as const, hours } };
      }
      return { employee_id: e.id, pattern: null };
    });

    start(async () => {
        const res = await generateSchedule({ ym, overwrite, items });
        if ("error" in res) setError(res.error ?? "შეცდომა");
        else {
            setError("");
            setOpen(false);
            alert(`ცხრილი შეივსო: ${res.count} უჯრა`);
        }
    });
  }

  return (
    <>
      <Button className="h-11" onClick={() => setOpen(true)}>
        გრაფიკის გენერატორი
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>გრაფიკის გენერატორი</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            თითოეულ თანამშრომელს მიუთითე წესი. წესი ინახება და მომდევნო თვეებშიც დაგხვდება.
            ციკლი საწყისი თარიღიდან ითვლება, ამიტომ თვეებს შორის სწორად გრძელდება.
          </p>

          <div className="space-y-3">
            {employees.map((e) => {
              const r = rows[e.id];
              return (
                <div key={e.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{e.full_name}</div>
                    <select
                      value={r.mode}
                      onChange={(ev) => set(e.id, { mode: ev.target.value as Row["mode"] })}
                      className={sel}
                    >
                      <option value="none">არ ვავსებ</option>
                      <option value="cycle">ციკლი (ყოველ N დღეში)</option>
                      <option value="weekly">კვირის დღეები</option>
                    </select>
                  </div>

                  {r.mode === "cycle" && (
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                      <label className="space-y-1 text-xs">
                        ყოველ N დღეში
                        <Input
                          type="number"
                          min={1}
                          max={31}
                          value={r.every}
                          onChange={(ev) => set(e.id, { every: ev.target.value })}
                          className="h-10"
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        სამუშაო დღე (საწყისი)
                        <Input
                          type="date"
                          value={r.ref}
                          onChange={(ev) => set(e.id, { ref: ev.target.value })}
                          className="h-10"
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        ცვლა
                        <select
                          value={r.kind}
                          onChange={(ev) => set(e.id, { kind: ev.target.value })}
                          className={`${sel} w-full`}
                        >
                          <option value="24h">24 სთ</option>
                          <option value="day">დღე 12</option>
                          <option value="night">ღამე 12</option>
                          <option value="regular">სამუშაო დღე</option>
                        </select>
                      </label>
                      {r.kind === "regular" && (
                        <label className="space-y-1 text-xs">
                          საათები
                          <Input
                            type="number"
                            step="0.5"
                            min={0.5}
                            max={24}
                            value={r.hours}
                            onChange={(ev) => set(e.id, { hours: ev.target.value })}
                            className="h-10"
                          />
                        </label>
                      )}
                    </div>
                  )}

                  {r.mode === "weekly" && (
                    <div className="grid grid-cols-7 gap-1.5">
                      {weekLabels.map((l, i) => (
                        <label key={l} className="space-y-1 text-center text-xs">
                          {l}
                          <Input
                            type="number"
                            step="0.5"
                            min={0}
                            max={24}
                            value={r.week[i]}
                            placeholder="—"
                            onChange={(ev) =>
                              set(e.id, {
                                week: r.week.map((w, j) => (j === i ? ev.target.value : w)),
                              })
                            }
                            className="h-10 px-1 text-center"
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={overwrite}
              onChange={(ev) => setOverwrite(ev.target.checked)}
            />
            არსებული უჯრებიც გადაწერე (თუ არ მონიშნე, მხოლოდ ცარიელს შეავსებს)
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button className="h-11 w-full" disabled={pending} onClick={submit}>
            {pending ? "..." : "გენერაცია"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}