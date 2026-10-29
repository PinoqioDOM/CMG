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
import { createClient } from "@/lib/supabase/client";
import { saveSupply } from "../services/actions";

export type Supply = {
  id: string;
  name: string;
  volume: string | null;
  unit_price: number | null;
  quantity_needed: number;
  comment: string | null;
  photo_url: string | null;
};

export function SupplyDialog({
  item,
  onClose,
}: {
  item: Supply | "new";
  onClose: () => void;
}) {
  const editing = item === "new" ? null : item;
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("photo") as File | null;
    fd.delete("photo");

    start(async () => {
      if (file && file.size > 0) {
        if (file.size > 10 * 1024 * 1024) {
          setError("ფოტო 10 მბ-ზე დიდია");
          return;
        }
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        const path = `supplies/${crypto.randomUUID()}.${ext || "jpg"}`;
        const { error: upErr } = await createClient()
          .storage.from("photos")
          .upload(path, file, { contentType: file.type });
        if (upErr) {
          setError("ფოტო ვერ აიტვირთა");
          return;
        }
        fd.set("photo_url", path);
      }

      const r = await saveSupply(editing?.id ?? null, fd);
      if (r?.error) setError(r.error);
      else onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "პროდუქტის რედაქტირება" : "ახალი პროდუქტი"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField label="დასახელება" name="name" defaultValue={editing?.name} required />
          <div className="grid grid-cols-2 gap-3">
            <FormField label="მოცულობა" name="volume" defaultValue={editing?.volume ?? ""} />
            <FormField
              label="ფასი (₾)"
              name="unit_price"
              type="number"
              step="0.01"
              min="0"
              defaultValue={editing?.unit_price ?? ""}
            />
          </div>
          <FormField
            label="შესაკვეთი რაოდენობა"
            name="quantity_needed"
            type="number"
            min="0"
            defaultValue={editing?.quantity_needed ?? 0}
          />
          <FormField label="კომენტარი" name="comment" defaultValue={editing?.comment ?? ""} />

          <div className="space-y-1.5">
            <label htmlFor="photo" className="text-sm font-medium">
              ფოტო
            </label>
            <input id="photo" name="photo" type="file" accept="image/*" className="w-full text-sm" />
            {editing?.photo_url && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" name="remove_photo" className="size-4" />
                არსებული ფოტოს წაშლა (ახლის არჩევისას ძველი თავისით იცვლება)
              </label>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="h-11 w-full" disabled={pending}>
            {pending ? "იტვირთება..." : "შენახვა"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}