import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export const instant = false;

export default async function Home() {
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
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">CMG</h1>
      <p>
        {profile?.full_name} · როლი: <b>{profile?.role}</b>
      </p>
      <form action={signOut}>
        <Button type="submit" variant="outline">
          გასვლა
        </Button>
      </form>
    </main>
  );
}