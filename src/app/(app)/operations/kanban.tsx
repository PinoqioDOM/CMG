"use client";

import { useOptimistic, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { DeleteButton } from "@/components/delete-button";
import { deleteTask, updateTaskStatus } from "./actions";
import { categoryLabels, priorityLabels, taskStatusLabels } from "@/lib/labels";

export type Task = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: "todo" | "in_progress" | "done";
  priority: string;
  due_date: string | null;
  assignee: string | null;
};

type Status = Task["status"];
const columns: Status[] = ["todo", "in_progress", "done"];

export function Kanban({ tasks }: { tasks: Task[] }) {
  const [, startTransition] = useTransition();
  const [items, setOptimistic] = useOptimistic(
    tasks,
    (state, u: { id: string; status: Status }) =>
      state.map((t) => (t.id === u.id ? { ...t, status: u.status } : t))
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function move(id: string, status: Status) {
    startTransition(async () => {
      setOptimistic({ id, status });
      const res = await updateTaskStatus(id, status);
      if (res?.error) alert(res.error);
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const to = e.over?.id as Status | undefined;
    const task = items.find((t) => t.id === id);
    if (task && to && columns.includes(to) && task.status !== to) move(id, to);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid gap-4 md:grid-cols-3">
        {columns.map((col) => (
          <Column
            key={col}
            id={col}
            tasks={items.filter((t) => t.status === col)}
            onMove={move}
          />
        ))}
      </div>
    </DndContext>
  );
}

function Column({
  id,
  tasks,
  onMove,
}: {
  id: Status;
  tasks: Task[];
  onMove: (id: string, status: Status) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-40 space-y-3 rounded-lg border p-3 ${isOver ? "bg-muted" : "bg-muted/30"}`}
    >
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{taskStatusLabels[id]}</h2>
        <span className="text-sm text-muted-foreground">{tasks.length}</span>
      </div>
      {tasks.map((t) => (
        <TaskCard key={t.id} task={t} onMove={onMove} />
      ))}
    </div>
  );
}

function TaskCard({
  task,
  onMove,
}: {
  task: Task;
  onMove: (id: string, status: Status) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });
  const due = task.due_date ? task.due_date.split("-").reverse().join(".") : null;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        zIndex: isDragging ? 50 : undefined,
      }}
      className="space-y-2 rounded-md border bg-background p-3 shadow-sm"
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...listeners}
          {...attributes}
          aria-label="გადატანა"
          className="mt-0.5 cursor-grab touch-none text-muted-foreground"
        >
          <GripVertical className="size-5" />
        </button>
        <div className="flex-1 font-medium leading-snug">{task.title}</div>
        <DeleteButton
          action={() => deleteTask(task.id)}
          title="დავალების წაშლა"
          description={`„${task.title}" სამუდამოდ წაიშლება.`}
        />
      </div>

      {task.description && (
        <p className="line-clamp-3 text-sm text-muted-foreground">{task.description}</p>
      )}

      <div className="flex flex-wrap gap-1.5 text-xs">
        <span className="rounded bg-muted px-2 py-0.5">{categoryLabels[task.category]}</span>
        <span
          className={`rounded px-2 py-0.5 ${
            task.priority === "high" ? "bg-red-100 text-red-700" : "bg-muted"
          }`}
        >
          {priorityLabels[task.priority]}
        </span>
        {due && <span className="rounded bg-muted px-2 py-0.5">📅 {due}</span>}
        {task.assignee && <span className="rounded bg-muted px-2 py-0.5">👤 {task.assignee}</span>}
      </div>

      <select
        value={task.status}
        onChange={(e) => onMove(task.id, e.target.value as Status)}
        className="h-9 w-full rounded-md border bg-background px-2 text-sm"
      >
        {columns.map((s) => (
          <option key={s} value={s}>
            {taskStatusLabels[s]}
          </option>
        ))}
      </select>
    </div>
  );
}