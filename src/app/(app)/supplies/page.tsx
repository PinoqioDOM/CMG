import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { SuppliesGrid } from "./supplies-grid";
import type { Supply } from "./supply-dialog";

async function Content() {
  await connection();
  const supabase = await createClient();

  const { data } = await supabase
    .from("supply_items")
    .select("id, name, volume, unit_price, quantity_needed, comment, photo_url")
    .order("name");
  const items = (data ?? []) as Supply[];

  const photoUrls: Record<string, string> = {};
  const paths = items.map((i) => i.photo_url).filter((p): p is string => !!p);
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("photos").createSignedUrls(paths, 3600);
    signed?.forEach((s) => {
      if (s.path && s.signedUrl) photoUrls[s.path] = s.signedUrl;
    });
  }

  return (
    <>
      <PageHeader title="მომარაგება" />
      <SuppliesGrid items={items} photoUrls={photoUrls} />
    </>
  );
}

export default function SuppliesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">იტვირთება...</div>}>
      <Content />
    </Suspense>
  );
}