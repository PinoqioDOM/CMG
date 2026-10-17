"use client";

import { useOptimistic, useTransition } from "react";
import { toggleChecklist } from "./actions";

export type Item = {
  id: string;
  title: string;
  frequency: "daily" | "weekly" | "monthly";
  done: boolean;
};

export type Locked = { daily: boolean; weekly: boolean; monthly: boolean };

function Column({
  title,
  hint,
  list,
  locked,
  onToggle,
}: {
  title: string;
  hint: string;
  list: Item[];
  locked: boolean;
  onToggle: (i: Item) => void;
}) {
  const done = list.filter((i) => i.done).length;
  return (
    <section className="space-y-3 rounded-xl border p-3">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{title}</h2>
          <span className="text-sm text-muted-foreground">
            {done} / {list.length}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          {hint}
          {locked && " · 🔒 დახურულია"}
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded bg-muted">
        <div
          className="h-full bg-green-500"
          style={{ width: `${list.length ? (done / list.length) * 100 : 0}%` }}
        />
      </div>
      <div className="space-y-2">
        {list.length === 0 && (
          <p className="text-sm text-muted-foreground">{"პუნქტები არ არის (დაამატე „შაბლონებში“)"}</p>
        )}
        {list.map((i) => (
          <label
            key={i.id}
            className={`flex min-h-12 items-center gap-3 rounded-lg border p-3 ${
              locked ? "cursor-not-allowed opacity-70" : "cursor-pointer"
            } ${i.done ? "bg-muted/50" : ""}`}
          >
            <input
              type="checkbox"
              className="size-5 shrink-0"
              checked={i.done}
              disabled={locked}
              onChange={() => onToggle(i)}
            />
            <span className={i.done ? "text-muted-foreground line-through" : ""}>{i.title}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

export function Checklist({
  items,
  date,
  dayLabel,
  weekLabel,
  monthLabel,
  locked,
}: {
  items: Item[];
  date: string;
  dayLabel: string;
  weekLabel: string;
  monthLabel: string;
  locked: Locked;
}) {
  const [opt, apply] = useOptimistic(items, (s, id: string) =>
    s.map((i) => (i.id === id ? { ...i, done: !i.done } : i))
  );
  const [, start] = useTransition();

  function toggle(i: Item) {
    start(async () => {
      apply(i.id);
      const r = await toggleChecklist(i.id, date, i.frequency, !i.done);
      if (r?.error) alert(r.error);
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Column
        title="დღიური"
        hint={dayLabel}
        list={opt.filter((i) => i.frequency === "daily")}
        locked={locked.daily}
        onToggle={toggle}
      />
      <Column
        title="კვირეული"
        hint={weekLabel}
        list={opt.filter((i) => i.frequency === "weekly")}
        locked={locked.weekly}
        onToggle={toggle}
      />
      <Column
        title="თვიური"
        hint={monthLabel}
        list={opt.filter((i) => i.frequency === "monthly")}
        locked={locked.monthly}
        onToggle={toggle}
      />
    </div>
  );
}