"use client";

import { useOptimistic, useState, useTransition } from "react";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/form-field";
import { SelectField } from "@/components/native-fields";
import { categoryLabels, priorityLabels, taskStatusLabels } from "@/lib/labels";
import {
  createTask,
  deleteTask,
  setTaskDate,
  updateTask,
  updateTaskStatus,
} from "../actions";

export type PlanTask = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: "todo" | "in_progress" | "done";
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
  assignee: string | null;
};

type Update = { id: string; due_date?: string | null; status?: PlanTask["status"] };
type DialogState = { task?: PlanTask; date?: string } | null;

const weekdayShort = ["ორშ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ", "კვ"];
const statusCls: Record<string, string> = {
  todo: "bg-muted",
  in_progress: "bg-amber-100 text-amber-900",
  done: "bg-green-100 text-green-800",
};
const dm = (s: string) => s.split("-").reverse().slice(0, 2).join(".");
const toOptions = (m: Record<string, string>) =>
  Object.entries(m).map(([value, label]) => ({ value, label }));

function Chip({
  t,
  onOpen,
  onToggle,
}: {
  t: PlanTask;
  onOpen: (t: PlanTask) => void;
  onToggle: (t: PlanTask) => void;
}) {
  const { setNodeRef, listeners, attributes, transform, isDragging } = useDraggable({
    id: `task:${t.id}`,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
        zIndex: isDragging ? 50 : undefined,
      }}
      onClick={() => onOpen(t)}
      title={t.assignee ? `${t.title} · ${t.assignee}` : t.title}
      className={`flex cursor-grab items-start gap-1 rounded px-1.5 py-1 text-xs leading-snug ${
        statusCls[t.status]
      } ${isDragging ? "opacity-80 shadow-lg" : ""}`}
    >
      <input
        type="checkbox"
        checked={t.status === "done"}
        onChange={() => onToggle(t)}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="mt-0.5 size-3.5 shrink-0"
        aria-label="დასრულება"
      />
      <span className={t.status === "done" ? "line-through opacity-70" : ""}>
        {t.priority === "high" ? "❗" : ""}
        {t.title}
      </span>
    </div>
  );
}

