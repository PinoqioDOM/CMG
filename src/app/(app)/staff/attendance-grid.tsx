"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { clearAttendance, moveAttendance, setAttendance } from "./attendance-actions";
import { RemoveFromRoster } from "./roster-controls";

export type Rec = {
  employee_id: string;
  date: string;
  shift_type: string | null;
  hours: number | null;
  status: string;
  note: string | null;
};
export type Emp = { id: string; full_name: string; position: string; is_active: boolean };

const weekdayShort = ["კვ", "ორ", "სა", "ოთ", "ხუ", "პა", "შა"];

function cell(r?: Rec) {
  if (!r) return { text: "", cls: "bg-background" };
  if (r.status === "day_off") return { text: "დ", cls: "bg-muted text-muted-foreground" };
  if (r.status === "vacation") return { text: "შ", cls: "bg-purple-100 text-purple-700" };
  if (r.status === "absent") return { text: "X", cls: "bg-red-100 text-red-700" };
  const h = r.hours ?? 0;
  const text = h % 1 === 0 ? String(h) : h.toFixed(1);
  const cls =
    r.shift_type === "24h"
      ? "bg-blue-100 text-blue-800"
      : r.shift_type === "day"
        ? "bg-amber-100 text-amber-800"
        : r.shift_type === "night"
          ? "bg-indigo-100 text-indigo-800"
          : "bg-green-100 text-green-800";
  return { text, cls };
}

type Kind = "24h" | "day" | "night" | "regular" | "day_off" | "vacation" | "absent";
type Move = { from: string; to: string };

/* eslint-disable react-hooks/refs -- dnd-kit-ის hook-ები: setNodeRef/listeners/isOver რენდერში გამოყენება მისი ოფიციალური API-ა, წესი აქ ცრუ განგაშს იძლევა */
function GridCell({
  cellKey,
  rec,
  onOpen,
}: {
  cellKey: string;
  rec?: Rec;
  onOpen: () => void;
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: cellKey });
  const {
    setNodeRef: setDragRef,
    listeners,
    attributes,
    isDragging,
  } = useDraggable({ id: `d:${cellKey}`, disabled: !rec });
  const c = cell(rec);
  return (
    <td ref={setDropRef} className="border-b p-0.5 text-center">
      <button
        ref={setDragRef}
        {...listeners}
        {...attributes}
        type="button"
        title={rec?.note ?? undefined}
        onClick={onOpen}
        className={`size-9 rounded text-xs font-medium ${c.cls} ${
          rec?.note ? "ring-1 ring-foreground/30" : ""
        } ${isOver ? "outline outline-2 outline-foreground" : ""} ${
          isDragging ? "opacity-30" : ""
        }`}
      >
        {c.text}
      </button>
    </td>
  );
}
/* eslint-enable react-hooks/refs */

