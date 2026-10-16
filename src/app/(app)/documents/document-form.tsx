"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/form-field";
import { SelectField } from "@/components/native-fields";
import { createClient } from "@/lib/supabase/client";
import { saveDocument } from "./actions";

export type Doc = {
  id: string;
  title: string;
  folder_name: string;
  file_path: string | null;
  file_url: string | null;
  file_name: string | null;
  size_bytes: number | null;
  property_id: string | null;
  expires_at: string | null;
};

export function DocumentForm({
  doc,
  properties,
  folders,
  defaultFolder,
}: {
  doc?: Doc;
  properties: { id: string; number: string }[];
  folders: string[];
  defaultFolder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file") as File | null;
    fd.delete("file");

    start(async () => {
      if (file && file.size > 0) {
        if (file.size > 25 * 1024 * 1024) {
          setError("ფაილი 25 მბ-ზე დიდია");
          return;
        }
        const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `files/${crypto.randomUUID()}.${ext || "bin"}`;
        const { error: upErr } = await createClient()
          .storage.from("documents")
          .upload(path, file, { contentType: file.type || undefined });
        if (upErr) {
          setError("ფაილი ვერ აიტვირთა");
          return;
        }
        fd.set("file_path", path);
        fd.set("file_name", file.name);
        fd.set("size_bytes", String(file.size));
      }

      const r = await saveDocument(doc?.id ?? null, fd);
      if (r?.error) setError(r.error);
      else {
        setError("");
        setOpen(false);
      }
    });
  }

  return (
    <>
      <Button
        variant={doc ? "outline" : "default"}
        className={doc ? "h-9" : "h-11"}
        onClick={() => setOpen(true)}
      >
        {doc ? "შეცვლა" : "+ დოკუმენტი"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{doc ? "დოკუმენტის რედაქტირება" : "ახალი დოკუმენტი"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField label="სათაური" name="title" defaultValue={doc?.title} required />

            <FormField
              label="ფოლდერი"
              name="folder_name"
              list="doc-folders"
              defaultValue={doc?.folder_name ?? defaultFolder ?? "სხვადასხვა"}
              required
            />
            <datalist id="doc-folders">
              {folders.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>

            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="ბინა / სახლი"
                name="property_id"
                defaultValue={doc?.property_id ?? ""}
                options={[
                  { value: "", label: "—" },
                  ...properties.map((p) => ({ value: p.id, label: p.number })),
                ]}
              />
              <FormField
                label="ვადა (თუ აქვს)"
                name="expires_at"
                type="date"
                defaultValue={doc?.expires_at ?? ""}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="file" className="text-sm font-medium">
                ფაილი {doc?.file_path ? "(ახლის არჩევისას ძველი იცვლება)" : ""}
              </label>
              <input id="file" name="file" type="file" className="w-full text-sm" />
              {doc?.file_name && (
                <p className="text-xs text-muted-foreground">ახლა: {doc.file_name}</p>
              )}
            </div>

            <FormField
              label="ან Drive-ის ბმული"
              name="file_url"
              type="url"
              placeholder="https://drive.google.com/..."
              defaultValue={doc?.file_url ?? ""}
            />

            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="h-11 w-full" disabled={pending}>
              {pending ? "იტვირთება..." : "შენახვა"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}