function DayCell({
  date,
  inMonth,
  isToday,
  tasks,
  onAdd,
  onOpen,
  onToggle,
}: {
  date: string;
  inMonth: boolean;
  isToday: boolean;
  tasks: PlanTask[];
  onAdd: (date: string) => void;
  onOpen: (t: PlanTask) => void;
  onToggle: (t: PlanTask) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${date}` });
  const day = Number(date.slice(8));
  return (
    <div
      ref={setNodeRef}
      className={`group min-h-28 space-y-1 border-b border-l p-1 ${
        isOver ? "bg-muted" : inMonth ? "" : "bg-muted/30"
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-xs ${
            isToday
              ? "rounded bg-foreground px-1.5 py-0.5 font-semibold text-background"
              : inMonth
                ? "font-medium"
                : "text-muted-foreground"
          }`}
        >
          {day === 1 ? dm(date) : day}
        </span>
        <button
          type="button"
          onClick={() => onAdd(date)}
          aria-label="დავალების დამატება"
          className="rounded p-0.5 text-muted-foreground opacity-60 hover:bg-muted hover:opacity-100 md:opacity-0 md:group-hover:opacity-100"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      {tasks.map((t) => (
        <Chip key={t.id} t={t} onOpen={onOpen} onToggle={onToggle} />
      ))}
    </div>
  );
}

function UndatedBox({
  tasks,
  onOpen,
  onToggle,
}: {
  tasks: PlanTask[];
  onOpen: (t: PlanTask) => void;
  onToggle: (t: PlanTask) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "undated" });
  return (
    <div
      ref={setNodeRef}
      className={`mt-4 space-y-2 rounded-lg border p-3 ${isOver ? "bg-muted" : ""}`}
    >
      <div className="text-sm font-semibold">
        თარიღის გარეშე ({tasks.length}){" "}
        <span className="font-normal text-muted-foreground">
          · გადაათრიე დღეზე, რომ თარიღი მიენიჭოს
        </span>
      </div>
      <div className="grid gap-1.5 md:grid-cols-2 lg:grid-cols-3">
        {tasks.length === 0 && (
          <p className="text-sm text-muted-foreground">ყველა დავალებას თარიღი აქვს</p>
        )}
        {tasks.map((t) => (
          <Chip key={t.id} t={t} onOpen={onOpen} onToggle={onToggle} />
        ))}
      </div>
    </div>
  );
}

function TaskDialog({
  state,
  employees,
  onClose,
}: {
  state: NonNullable<DialogState>;
  employees: { id: string; full_name: string }[];
  onClose: () => void;
}) {
  const t = state.task;
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = t ? await updateTask(t.id, fd) : await createTask(fd);
      if (r?.error) setError(r.error);
      else onClose();
    });
  }

  function remove() {
    if (!t || !confirm("დავალება სამუდამოდ წაიშლება. გავაგრძელო?")) return;
    start(async () => {
      const r = await deleteTask(t.id);
      if (r?.error) setError(r.error);
      else onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t ? "დავალების რედაქტირება" : "ახალი დავალება"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FormField label="სათაური" name="title" defaultValue={t?.title} required />
          <div className="space-y-1.5">
            <label htmlFor="description" className="text-sm font-medium">
              აღწერა
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={t?.description ?? ""}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="თარიღი"
              name="due_date"
              type="date"
              defaultValue={t?.due_date ?? state.date ?? ""}
            />
            <SelectField
              label="შემსრულებელი"
              name="assigned_to"
              defaultValue={t?.assigned_to ?? ""}
              options={[
                { value: "", label: "—" },
                ...employees.map((e) => ({ value: e.id, label: e.full_name })),
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="კატეგორია"
              name="category"
              defaultValue={t?.category ?? "general"}
              options={toOptions(categoryLabels)}
            />
            <SelectField
              label="პრიორიტეტი"
              name="priority"
              defaultValue={t?.priority ?? "normal"}
              options={toOptions(priorityLabels)}
            />
          </div>
          {t && (
            <SelectField
              label="სტატუსი"
              name="status"
              defaultValue={t.status}
              options={toOptions(taskStatusLabels)}
            />
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="h-11 w-full" disabled={pending}>
            {pending ? "..." : "შენახვა"}
          </Button>
          {t && (
            <Button
              type="button"
              variant="ghost"
              className="h-10 w-full text-red-600"
              disabled={pending}
              onClick={remove}
            >
              წაშლა
            </Button>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PlanBoard({
  ym,
  weeks,
  tasks,
  employees,
  today,
}: {
  ym: string;
  weeks: string[][];
  tasks: PlanTask[];
  employees: { id: string; full_name: string }[];
  today: string;
}) {
  const [opt, apply] = useOptimistic(tasks, (s, u: Update) =>
    s.map((t) =>
      t.id === u.id
        ? {
            ...t,
            due_date: u.due_date !== undefined ? u.due_date : t.due_date,
            status: u.status ?? t.status,
          }
        : t
    )
  );
  const [dialog, setDialog] = useState<DialogState>(null);
  const [, start] = useTransition();

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } })
  );

  const byDate = new Map<string, PlanTask[]>();
  opt.forEach((t) => {
    if (!t.due_date) return;
    byDate.set(t.due_date, [...(byDate.get(t.due_date) ?? []), t]);
  });
  const undated = opt.filter((t) => !t.due_date);

  const inMonth = opt.filter((t) => t.due_date?.startsWith(ym));
  const done = inMonth.filter((t) => t.status === "done").length;
  const overdue = inMonth.filter((t) => t.status !== "done" && (t.due_date as string) < today).length;

  function toggle(t: PlanTask) {
    const status = t.status === "done" ? "todo" : "done";
    start(async () => {
      apply({ id: t.id, status });
      const r = await updateTaskStatus(t.id, status);
      if (r?.error) alert(r.error);
    });
  }

  function onDragEnd(e: DragEndEvent) {
    if (!e.over) return;
    const id = String(e.active.id).replace(/^task:/, "");
    const over = String(e.over.id);
    const date = over === "undated" ? null : over.startsWith("day:") ? over.slice(4) : undefined;
    if (date === undefined) return;
    const task = opt.find((t) => t.id === id);
    if (!task || task.due_date === date) return;
    start(async () => {
      apply({ id, due_date: date });
      const r = await setTaskDate(id, date);
      if (r?.error) alert(r.error);
    });
  }

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">დავალება ამ თვეში</div>
          <div className="text-lg font-semibold">{inMonth.length}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">შესრულებული</div>
          <div className="text-lg font-semibold text-green-700">{done}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">დარჩენილი</div>
          <div className="text-lg font-semibold">{inMonth.length - done}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">ვადაგასული</div>
          <div className={`text-lg font-semibold ${overdue ? "text-red-600" : ""}`}>{overdue}</div>
        </div>
      </div>

      <DndContext id="month-plan" sensors={sensors} onDragEnd={onDragEnd}>
        <div className="overflow-x-auto rounded-lg border">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))] bg-muted/40 text-xs">
              <div className="p-2 text-muted-foreground">კვირა</div>
              {weekdayShort.map((d) => (
                <div key={d} className="border-l p-2 text-center font-medium">
                  {d}
                </div>
              ))}
            </div>

            {weeks.map((days) => {
              const weekTasks = days.flatMap((d) => byDate.get(d) ?? []);
              const weekDone = weekTasks.filter((t) => t.status === "done").length;
              return (
                <div key={days[0]} className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))]">
                  <div className="space-y-1 border-b p-2 text-xs">
                    <div className="font-semibold">
                      {Number(days[0].slice(8))}–{Number(days[6].slice(8))}
                    </div>
                    <div className="text-muted-foreground">
                      {weekDone}/{weekTasks.length}
                    </div>
                  </div>
                  {days.map((d) => (
                    <DayCell
                      key={d}
                      date={d}
                      inMonth={d.startsWith(ym)}
                      isToday={d === today}
                      tasks={byDate.get(d) ?? []}
                      onAdd={(date) => setDialog({ date })}
                      onOpen={(task) => setDialog({ task })}
                      onToggle={toggle}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        <UndatedBox
          tasks={undated}
          onOpen={(task) => setDialog({ task })}
          onToggle={toggle}
        />
      </DndContext>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <Button variant="outline" className="h-9" onClick={() => setDialog({ date: today })}>
          + დავალება
        </Button>
        <span className="self-center">
          დაჭერა: რედაქტირება · გადათრევა: სხვა დღეზე · ჩამრთველი: შესრულებული
        </span>
      </div>

      {dialog && (
        <TaskDialog
          key={dialog.task?.id ?? `new-${dialog.date}`}
          state={dialog}
          employees={employees}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}