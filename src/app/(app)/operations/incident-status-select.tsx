"use client";

import { useTransition } from "react";
import { incidentStatusLabels } from "@/lib/labels";
import { updateIncidentStatus } from "./actions";

export function IncidentStatusSelect({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  return (
    <select
      defaultValue={status}
      disabled={pending}
      onChange={(e) => {
        const v = e.target.value;
        start(async () => {
          const r = await updateIncidentStatus(id, v);
          if (r?.error) alert(r.error);
        });
      }}
      className="h-9 rounded-md border bg-background px-2 text-sm"
    >
      {Object.entries(incidentStatusLabels).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}