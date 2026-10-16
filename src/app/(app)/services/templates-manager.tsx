"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeleteButton } from "@/components/delete-button";
import { frequencyLabels } from "@/lib/labels";
import { addTemplate, deleteTemplate, renameTemplate } from "./actions";

export type Template = { id: string; title: string; frequency: string };

export function TemplatesManager({
  role,
  templates,
}: {
  role: string;
  templates: Template[];
}) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

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

  return (
    <div className="space-y-6">
      <form onSubmit={onAdd} className="flex flex-wrap gap-2 rounded-lg border p-3">
        <Input name="title" placeholder="ახალი პუნქტი" className="h-11 min-w-48 flex-1" required />
        <select
          name="frequency"
          defaultValue="daily"
          className="h-11 rounded-md border bg-background px-2 text-sm"
        >
          <option value="daily">{frequencyLabels.daily}</option>
          <option value="monthly">{frequencyLabels.monthly}</option>
        </select>
        <Button type="submit" className="h-11" disabled={pending}>
          + დამატება
        </Button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </form>

      {(["daily", "monthly"] as const).map((freq) => {
        const list = templates.filter((t) => t.frequency === freq);
        return (
          <section key={freq}>
            <h2 className="mb-2 font-semibold">
              {frequencyLabels[freq]} ({list.length})
            </h2>
            <div className="space-y-2">
              {list.length === 0 && (
                <p className="text-sm text-muted-foreground">პუნქტები არ არის</p>
              )}
              {list.map((t) => (
                <div key={`${t.id}-${t.title}`} className="flex items-center gap-2">
                  <Input
                    defaultValue={t.title}
                    onBlur={(e) => onRename(t, e.target.value)}
                    className="h-11"
                  />
                  <DeleteButton
                    action={() => deleteTemplate(t.id)}
                    title="პუნქტის წაშლა"
                    description={`„${t.title}" წაიშლება, მისი მონიშვნების ისტორიასთან ერთად.`}
                  />
                </div>
              ))}
            </div>
          </section>
        );
      })}
      <p className="text-xs text-muted-foreground">
        სახელის შესაცვლელად ჩაასწორე ტექსტი და გადადი სხვა ადგილას, თავისით შეინახება.
      </p>
    </div>
  );
}