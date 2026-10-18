"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveSchedule } from "../attendance-actions";
import type { Rec } from "../attendance-grid";

type Kind = "24h" | "day" | "night" | "regular" | "day_off" | "vacation" | "absent";
type Brush = Kind | "clear";
type Cell = { kind: Kind; hours: number };

const weekdayShort = ["კვ", "ორ", "სა", "ოთ", "ხუ", "პა", "შა"];

function fromRec(r: Rec): Cell | null {
  if (r.status === "day_off" || r.status === "vacation" || r.status === "absent") {
    return { kind: r.status, hours: 0 };
  }
  if (r.status !== "present") return null;
  if (r.shift_type === "24h") return { kind: "24h", hours: 24 };
  if (r.shift_type === "day") return { kind: "day", hours: 12 };
  if (r.shift_type === "night") return { kind: "night", hours: 12 };
  return { kind: "regular", hours: r.hours ?? 0 };
}

function view(c?: Cell) {
  if (!c) return { text: "", cls: "bg-background" };
  if (c.kind === "day_off") return { text: "დ", cls: "bg-muted text-muted-foreground" };
  if (c.kind === "vacation") return { text: "შ", cls: "bg-purple-100 text-purple-700" };
  if (c.kind === "absent") return { text: "X", cls: "bg-red-100 text-red-700" };
  const text = c.hours % 1 === 0 ? String(c.hours) : c.hours.toFixed(1);
  if (c.kind === "24h") return { text, cls: "bg-blue-100 text-blue-800" };
  if (c.kind === "day") return { text, cls: "bg-amber-100 text-amber-800" };
  if (c.kind === "night") return { text, cls: "bg-indigo-100 text-indigo-800" };
  return { text, cls: "bg-green-100 text-green-800" };
}

const same = (a?: Cell, b?: Cell) =>
  (!a && !b) || (!!a && !!b && a.kind === b.kind && (a.kind !== "regular" || a.hours === b.hours));

const brushes: { key: Brush; label: string; cls: string }[] = [
  { key: "24h", label: "24 სთ", cls: "bg-blue-100 text-blue-800" },
  { key: "day", label: "დღე 12", cls: "bg-amber-100 text-amber-800" },
  { key: "night", label: "ღამე 12", cls: "bg-indigo-100 text-indigo-800" },
  { key: "regular", label: "სამუშაო დღე", cls: "bg-green-100 text-green-800" },
  { key: "day_off", label: "დასვენება", cls: "bg-muted" },
  { key: "vacation", label: "შვებულება", cls: "bg-purple-100 text-purple-700" },
  { key: "absent", label: "გაცდენა", cls: "bg-red-100 text-red-700" },
  { key: "clear", label: "✕ წაშლა", cls: "border" },
];

