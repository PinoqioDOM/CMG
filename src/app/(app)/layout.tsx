import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { Loader } from "@/components/loader";

async function Shell({ children }: { children: React.ReactNode }) {
  await connection();

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const claims = auth?.claims;
  if (!claims) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", claims.sub)
    .single();

  async function signOut() {
    "use server";
    const s = await createClient();
    await s.auth.signOut();
    redirect("/login");
  }

  return (
    <AppShell name={profile?.full_name ?? ""} role={profile?.role ?? ""} signOut={signOut}>
      {children}
    </AppShell>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Loader fullscreen />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}