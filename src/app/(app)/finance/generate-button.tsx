"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { generateMonth } from "./actions";

export function GenerateButton({ year, month }: { year: number; month: number }) {
  const [pending, start] = useTransition();
  return (
    <Button
      className="h-11"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await generateMonth(year, month);
          if (r?.error) alert(r.error);
        })
      }
    >
      {pending ? "..." : "თვის გადახდების შექმნა"}
    </Button>
  );
}