"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeleteButton } from "@/components/delete-button";
import { frequencyLabels } from "@/lib/labels";
import {
  addTemplate,
  deleteService,
  deleteTemplate,
  renameTemplate,
  setTemplateFrequency,
} from "./actions";

export type Template = { id: string; title: string; frequency: string };

const freqs = ["daily", "weekly", "monthly"] as const;
const sel = "h-11 rounded-md border bg-background px-2 text-sm";

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

      <div className="grid gap-4 lg:grid-cols-3">
        {freqs.map((freq) => {
          const list = templates.filter((t) => t.frequency === freq);
          return (
            <section key={freq} className="space-y-2 rounded-xl border p-3">
              <h2 className="font-semibold">
                {frequencyLabels[freq]} ({list.length})
              </h2>
              {list.length === 0 && (
                <p className="text-sm text-muted-foreground">პუნქტები არ არის</p>
              )}
              {list.map((t) => (
                <div key={`${t.id}-${t.title}-${t.frequency}`} className="space-y-1.5 rounded-lg border p-2">
                  <Input
                    defaultValue={t.title}
                    onBlur={(e) => onRename(t, e.target.value)}
                    className="h-11"
                  />
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
              ))}
            </section>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        სახელის შესაცვლელად ჩაასწორე ტექსტი და გადადი სხვა ადგილას, თავისით შეინახება. პუნქტს
        სიხშირე ჩამოსაშლელი სიით ეცვლება და გრაფას შორის გადადის.
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