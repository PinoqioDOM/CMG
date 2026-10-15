"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { continueMonth } from "./attendance-actions";

export function ContinueButton({ year, month }: { year: number; month: number }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      className="h-11"
      disabled={pending}
      onClick={() => {
        if (!confirm("ცარიელ უჯრებს წინა გრაფიკის მიხედვით შევავსებ. არსებულს არ შევცვლი. გავაგრძელო?")) return;
        start(async () => {
          const r = await continueMonth(year, month);
          if ("error" in r) alert(r.error);
          else
            alert(
              r.count
                ? `შეივსო ${r.count} უჯრა`
                : "ახალი უჯრა ვერ დაემატა (წინა 3 კვირაში მონაცემი არ არის)"
            );
        });
      }}
    >
      {pending ? "..." : "გრაფიკის გაგრძელება"}
    </Button>
  );
}