"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { closePlan } from "./actions";
import { ReopenButton } from "./reopen-button";

function Block({
  label,
  closedId,
  onClose,
  pending,
}: {
  label: string;
  closedId: string | null;
  onClose: () => void;
  pending: boolean;
}) {
  if (closedId) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-green-50 p-3 text-sm text-green-800">
        <span className="font-medium">✓ {label}: დახურულია</span>
        <Link
          href={`/services/archive/${closedId}`}
          className="ml-auto inline-flex h-9 items-center rounded-md border bg-background px-3 text-foreground"
        >
          ნახვა
        </Link>
        <ReopenButton id={closedId} />
      </div>
    );
  }
  return (
    <Button variant="outline" className="h-12 justify-start" disabled={pending} onClick={onClose}>
      {label}: დახურვა
    </Button>
  );
}

export function ClosePlanButtons({
  role,
  date,
  weekText,
  monthText,
  weekClosedId,
  monthClosedId,
}: {
  role: string;
  date: string;
  weekText: string;
  monthText: string;
  weekClosedId: string | null;
  monthClosedId: string | null;
}) {
  const [pending, start] = useTransition();

  function close(type: "week" | "month", text: string) {
    const msg =
      type === "week"
        ? `დავხურო კვირის გეგმა (${text})? დახურვის შემდეგ ამ კვირის მონიშვნები დაიბლოკება.`
        : `დავხურო თვის გეგმა (${text})? დახურვის შემდეგ ეს თვე დაიბლოკება და არქივში გამოჩნდება.`;
    if (!confirm(msg)) return;
    start(async () => {
      const r = await closePlan(role, type, date);
      if (r?.error) alert(r.error);
    });
  }

  return (
    <div className="mb-4 grid gap-2 md:grid-cols-2">
      <Block
        label={`კვირის გეგმა (${weekText})`}
        closedId={weekClosedId}
        pending={pending}
        onClose={() => close("week", weekText)}
      />
      <Block
        label={`თვის გეგმა (${monthText})`}
        closedId={monthClosedId}
        pending={pending}
        onClose={() => close("month", monthText)}
      />
    </div>
  );
}