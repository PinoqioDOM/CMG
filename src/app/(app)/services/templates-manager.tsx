"use client";

import { useOptimistic, useState, useTransition } from "react";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeleteButton } from "@/components/delete-button";
import { frequencyLabels } from "@/lib/labels";
import {
  addTemplate,
  deleteService,
  deleteTemplate,
  moveTemplate,
  renameTemplate,
  setTemplateFrequency,
} from "./actions";

export type Template = { id: string; title: string; frequency: string };

type Move = { id: string; frequency: string; beforeId: string | null };

const freqs = ["daily", "weekly", "monthly"] as const;
const sel = "h-11 rounded-md border bg-background px-2 text-sm";

function applyMove(list: Template[], m: Move): Template[] {
  const item = list.find((t) => t.id === m.id);
  if (!item) return list;
  const rest = list.filter((t) => t.id !== m.id);
  const moved = { ...item, frequency: m.frequency };
  if (m.beforeId) {
    const idx = rest.findIndex((t) => t.id === m.beforeId);
    if (idx >= 0) {
      rest.splice(idx, 0, moved);
      return rest;
    }
  }
  return [...rest, moved];
}

// ჯერ კონკრეტული პუნქტი, თუ არა და გრაფა
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const item = hits.find((h) => String(h.id).startsWith("item:"));
  return item ? [item] : hits;
};

function Row({
  t,
  onRename,
  onFrequency,
}: {
  t: Template;
  onRename: (t: Template, v: string) => void;
  onFrequency: (t: Template, v: string) => void;
}) {
  const drag = useDraggable({ id: `t:${t.id}` });
  const drop = useDroppable({ id: `item:${t.id}` });

  return (
    <div
      ref={(n) => {
        drag.setNodeRef(n);
        drop.setNodeRef(n);
      }}
      style={{
        transform: drag.transform
          ? `translate3d(${drag.transform.x}px, ${drag.transform.y}px, 0)`
          : undefined,
        zIndex: drag.isDragging ? 50 : undefined,
      }}
      className={`space-y-1.5 rounded-lg border bg-background p-2 ${
        drop.isOver && !drag.isDragging ? "ring-2 ring-foreground/40" : ""
      }`}
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          {...drag.listeners}
          {...drag.attributes}
          aria-label="გადატანა"
          className="shrink-0 cursor-grab touch-none text-muted-foreground"
        >
          <GripVertical className="size-5" />
        </button>
        <Input
          key={`${t.id}-${t.title}`}
          defaultValue={t.title}
          onBlur={(e) => onRename(t, e.target.value)}
          className="h-11"
        />
      </div>
      <div className="flex items-center gap-2">
        <select
          value={t.frequency}
          onChange={(e) => onFrequency(t, e.target.value)}
          className="h-9 flex-1 rounded-md border bg-background px-2 text-sm"
          aria-label="სიხშირე"
        >
          {freqs.map((f) => (
            <option key={f} value={f}>
              {frequencyLabels[f]}
            </option>
          ))}
        </select>
        <DeleteButton
          action={() => deleteTemplate(t.id)}
          title="პუნქტის წაშლა"
          description={`„${t.title}" წაიშლება, მისი მონიშვნების ისტორიასთან ერთად.`}
        />
      </div>
    </div>
  );
}

function Column({
  freq,
  children,
  count,
}: {
  freq: string;
  children: React.ReactNode;
  count: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${freq}` });
  return (
    <section
      ref={setNodeRef}
      className={`min-h-40 space-y-2 rounded-xl border p-3 ${isOver ? "bg-muted" : ""}`}
    >
      <h2 className="font-semibold">
        {frequencyLabels[freq]} ({count})
      </h2>
      {children}
    </section>
  );
}

export function TemplatesManager({
  role,
  templates,
  isCustom,
}: {
  role: string;
  templates: Template[];
  isCustom: boolean;
}) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [opt, apply] = useOptimistic(templates, applyMove);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } })
  );

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("position", role);
    start(async () => {
      const r = await addTemplate(fd);
      if (r?.error) setError(r.error);
      else {
        setError("");
        form.reset();
      }
    });
  }

  function onRename(t: Template, value: string) {
    const v = value.trim();
    if (!v || v === t.title) return;
    start(async () => {
      const r = await renameTemplate(t.id, v);
      if (r?.error) alert(r.error);
    });
  }

  function onFrequency(t: Template, value: string) {
    start(async () => {
      const r = await setTemplateFrequency(t.id, value);
      if (r?.error) alert(r.error);
    });
  }

  function onDragEnd(e: DragEndEvent) {
    if (!e.over) return;
    const activeId = String(e.active.id).replace(/^t:/, "");
    const overId = String(e.over.id);

    let frequency: string;
    let beforeId: string | null = null;

    if (overId.startsWith("item:")) {
      const targetId = overId.slice(5);
      if (targetId === activeId) return;
      const target = opt.find((t) => t.id === targetId);
      if (!target) return;
      frequency = target.frequency;
      beforeId = targetId;
    } else if (overId.startsWith("col:")) {
      frequency = overId.slice(4);
    } else {
      return;
    }

    const move: Move = { id: activeId, frequency, beforeId };
    const orderedIds = applyMove(opt, move)
      .filter((t) => t.frequency === frequency)
      .map((t) => t.id);

    start(async () => {
      apply(move);
      const r = await moveTemplate(role, activeId, frequency, orderedIds);
      if (r?.error) alert(r.error);
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onAdd} className="flex flex-wrap gap-2 rounded-lg border p-3">
        <Input name="title" placeholder="ახალი პუნქტი" className="h-11 min-w-48 flex-1" required />
        <select name="frequency" defaultValue="daily" className={sel}>
          {freqs.map((f) => (
            <option key={f} value={f}>
              {frequencyLabels[f]}
            </option>
          ))}
        </select>
        <Button type="submit" className="h-11" disabled={pending}>
          + დამატება
        </Button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </form>

      <DndContext
        id="templates-board"
        sensors={sensors}
        collisionDetection={collision}
        onDragEnd={onDragEnd}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {freqs.map((freq) => {
            const list = opt.filter((t) => t.frequency === freq);
            return (
              <Column key={freq} freq={freq} count={list.length}>
                {list.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    ცარიელია. გადმოიტანე პუნქტი აქ
                  </p>
                )}
                {list.map((t) => (
                  <Row key={t.id} t={t} onRename={onRename} onFrequency={onFrequency} />
                ))}
              </Column>
            );
          })}
        </div>
      </DndContext>

      <p className="text-xs text-muted-foreground">
        პუნქტი გადაიტანე ⋮⋮ ხატულით: სხვა გრაფაში (სიხშირე შეიცვლება) ან სხვა პუნქტის წინ
        (რიგითობა შეიცვლება). სახელის შესაცვლელად ჩაასწორე ტექსტი და გადადი სხვა ადგილას.
      </p>

      {isCustom && (
        <div className="flex justify-end">
          <DeleteButton
            action={() => deleteService(role)}
            title={`სერვისის „${role}" წაშლა`}
            description="ამ სერვისის ყველა პუნქტი და მონიშვნების ისტორია სამუდამოდ წაიშლება."
          />
        </div>
      )}
    </div>
  );
}