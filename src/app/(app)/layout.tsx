import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";

async function Shell({ children }: { children: React.ReactNode }) {
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  async function signOut() {
    "use server";
    const s = await createClient();
    await s.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col gap-2 bg-muted/40 p-2 md:flex-row md:items-start md:gap-3 md:p-3">
      <Nav name={profile?.full_name ?? ""} role={profile?.role ?? ""} signOut={signOut} />
      <main className="min-w-0 flex-1 rounded-2xl border bg-background p-4 pb-24 md:p-8">
        {children}
      </main>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">იტვირთება...</div>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}