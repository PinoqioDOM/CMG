"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import { Download, Package, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { deleteSupply, setSupplyQty } from "./action";
import { SupplyDialog, type Supply } from "./supply-dialog";

const money = (n: number) => `${(Math.round(n * 100) / 100).toFixed(2)} ₾`;

export function SuppliesGrid({
  items,
  photoUrls,
}: {
  items: Supply[];
  photoUrls: Record<string, string>;
}) {
  const [q, setQ] = useState("");
  const [onlyOrder, setOnlyOrder] = useState(false);
  const [dialog, setDialog] = useState<Supply | "new" | null>(null);
  const [toDelete, setToDelete] = useState<Supply | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [, start] = useTransition();

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setLightbox(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const [opt, apply] = useOptimistic(items, (s, u: { id: string; qty: number }) =>
    s.map((i) => (i.id === u.id ? { ...i, quantity_needed: u.qty } : i))
  );

  const order = opt.filter((i) => i.quantity_needed > 0);

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

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
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
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          შესაკვეთი: <b className="text-foreground">{order.length}</b>
        </span>
        <a
          href="/supplies/export"
          className={`inline-flex h-11 items-center gap-2 rounded-md border px-3 text-sm ${
            order.length === 0 ? "pointer-events-none opacity-50" : ""
          }`}
        >
          <Download className="size-4" />
          Excel ჩამოტვირთვა
        </a>
        <Button className="h-11" onClick={() => setDialog("new")}>
          <Plus className="mr-1 size-4" />
          პროდუქტი
        </Button>
      </div>

      {shown.length === 0 && <p className="text-muted-foreground">ვერაფერი მოიძებნა</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {shown.map((i) => {
          const url = i.photo_url ? photoUrls[i.photo_url] : null;
          return (
            <div
              key={i.id}
              className={`flex flex-col overflow-hidden rounded-xl border bg-background ${
                i.quantity_needed > 0 ? "ring-2 ring-green-500/60" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => url && setLightbox(url)}
                className="relative aspect-square w-full bg-white"
                aria-label={url ? "ფოტოს გადიდება" : i.name}
              >
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={i.name}
                    loading="lazy"
                    decoding="async"
                    className="size-full object-contain p-2"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground/40">
                    <Package className="size-12" />
                  </div>
                )}
              </button>

              <div className="flex flex-1 flex-col gap-1 p-3">
                <div className="line-clamp-2 text-sm font-medium leading-snug">{i.name}</div>
                <div className="text-xs text-muted-foreground">
                  {[i.volume, i.unit_price != null ? money(i.unit_price) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                {i.comment && (
                  <div className="line-clamp-2 text-xs text-muted-foreground">{i.comment}</div>
                )}

                <div className="mt-auto flex items-center justify-between pt-2">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      className="size-9 p-0"
                      onClick={() => setQty(i, i.quantity_needed - 1)}
                      aria-label="შემცირება"
                    >
                      −
                    </Button>
                    <div className="w-8 text-center font-semibold">{i.quantity_needed}</div>
                    <Button
                      variant="outline"
                      className="size-9 p-0"
                      onClick={() => setQty(i, i.quantity_needed + 1)}
                      aria-label="გაზრდა"
                    >
                      +
                    </Button>
                  </div>
                  <div className="flex">
                    <Button
                      variant="ghost"
                      className="size-8 p-0 text-muted-foreground"
                      onClick={() => setDialog(i)}
                      aria-label="შეცვლა"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      className="size-8 p-0 text-muted-foreground"
                      onClick={() => setToDelete(i)}
                      aria-label="წაშლა"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {dialog && (
        <SupplyDialog
          key={dialog === "new" ? "new" : dialog.id}
          item={dialog}
          onClose={() => setDialog(null)}
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="პროდუქტის წაშლა"
        description={toDelete ? `„${toDelete.name}" წაიშლება სიიდან.` : undefined}
        confirmLabel="წაშლა"
        onConfirm={() => {
          const t = toDelete;
          if (!t) return;
          start(async () => {
            const r = await deleteSupply(t.id);
            if (r?.error) alert(r.error);
          });
        }}
      />

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="დახურვა"
            className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-full bg-white text-black shadow-lg hover:bg-white/90"
          >
            <X className="size-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[92vw] rounded-lg bg-white object-contain"
          />
        </div>
      )}
    </>
  );
}