"use client";

import { usePathname } from "next/navigation";
import { Nav } from "@/components/nav";

export function AppShell({
  name,
  role,
  signOut,
  children,
}: {
  name: string;
  role: string;
  signOut: () => Promise<void>;
  children: React.ReactNode;
}) {
  const wide = usePathname().startsWith("/operations/plan");

  return (
    <div
      className={`flex min-h-screen flex-col gap-2 bg-muted/40 p-2 md:gap-3 md:p-3 ${
        wide ? "" : "md:flex-row md:items-start"
      }`}
    >
      <Nav name={name} role={role} signOut={signOut} wide={wide} />
      <main
        className={`min-w-0 flex-1 rounded-2xl border bg-background p-4 pb-24 ${
          wide ? "md:p-5 md:pb-5" : "md:p-8"
        }`}
      >
        {children}
      </main>
    </div>
  );
}