export function ScheduleEditor({
  ym,
  employees,
  records,
  year,
  month,
  days,
  today,
}: {
  ym: string;
  employees: { id: string; full_name: string }[];
  records: Rec[];
  year: number;
  month: number;
  days: number;
  today: string;
}) {
  const router = useRouter();
  const orig = useMemo(() => {
    const m: Record<string, Cell> = {};
    records.forEach((r) => {
      const c = fromRec(r);
      if (c) m[`${r.employee_id}|${r.date}`] = c;
    });
    return m;
  }, [records]);

  const [draft, setDraft] = useState<Record<string, Cell>>(orig);
  const [brush, setBrush] = useState<Brush>("24h");
  const [hours, setHours] = useState("7");
  const [repeat, setRepeat] = useState<"none" | "every" | "weekdays">("none");
  const [every, setEvery] = useState("3");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const painting = useRef(false);
  const skipClick = useRef(false);

  useEffect(() => {
    const up = () => {
      painting.current = false;
    };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  const dateStr = (d: number) => `${ym}-${String(d).padStart(2, "0")}`;
  const dayList = Array.from({ length: days }, (_, i) => i + 1);
  const wdOf = (d: number) => new Date(Date.UTC(year, month - 1, d)).getUTCDay();

  function makeCell(): Cell | null | undefined {
    if (brush === "clear") return null;
    if (brush === "regular") {
      const h = Number(hours);
      if (!(h > 0 && h <= 24)) {
        setError("მიუთითე საათები (1–24)");
        return undefined;
      }
      return { kind: "regular", hours: h };
    }
    const h = brush === "24h" ? 24 : brush === "day" || brush === "night" ? 12 : 0;
    return { kind: brush, hours: h };
  }

  function applyDays(empId: string, ds: number[]) {
    const c = makeCell();
    if (c === undefined) return;
    setError("");
    setDraft((prev) => {
      const next = { ...prev };
      for (const d of ds) {
        const key = `${empId}|${dateStr(d)}`;
        if (c === null) delete next[key];
        else next[key] = c;
      }
      return next;
    });
  }

  function daysFor(d: number) {
    if (repeat === "every") {
      const n = Math.max(1, Math.min(31, Number(every) || 1));
      const out: number[] = [];
      for (let x = d; x <= days; x += n) out.push(x);
      return out;
    }
    if (repeat === "weekdays") {
      const out = new Set<number>([d]);
      for (let x = d; x <= days; x++) {
        const wd = wdOf(x);
        if (wd >= 1 && wd <= 5) out.add(x);
      }
      return Array.from(out);
    }
    return [d];
  }

  function rowAction(empId: string, action: string) {
    if (action === "weekdays") {
      applyDays(
        empId,
        dayList.filter((d) => wdOf(d) >= 1 && wdOf(d) <= 5)
      );
    } else if (action === "all") {
      applyDays(empId, dayList);
    } else if (action === "clear") {
      setDraft((prev) => {
        const next = { ...prev };
        dayList.forEach((d) => delete next[`${empId}|${dateStr(d)}`]);
        return next;
      });
    }
  }

  const changes = useMemo(() => {
    const out: {
      employee_id: string;
      date: string;
      kind: Kind | null;
      hours?: number;
    }[] = [];
    Array.from(new Set([...Object.keys(orig), ...Object.keys(draft)])).forEach((key) => {
      const o = orig[key];
      const d = draft[key];
      if (same(o, d)) return;
      const [employee_id, date] = key.split("|");
      out.push(
        d
          ? { employee_id, date, kind: d.kind, hours: d.kind === "regular" ? d.hours : undefined }
          : { employee_id, date, kind: null }
      );
    });
    return out;
  }, [orig, draft]);

  const total = (id: string) =>
    dayList.reduce((s, d) => {
      const c = draft[`${id}|${dateStr(d)}`];
      return s + (c && c.kind !== "day_off" && c.kind !== "vacation" && c.kind !== "absent" ? c.hours : 0);
    }, 0);

  function save() {
    start(async () => {
      const r = await saveSchedule({ ym, changes });
      if ("error" in r) setError(r.error ?? "შეცდომა");
      else router.push(`/staff?ym=${ym}`);
    });
  }

  return (
    <>
      <div className="sticky top-3 z-20 mb-4 space-y-3 rounded-xl border bg-background p-3 shadow-sm">
        <div className="flex flex-wrap gap-1.5">
          {brushes.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => setBrush(b.key)}
              className={`h-10 rounded-md px-3 text-sm font-medium ${b.cls} ${
                brush === b.key ? "ring-2 ring-foreground" : ""
              }`}
            >
              {b.label}
            </button>
          ))}
          {brush === "regular" && (
            <Input
              type="number"
              step="0.5"
              min={0.5}
              max={24}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="h-10 w-20"
              aria-label="საათები"
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={repeat}
            onChange={(e) => setRepeat(e.target.value as typeof repeat)}
            className="h-10 rounded-md border bg-background px-2 text-sm"
          >
            <option value="none">დაწკაპუნებით / გადათრევით ვხატავ</option>
            <option value="every">დაწკაპუნებაზე გაიმეორე ყოველ N დღეში</option>
            <option value="weekdays">დაწკაპუნებაზე გაიმეორე ორშ–პარ თვის ბოლომდე</option>
          </select>
          {repeat === "every" && (
            <Input
              type="number"
              min={1}
              max={31}
              value={every}
              onChange={(e) => setEvery(e.target.value)}
              className="h-10 w-20"
              aria-label="N დღე"
            />
          )}

          <span className="ml-auto text-sm text-muted-foreground">
            ცვლილება: <b>{changes.length}</b>
          </span>
          <Button
            variant="outline"
            className="h-10"
            disabled={pending}
            onClick={() => setDraft({})}
          >
            ყველას გასუფთავება
          </Button>
          <Button
            variant="outline"
            className="h-10"
            disabled={pending || changes.length === 0}
            onClick={() => setDraft(orig)}
          >
            გაუქმება
          </Button>
          <Link
            href={`/staff?ym=${ym}`}
            className="inline-flex h-10 items-center rounded-md border px-3 text-sm"
          >
            უკან
          </Link>
          <Button className="h-10" disabled={pending || changes.length === 0} onClick={save}>
            {pending ? "ინახება..." : "შენახვა"}
          </Button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-max select-none border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-48 border-b bg-background p-2 text-left">
                თანამშრომელი
              </th>
              {dayList.map((d) => {
                const wd = wdOf(d);
                return (
                  <th
                    key={d}
                    className={`min-w-9 border-b p-1 text-center font-normal ${
                      dateStr(d) === today ? "bg-yellow-100" : wd === 0 || wd === 6 ? "bg-muted" : ""
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
                <td className="sticky left-0 z-10 border-b bg-background p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{e.full_name}</span>
                    <select
                      value=""
                      onChange={(ev) => rowAction(e.id, ev.target.value)}
                      className="h-8 w-8 cursor-pointer rounded-md border bg-background text-xs"
                      aria-label="რიგის ქმედება"
                      title="რიგის ქმედება (მიმდინარე ფუნჯით)"
                    >
                      <option value="">⋯</option>
                      <option value="weekdays">ორშ–პარ შევსება</option>
                      <option value="all">ყველა დღე</option>
                      <option value="clear">რიგის გასუფთავება</option>
                    </select>
                  </div>
                </td>
                {dayList.map((d) => {
                  const key = `${e.id}|${dateStr(d)}`;
                  const c = draft[key];
                  const v = view(c);
                  const changed = !same(orig[key], c);
                  return (
                    <td key={d} className="border-b p-0.5 text-center">
                      <button
                        type="button"
                        onPointerDown={(ev) => {
                          if (ev.pointerType !== "mouse") return;
                          ev.preventDefault();
                          skipClick.current = true;
                          painting.current = repeat === "none";
                          applyDays(e.id, daysFor(d));
                        }}
                        onPointerEnter={(ev) => {
                          if (ev.pointerType === "mouse" && painting.current) applyDays(e.id, [d]);
                        }}
                        onClick={() => {
                          if (skipClick.current) {
                            skipClick.current = false;
                            return;
                          }
                          applyDays(e.id, daysFor(d));
                        }}
                        className={`size-9 rounded text-xs font-medium ${v.cls} ${
                          changed ? "ring-2 ring-foreground/50" : ""
                        }`}
                      >
                        {v.text}
                      </button>
                    </td>
                  );
                })}
                <td className="border-b p-2 text-center font-semibold">{total(e.id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        აირჩიე ფუნჯი და დააჭირე უჯრებს (კომპიუტერზე შეგიძლია გადათრევაც). ჩარჩოიანი უჯრები ის არის,
        რაც შეცვალე და ჯერ არ შეგინახავს. &bdquo;შენახვა&ldquo; ბაზაში ჩაწერს.
      </p>
    </>
  );
}