export function AttendanceGrid({
  employees,
  records,
  year,
  month,
  days,
  today,
}: {
  employees: Emp[];
  records: Rec[];
  year: number;
  month: number;
  days: number;
  today: string;
}) {
  const [optimistic, applyMove] = useOptimistic(records, (state, m: Move) => {
    const [fe, fd] = m.from.split("|");
    const [te, td] = m.to.split("|");
    const src = state.find((r) => r.employee_id === fe && r.date === fd);
    if (!src) return state;
    const dst = state.find((r) => r.employee_id === te && r.date === td);
    const out = state.filter((r) => r !== src && r !== dst);
    out.push({ ...src, employee_id: te, date: td });
    if (dst) out.push({ ...dst, employee_id: fe, date: fd });
    return out;
  });

  const map = useMemo(() => {
    const m = new Map<string, Rec>();
    optimistic.forEach((r) => m.set(`${r.employee_id}|${r.date}`, r));
    return m;
  }, [optimistic]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } })
  );

  const [dragging, setDragging] = useState<Rec | null>(null);
  const [sel, setSel] = useState<{ emp: Emp; date: string } | null>(null);
  const [note, setNote] = useState("");
  const [repeat, setRepeat] = useState<"none" | "every" | "weekdays">("none");
  const [every, setEvery] = useState("3");
  const [hours, setHours] = useState("7");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const dateStr = (d: number) =>
    `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const dayList = Array.from({ length: days }, (_, i) => i + 1);

  function onDragStart(e: DragStartEvent) {
    const key = String(e.active.id).replace(/^d:/, "");
    setDragging(map.get(key) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    if (!e.over) return;
    const from = String(e.active.id).replace(/^d:/, "");
    const to = String(e.over.id);
    if (from === to) return;
    const [fe, fd] = from.split("|");
    const [te, td] = to.split("|");
    start(async () => {
      applyMove({ from, to });
      const r = await moveAttendance(fe, fd, te, td);
      if (r?.error) alert(r.error);
    });
  }

  function open(emp: Emp, d: number) {
    const date = dateStr(d);
    const r = map.get(`${emp.id}|${date}`);
    setNote(r?.note ?? "");
    setRepeat("none");
    setError("");
    setSel({ emp, date });
  }

  function save(kind: Kind) {
    if (!sel) return;
    start(async () => {
      const res = await setAttendance({
        employee_id: sel.emp.id,
        date: sel.date,
        kind,
        hours: kind === "regular" ? hours : undefined,
        note,
        repeat,
        every: repeat === "every" ? every : undefined,
      });
      if (res?.error) setError(res.error);
      else setSel(null);
    });
  }

  function clear() {
    if (!sel) return;
    start(async () => {
      const res = await clearAttendance(sel.emp.id, sel.date);
      if (res?.error) setError(res.error);
      else setSel(null);
    });
  }

  const total = (id: string) =>
    dayList.reduce((s, d) => {
      const r = map.get(`${id}|${dateStr(d)}`);
      return s + (r && r.status === "present" ? (r.hours ?? 0) : 0);
    }, 0);

  const presets: { kind: Kind; label: string }[] = [
    { kind: "24h", label: "24 სთ" },
    { kind: "day", label: "დღე 12" },
    { kind: "night", label: "ღამე 12" },
    { kind: "day_off", label: "დასვენება" },
    { kind: "vacation", label: "შვებულება" },
    { kind: "absent", label: "გაცდენა" },
  ];
  const selDate = sel ? sel.date.split("-").reverse().slice(0, 2).join(".") : "";
  const hasRec = sel ? map.has(`${sel.emp.id}|${sel.date}`) : false;
  const overlay = cell(dragging ?? undefined);

  return (
    <>
      <p className="mb-2 text-xs text-muted-foreground">
        გადასატანად დაიჭირე უჯრა და გადაიტანე სხვა უჯრაზე (ტელეფონზე ცოტა ხანს დააჭირე). თუ სამიზნე
        უჯრა დაკავებულია, ცვლები ადგილებს გაუცვლიან.
      </p>

      <DndContext
        id="attendance-grid"
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragging(null)}
      >
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-max border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-40 border-b bg-background p-2 text-left">
                  თანამშრომელი
                </th>
                {dayList.map((d) => {
                  const date = dateStr(d);
                  const wd = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
                  const weekend = wd === 0 || wd === 6;
                  return (
                    <th
                      key={d}
                      className={`min-w-9 border-b p-1 text-center font-normal ${
                        date === today ? "bg-yellow-100" : weekend ? "bg-muted" : ""
                      }`}
                    >
                      <div className="font-semibold">{d}</div>
                      <div className="text-[10px] text-muted-foreground">{weekdayShort[wd]}</div>
                    </th>
                  );
                })}
                <th className="border-b p-2 text-center">სთ</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td className="sticky left-0 z-10 min-w-40 border-b bg-background p-2 text-left font-medium">
                    <div className="flex items-center justify-between gap-1">
                      <span>{e.full_name}</span>
                      <RemoveFromRoster
                        ym={`${year}-${String(month).padStart(2, "0")}`}
                        employeeId={e.id}
                        name={e.full_name}
                      />
                    </div>
                  </td>
                  {dayList.map((d) => {
                    const key = `${e.id}|${dateStr(d)}`;
                    return (
                      <GridCell
                        key={d}
                        cellKey={key}
                        rec={map.get(key)}
                        onOpen={() => open(e, d)}
                      />
                    );
                  })}
                  <td className="border-b p-2 text-center font-semibold">{total(e.id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DragOverlay>
          {dragging ? (
            <div
              className={`flex size-10 items-center justify-center rounded text-sm font-semibold shadow-lg ${overlay.cls}`}
            >
              {overlay.text}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded bg-blue-100 px-2 py-1 text-blue-800">24 სთ</span>
        <span className="rounded bg-amber-100 px-2 py-1 text-amber-800">დღე</span>
        <span className="rounded bg-indigo-100 px-2 py-1 text-indigo-800">ღამე</span>
        <span className="rounded bg-green-100 px-2 py-1 text-green-800">სამუშაო დღე</span>
        <span className="rounded bg-muted px-2 py-1">დ დასვენება</span>
        <span className="rounded bg-purple-100 px-2 py-1 text-purple-700">შ შვებულება</span>
        <span className="rounded bg-red-100 px-2 py-1 text-red-700">X გაცდენა</span>
      </div>

      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {sel?.emp.full_name} · {selDate}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <select
                value={repeat}
                onChange={(e) => setRepeat(e.target.value as typeof repeat)}
                className="h-11 rounded-md border bg-background px-2 text-sm"
              >
                <option value="none">არ გაიმეორო</option>
                <option value="every">გაიმეორე ყოველ N დღეში</option>
                <option value="weekdays">გაიმეორე ორშ–პარ თვის ბოლომდე</option>
              </select>
              {repeat === "every" ? (
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={every}
                  onChange={(e) => setEvery(e.target.value)}
                  className="h-11"
                  aria-label="N დღე"
                />
              ) : (
                <div />
              )}
            </div>

            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="შენიშვნა (არასავალდებულო)"
              className="h-11"
            />

            <div className="grid grid-cols-2 gap-2">
              {presets.map((p) => (
                <Button
                  key={p.kind}
                  type="button"
                  variant="outline"
                  className="h-12"
                  disabled={pending}
                  onClick={() => save(p.kind)}
                >
                  {p.label}
                </Button>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                type="number"
                step="0.5"
                min={0.5}
                max={24}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="h-12 w-24"
                aria-label="საათები"
              />
              <Button
                type="button"
                className="h-12 flex-1"
                disabled={pending}
                onClick={() => save("regular")}
              >
                სამუშაო დღე ({hours} სთ)
              </Button>
            </div>

            {hasRec && (
              <Button
                type="button"
                variant="ghost"
                className="h-10 w-full text-red-600"
                disabled={pending}
                onClick={clear}
              >
                უჯრის გასუფთავება
              </Button>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}