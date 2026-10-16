"use client";

import { useOptimistic, useTransition } from "react";
import { toggleChecklist } from "./actions";

export type Item = {
  id: string;
  title: string;
  frequency: "daily" | "monthly";
  done: boolean;
};

function Section({
  title,
  list,
  onToggle,
}: {
  title: string;
  list: Item[];
  onToggle: (i: Item) => void;
}) {
  const done = list.filter((i) => i.done).length;
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-sm text-muted-foreground">
          {done} / {list.length}
        </span>
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded bg-muted">
        <div
          className="h-full bg-green-500"
          style={{ width: `${list.length ? (done / list.length) * 100 : 0}%` }}
        />
      </div>
      <div className="space-y-2">
        {list.length === 0 && (
        <p className="text-sm text-muted-foreground">
            {'პუნქტები არ არის (დაამატე „შაბლონები" ჩანართში)'}
        </p>
        )}
        {list.map((i) => (
          <label
            key={i.id}
            className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border p-3 ${
              i.done ? "bg-muted/50" : ""
            }`}
          >
            <input
              type="checkbox"
              className="size-5"
              checked={i.done}
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
  monthLabel,
}: {
  items: Item[];
  date: string;
  dayLabel: string;
  monthLabel: string;
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
    <>
      <Section
        title={`დღიური · ${dayLabel}`}
        list={opt.filter((i) => i.frequency === "daily")}
        onToggle={toggle}
      />
      <Section
        title={`თვიური · ${monthLabel}`}
        list={opt.filter((i) => i.frequency === "monthly")}
        onToggle={toggle}
      />
    </>
  );
}