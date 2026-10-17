"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { reopenPlan } from "./actions";

export function ReopenButton({ id, redirectTo }: { id: string; redirectTo?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      className="h-9"
      disabled={pending}
      onClick={() => {
        if (!confirm("გეგმა გაიხსნება და მონიშვნები ისევ შესაცვლელი გახდება. გავხსნა?")) return;
        start(async () => {
          const r = await reopenPlan(id);
          if (r?.error) alert(r.error);
          else if (redirectTo) router.push(redirectTo);
        });
      }}
    >
      გახსნა
    </Button>
  );
}