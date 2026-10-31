"use client";

import {
  useCallback,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
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
import { Maximize2, Minimize2, Plus, Repeat, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/form-field";
import { SelectField } from "@/components/native-fields";
import { categoryLabels, monthNames, priorityLabels, taskStatusLabels } from "@/lib/labels";
import {
  createTask,
  deleteTask,
  setTaskDate,
  updateTask,
  updateTaskStatus,
} from "../actions";
import {
  addPlanItem,
  deletePlanItem,
  renamePlanItem,
  setPlanRecurring,
  togglePlanItem,
} from "./plan-actions";

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

export type PlanItem = {
  id: string;
  scope: "week" | "month" | "report";
  period_start: string;
  title: string;
  done: boolean;
  recurring: boolean;
};

type Update = { id: string; due_date?: string | null; status?: PlanTask["status"] };
type DialogState = { task?: PlanTask; date?: string } | null;

const weekdayNames = [
  "ორშაბათი",
  "სამშაბათი",
  "ოთხშაბათი",
  "ხუთშაბათი",
  "პარასკევი",
  "შაბათი",
  "კვირა",
];
const letters = ["M", "T", "W", "T", "F", "S", "S"];
const statusCls: Record<string, string> = {
  todo: "bg-muted",
  in_progress: "bg-amber-100 text-amber-900",
  done: "bg-green-100 text-green-800",
};
const toOptions = (m: Record<string, string>) =>
  Object.entries(m).map(([value, label]) => ({ value, label }));

// ---------- იზრდებადი ტექსტური ველი ----------
function AutoTextarea({
  minRows = 1,
  className = "",
  onInput,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [fit]);

  return (
    <textarea
      ref={ref}
      rows={minRows}
      onInput={(e) => {
        fit();
        onInput?.(e);
      }}
      className={`resize-none overflow-hidden ${className}`}
      {...props}
    />
  );
}

// ---------- პუნქტების სია (კვირის გეგმა, თვის გეგმა, დღის რეპორტი) ----------
type ListAction =
  | { type: "toggle"; id: string }
  | { type: "add"; item: PlanItem }
  | { type: "remove"; id: string }
  | { type: "recurring"; id: string };

function ItemList({
  scope,
  periodStart,
  items,
  title,
}: {
  scope: PlanItem["scope"];
  periodStart: string;
  items: PlanItem[];
  title?: string;
}) {
  const isReport = scope === "report";
  const isMonth = scope === "month";

  const [opt, mutate] = useOptimistic(items, (s, a: ListAction) => {
    if (a.type === "add") return [...s, a.item];
    if (a.type === "remove") return s.filter((i) => i.id !== a.id);
    if (a.type === "recurring")
      return s.map((i) => (i.id === a.id ? { ...i, recurring: !i.recurring } : i));
    return s.map((i) => (i.id === a.id ? { ...i, done: !i.done } : i));
  });
  const [, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const [repeatNew, setRepeatNew] = useState(false);
  const doneCount = opt.filter((i) => i.done).length;

  function toggle(i: PlanItem) {
    start(async () => {
      mutate({ type: "toggle", id: i.id });
      const r = await togglePlanItem(i.id, !i.done);
      if ("error" in r) alert(r.error);
    });
  }

  function toggleRecurring(i: PlanItem) {
    start(async () => {
      mutate({ type: "recurring", id: i.id });
      const r = await setPlanRecurring(i.id, !i.recurring);
      if ("error" in r) alert(r.error);
    });
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    const el = inputRef.current;
    if (!el) return;
    const v = el.value.trim();
    if (!v) return;
    el.value = "";
    const rec = isMonth && repeatNew;
    start(async () => {
      mutate({
        type: "add",
        item: {
          id: `tmp-${Date.now()}`,
          scope,
          period_start: periodStart,
          title: v,
          done: false,
          recurring: rec,
        },
      });
      const r = await addPlanItem(scope, periodStart, v, rec);
      if ("error" in r) {
        alert(r.error);
        el.value = v;
      }
    });
  }

  function rename(i: PlanItem, value: string) {
    const v = value.trim();
    if (!v || v === i.title) return;
    start(async () => {
      const r = await renamePlanItem(i.id, v);
      if ("error" in r) alert(r.error);
    });
  }

  function remove(i: PlanItem) {
    if (!isReport && !confirm(`„${i.title}" წაიშლება. გავაგრძელო?`)) return;
    start(async () => {
      mutate({ type: "remove", id: i.id });
      const r = await deletePlanItem(i.id);
      if ("error" in r) alert(r.error);
    });
  }

  return (
    <div className={isReport ? "" : "rounded-lg border p-2"}>
      {title && (
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground">
            {doneCount} / {opt.length}
          </div>
        </div>
      )}

      <div className="space-y-1">
        {opt.map((i) => {
          const temp = i.id.startsWith("tmp-");
          return (
            <div
              key={i.id}
              className={`group flex items-start gap-1.5 ${temp ? "opacity-60" : ""}`}
            >
              {isReport ? (
                <span className="mt-0.5 shrink-0 text-xs text-muted-foreground">•</span>
              ) : (
                <input
                  type="checkbox"
                  checked={i.done}
                  disabled={temp}
                  onChange={() => toggle(i)}
                  className="mt-1 size-4 shrink-0"
                  aria-label="შესრულებული"
                />
              )}
              <AutoTextarea
                key={`${i.id}-${i.title}`}
                defaultValue={i.title}
                disabled={temp}
                onBlur={(e) => rename(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
                className={`min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 leading-snug outline-none [overflow-wrap:anywhere] focus:bg-muted ${
                  isReport ? "text-xs" : "text-sm"
                } ${i.done ? "text-muted-foreground line-through" : ""}`}
              />
              {isMonth && (
                <button
                  type="button"
                  onClick={() => toggleRecurring(i)}
                  disabled={temp}
                  title={
                    i.recurring
                      ? "ყოველთვიური: ახალ თვეზე გადადის (დააჭირე გასართვავად)"
                      : "დააჭირე, რომ ყოველ თვე გადმოდიოდეს"
                  }
                  aria-label="ყოველთვიური"
                  className={`shrink-0 rounded p-0.5 hover:bg-muted ${
                    i.recurring
                      ? "text-green-700"
                      : "text-muted-foreground opacity-60 md:opacity-0 md:group-hover:opacity-100"
                  }`}
                >
                  <Repeat className="size-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => remove(i)}
                disabled={temp}
                aria-label="წაშლა"
                className="shrink-0 rounded p-0.5 text-muted-foreground opacity-60 hover:bg-muted md:opacity-0 md:group-hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <form onSubmit={add} className="mt-2">
        <div className="flex gap-1">
          <Input
            ref={inputRef}
            placeholder={isReport ? "+ რეპორტი" : "+ ახალი პუნქტი (Enter)"}
            className={isReport ? "h-8 text-xs" : "h-9 text-sm"}
          />
          {!isReport && (
            <Button type="submit" variant="outline" className="h-9 px-2" aria-label="დამატება">
              <Plus className="size-4" />
            </Button>
          )}
        </div>
        {isMonth && (
          <label className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={repeatNew}
              onChange={(e) => setRepeatNew(e.target.checked)}
              className="size-3.5"
            />
            <Repeat className="size-3" /> ყოველ თვე გადმოდის
          </label>
        )}
      </form>
    </div>
  );
}

// ---------- დავალების ბარათი ----------
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
      <span
        className={`min-w-0 [overflow-wrap:anywhere] ${
          t.status === "done" ? "line-through opacity-70" : ""
        }`}
      >
        {t.priority === "high" ? "❗" : ""}
        {t.title}
      </span>
    </div>
  );
}

// ---------- დღის სვეტი ----------
function DayColumn({
  date,
  name,
  inMonth,
  isToday,
  tasks,
  reportItems,
  onAdd,
  onOpen,
  onToggle,
}: {
  date: string;
  name: string;
  inMonth: boolean;
  isToday: boolean;
  tasks: PlanTask[];
  reportItems: PlanItem[];
  onAdd: (date: string) => void;
  onOpen: (t: PlanTask) => void;
  onToggle: (t: PlanTask) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${date}` });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-64 min-w-0 flex-col gap-3 rounded-lg border p-2 ${
        isOver ? "bg-muted" : inMonth ? "" : "bg-muted/30"
      }`}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">{name}</span>
        <span
          className={`text-xs ${
            isToday
              ? "rounded bg-foreground px-1.5 py-0.5 font-semibold text-background"
              : "text-muted-foreground"
          }`}
        >
          {Number(date.slice(8))}
        </span>
      </div>

      <div>
        <div className="mb-1 text-[11px] font-medium text-muted-foreground">რეპორტი</div>
        <ItemList key={`r-${date}`} scope="report" periodStart={date} items={reportItems} />
      </div>

      <div className="flex-1 space-y-1 border-t pt-2">
        <div className="text-[11px] font-medium text-muted-foreground">To-Do</div>
        {tasks.map((t) => (
          <Chip key={t.id} t={t} onOpen={onOpen} onToggle={onToggle} />
        ))}
        <button
          type="button"
          onClick={() => onAdd(date)}
          className="flex items-center gap-1 pt-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="size-3.5" /> დავალება
        </button>
      </div>
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
    <div ref={setNodeRef} className={`space-y-2 rounded-lg border p-3 ${isOver ? "bg-muted" : ""}`}>
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

// ---------- დავალების ფანჯარა ----------
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

// ---------- მთავარი ----------
export function PlanBoard({
  ym,
  weeks,
  tasks,
  employees,
  today,
  monthItems,
  weekItems,
  reportItems,
}: {
  ym: string;
  weeks: string[][];
  tasks: PlanTask[];
  employees: { id: string; full_name: string }[];
  today: string;
  monthItems: PlanItem[];
  weekItems: Record<string, PlanItem[]>;
  reportItems: Record<string, PlanItem[]>;
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
  const [focus, setFocus] = useState<string | null>(null);
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
  const overdue = inMonth.filter(
    (t) => t.status !== "done" && (t.due_date as string) < today
  ).length;

  const visible = focus ? weeks.filter((w) => w[0] === focus) : weeks;

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
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0 space-y-6">
            {visible.map((days) => {
              const isFocus = focus === days[0];
              return (
                <section
                  key={days[0]}
                  className={`grid gap-3 border-t pt-4 first:border-t-0 first:pt-0 ${
                    isFocus ? "" : "lg:grid-cols-[210px_minmax(0,1fr)]"
                  }`}
                >
                  {/* მარცხნივ: კვირის კალენდარი და კვირის გეგმა */}
                  <div className={isFocus ? "grid gap-3 md:grid-cols-[210px_minmax(0,1fr)]" : "space-y-3"}>
                    <div className="rounded-lg border p-2">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-semibold">
                          {monthNames[Number(days[3].slice(5, 7)) - 1]}
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          {Number(days[0].slice(8))}–{Number(days[6].slice(8))}
                          <button
                            type="button"
                            onClick={() => setFocus(isFocus ? null : days[0])}
                            title={isFocus ? "ყველა კვირა" : "ამ კვირის გაშლა"}
                            aria-label={isFocus ? "ყველა კვირა" : "ამ კვირის გაშლა"}
                            className="rounded p-0.5 hover:bg-muted"
                          >
                            {isFocus ? (
                              <Minimize2 className="size-3.5" />
                            ) : (
                              <Maximize2 className="size-3.5" />
                            )}
                          </button>
                        </span>
                      </div>
                      <div className="grid grid-cols-7 text-center text-[10px] text-muted-foreground">
                        {letters.map((l, i) => (
                          <div key={i}>{l}</div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 text-center text-xs">
                        {days.map((d) => (
                          <div
                            key={d}
                            className={`rounded py-0.5 ${
                              d === today
                                ? "bg-foreground font-semibold text-background"
                                : d.startsWith(ym)
                                  ? ""
                                  : "text-muted-foreground"
                            }`}
                          >
                            {Number(d.slice(8))}
                          </div>
                        ))}
                      </div>
                    </div>
                    <ItemList
                      key={`w-${days[0]}`}
                      scope="week"
                      periodStart={days[0]}
                      items={weekItems[days[0]] ?? []}
                      title="კვირის გეგმა"
                    />
                  </div>

                  {/* შუაში: 7 დღე */}
                  <div className="overflow-x-auto">
                    <div
                      className={`grid grid-cols-7 gap-2 ${
                        isFocus ? "min-w-[1100px]" : "min-w-[1260px]"
                      }`}
                    >
                      {days.map((d, i) => (
                        <DayColumn
                          key={d}
                          date={d}
                          name={weekdayNames[i]}
                          inMonth={d.startsWith(ym)}
                          isToday={d === today}
                          tasks={byDate.get(d) ?? []}
                          reportItems={reportItems[d] ?? []}
                          onAdd={(date) => setDialog({ date })}
                          onOpen={(task) => setDialog({ task })}
                          onToggle={toggle}
                        />
                      ))}
                    </div>
                  </div>
                </section>
              );
            })}

            <UndatedBox
              tasks={undated}
              onOpen={(task) => setDialog({ task })}
              onToggle={toggle}
            />
          </div>

          {/* მარჯვნივ: თვის გეგმა */}
          <aside className="order-first xl:sticky xl:top-3 xl:order-last xl:max-h-[calc(100vh-1.5rem)] xl:self-start xl:overflow-y-auto">
            <ItemList
              key={`m-${ym}`}
              scope="month"
              periodStart={`${ym}-01`}
              items={monthItems}
              title={`თვის გეგმა · ${monthNames[Number(ym.slice(5)) - 1]}`}
            />
          </aside>
        </div>
      </DndContext>

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