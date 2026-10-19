"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("ელფოსტა ან პაროლი არასწორია");
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="grid min-h-dvh bg-[#efeeea] lg:h-dvh lg:grid-cols-[minmax(0,1fr)_420px]">
      <section className="relative aspect-[1356/818] w-full lg:aspect-auto lg:h-dvh">
        <Image
          src="/new-cmg.jpg"
          alt="Simetria Park"
          fill
          priority
          sizes="(min-width: 1024px) calc(100vw - 420px), 100vw"
          className="object-cover object-right"
        />
      </section>

      {/* მარჯვენა: შესვლა */}
      <section className="flex items-center justify-center overflow-y-auto bg-background p-6 md:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold">მოგესალმებით</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              შედით CMG-ში თქვენი ანგარიშით
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">ელფოსტა</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">პაროლი</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-11"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? "პაროლის დამალვა" : "პაროლის ჩვენება"}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <Button type="submit" className="h-11 w-full" disabled={loading}>
              {loading ? "შესვლა..." : "შესვლა"}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">CMG · Simetria Park</p>
        </div>
      </section>
    </main>
  );
}