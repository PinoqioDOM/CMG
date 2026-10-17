"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ListTodo, Wallet, Users, Sparkles, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { roleLabels } from "@/lib/labels";

const items = [
  { href: "/", label: "მთავარი", icon: LayoutDashboard },
  { href: "/operations", label: "ოპერაციები", icon: ListTodo },
  { href: "/finance", label: "ფინანსები", icon: Wallet },
  { href: "/staff", label: "პერსონალი", icon: Users },
  { href: "/services", label: "სერვისები", icon: Sparkles },
  { href: "/documents", label: "დოკუმენტები", icon: FolderOpen },
];

export function Nav({
  name,
  role,
  signOut,
}: {
  name: string;
  role: string;
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const roleLabel = roleLabels[role] ?? role;

  return (
    <>
      {/* კომპიუტერი */}
      <aside className="hidden w-60 shrink-0 flex-col gap-1 rounded-2xl border bg-background p-4 md:sticky md:top-3 md:flex md:h-[calc(100vh-1.5rem)]">
        <div className="mb-4">
          <div className="text-lg font-bold">CMG</div>
          <div className="text-sm font-medium">{name}</div>
          <div className="text-xs text-muted-foreground">{roleLabel}</div>
        </div>
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${
              isActive(href) ? "bg-muted font-medium" : "hover:bg-muted/60"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
        <form action={signOut} className="mt-auto">
          <Button type="submit" variant="outline" className="w-full">
            გასვლა
          </Button>
        </form>
      </aside>

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

      {/* ტელეფონი: ქვედა პანელი */}
      <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-6 border-t bg-background md:hidden">
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-1 py-2 text-[10px] ${
              isActive(href) ? "font-medium text-foreground" : "text-muted-foreground"
            }`}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}