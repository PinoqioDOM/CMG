import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/nav";

export const instant = false;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
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
    <div className="min-h-screen md:flex">
      <Nav name={profile?.full_name ?? ""} role={profile?.role ?? ""} signOut={signOut} />
      <main className="flex-1 p-4 pb-24 md:p-8">{children}</main>
    </div>
  );
}