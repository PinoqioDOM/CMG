"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";

export function DeleteButton({
  action,
  title,
  description,
}: {
  action: () => Promise<{ error?: string } | { ok: boolean } | undefined>;
  title: string;
  description?: string;
}) {
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        aria-label="წაშლა"
        className="size-8 shrink-0 p-0 text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        confirmLabel="წაშლა"
        onConfirm={() =>
          start(async () => {
            const r = await action();
            if (r && "error" in r && r.error) alert(r.error);
          })
        }
      />
    </>
  );
}