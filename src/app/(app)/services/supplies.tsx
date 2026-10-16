"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeleteButton } from "@/components/delete-button";
import { deleteSupply, setSupplyQty } from "./actions";
import { SupplyForm, type Supply } from "./supply-form";

const money = (n: number) => `${(Math.round(n * 100) / 100).toFixed(2)} ₾`;

export function Supplies({
  items,
  photoUrls,
}: {
  items: Supply[];
  photoUrls: Record<string, string>;
}) {
  const [q, setQ] = useState("");
  const [onlyOrder, setOnlyOrder] = useState(false);
  const [, start] = useTransition();
  const [opt, apply] = useOptimistic(items, (s, u: { id: string; qty: number }) =>
    s.map((i) => (i.id === u.id ? { ...i, quantity_needed: u.qty } : i))
  );

  const order = opt.filter((i) => i.quantity_needed > 0);
  const total = order.reduce((s, i) => s + (i.unit_price ?? 0) * i.quantity_needed, 0);

  const t = q.trim().toLowerCase();
    const shown = opt.filter((i) => {
    if (onlyOrder && i.quantity_needed === 0) return false;
    if (!t) return true;
    return [i.name, i.volume, i.comment].some((x) => x?.toLowerCase().includes(t));
  });

  function setQty(i: Supply, qty: number) {
    const n = Math.max(0, Math.min(9999, qty));
    start(async () => {
      apply({ id: i.id, qty: n });
      const r = await setSupplyQty(i.id, n);
      if (r?.error) alert(r.error);
    });
  }

  async function copyOrder() {
    const text = order
      .map((i) => `${i.name}${i.volume ? ` (${i.volume})` : ""} × ${i.quantity_needed}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      alert("შეკვეთის სია დაკოპირდა");
    } catch {
      alert("ვერ დაკოპირდა");
    }
  }

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">შესაკვეთი პოზიცია</div>
          <div className="text-lg font-semibold">{order.length}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">სავარაუდო ჯამი</div>
          <div className="text-lg font-semibold">{money(total)}</div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ძიება..."
          className="h-11 min-w-48 flex-1"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={onlyOrder}
            onChange={(e) => setOnlyOrder(e.target.checked)}
          />
          მხოლოდ შესაკვეთი
        </label>
        <Button
          variant="outline"
          className="h-11"
          disabled={order.length === 0}
          onClick={copyOrder}
        >
          შეკვეთის კოპირება
        </Button>
      </div>

      <div className="space-y-2">
        {shown.length === 0 && <p className="text-muted-foreground">ვერაფერი მოიძებნა</p>}
        {shown.map((i) => (
          <div key={i.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
            {i.photo_url && photoUrls[i.photo_url] && (
              <a href={photoUrls[i.photo_url]} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrls[i.photo_url]}
                  alt={i.name}
                  className="size-14 rounded object-cover"
                />
              </a>
            )}
            <div className="min-w-48 flex-1">
              <div className="font-medium leading-snug">{i.name}</div>
              <div className="text-sm text-muted-foreground">
                {[i.volume, i.unit_price != null ? money(i.unit_price) : null]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
              {i.comment && <div className="text-xs text-muted-foreground">{i.comment}</div>}
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                className="size-9 p-0"
                onClick={() => setQty(i, i.quantity_needed - 1)}
                aria-label="შემცირება"
              >
                −
              </Button>
              <div className="w-10 text-center font-semibold">{i.quantity_needed}</div>
              <Button
                variant="outline"
                className="size-9 p-0"
                onClick={() => setQty(i, i.quantity_needed + 1)}
                aria-label="გაზრდა"
              >
                +
              </Button>
            </div>

            <SupplyForm item={i} />
            <DeleteButton
              action={() => deleteSupply(i.id)}
              title="პროდუქტის წაშლა"
              description={`„${i.name}" წაიშლება სიიდან.`}
            />
          </div>
        ))}
      </div>
    </>
  );
}