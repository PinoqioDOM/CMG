"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  FolderOpen,
  LayoutDashboard,
  Sparkles,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { roleLabels } from "@/lib/labels";

const items = [
  { href: "/", match: "/", exact: true, label: "მთავარი", icon: LayoutDashboard },
  { href: "/operations/plan", match: "/operations/plan", label: "კვირის გეგმა", icon: CalendarDays },
  { href: "/operations", match: "/operations", exact: true, label: "ტექნიკური საკითხები", icon: Wrench },
  { href: "/finance", match: "/finance", label: "გადახდები", icon: Wallet },
  { href: "/staff", match: "/staff", label: "დასწრება", icon: Users },
  { href: "/services", match: "/services", label: "დასუფთავება", icon: Sparkles },
  { href: "/documents", match: "/documents", label: "დოკუმენტები", icon: FolderOpen },
];

export function Nav({
  name,
  role,
  signOut,
  wide = false,
}: {
  name: string;
  role: string;
  signOut: () => Promise<void>;
  wide?: boolean;
}) {
  const pathname = usePathname();
  const isActive = (i: (typeof items)[number]) =>
    i.exact ? pathname === i.match : pathname.startsWith(i.match);
  const roleLabel = roleLabels[role] ?? role;

  return (
    <>
      {/* კომპიუტერი: ზედა ზოლი (ფართო გვერდებისთვის) */}
      {wide && (
        <aside className="hidden items-center gap-1 overflow-x-auto rounded-2xl border bg-background px-3 py-2 md:flex">
          <div className="mr-3 shrink-0 leading-tight">
            <div className="font-bold">CMG</div>
            <div className="text-[11px] text-muted-foreground">
              {name} · {roleLabel}
            </div>
          </div>
          {items.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm ${
                isActive(i) ? "bg-muted font-medium" : "hover:bg-muted/60"
              }`}
            >
              <i.icon className="size-4" />
              {i.label}
            </Link>
          ))}
          <form action={signOut} className="ml-auto shrink-0 pl-2">
            <Button type="submit" variant="outline" size="sm">
              გასვლა
            </Button>
          </form>
        </aside>
      )}

      {/* კომპიუტერი: მარცხენა მენიუ */}
      {!wide && (
        <aside className="hidden w-60 shrink-0 flex-col gap-1 rounded-2xl border bg-background p-4 md:sticky md:top-3 md:flex md:h-[calc(100vh-1.5rem)]">
          <div className="mb-4">
            <div className="text-lg font-bold">CMG</div>
            <div className="text-sm font-medium">{name}</div>
            <div className="text-xs text-muted-foreground">{roleLabel}</div>
          </div>
          {items.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${
                isActive(i) ? "bg-muted font-medium" : "hover:bg-muted/60"
              }`}
            >
              <i.icon className="size-4" />
              {i.label}
            </Link>
          ))}
          <form action={signOut} className="mt-auto">
            <Button type="submit" variant="outline" className="w-full">
              გასვლა
            </Button>
          </form>
        </aside>
      )}

      {/* ტელეფონი: ზედა ბარათი */}
      <header className="flex items-center justify-between rounded-2xl border bg-background p-3 md:hidden">
        <div className="text-sm">
          <b>CMG</b> · {name}
          <span className="text-muted-foreground"> · {roleLabel}</span>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm">
            გასვლა
          </Button>
        </form>
      </header>

      {/* ტელეფონი: ქვედა პანელი (გადაიხვევა გვერდზე) */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex overflow-x-auto border-t bg-background md:hidden">
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={`flex min-w-[84px] shrink-0 flex-1 flex-col items-center gap-1 px-1 py-2 text-center text-[10px] leading-tight ${
              isActive(i) ? "font-medium text-foreground" : "text-muted-foreground"
            }`}
          >
            <i.icon className="size-5" />
            {i.label}
          </Link>
        ))}
      </nav>
    </>
  );
}