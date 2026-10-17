import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { positionLabels } from "@/lib/labels";
import { dm, dmy, periodTitle } from "@/lib/plan";
import { ReopenButton } from "../../reopen-button";

type Item = { title: string; frequency: string; dates: string[] };

const sections: { key: string; label: string }[] = [
  { key: "daily", label: "დღიური" },
  { key: "weekly", label: "კვირეული" },
  { key: "monthly", label: "თვიური" },
];

async function Content({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from("checklist_closures")
    .select("id, position, period_type, period_start, period_end, snapshot, closed_at")
    .eq("id", id)
    .single();
  if (!data) notFound();

  const items = ((data.snapshot as { items?: Item[] })?.items ?? []) as Item[];
  const t = periodTitle(data.period_type, data.period_start, data.period_end);
  const [sy, sm, sd] = data.period_start.split("-").map(Number);
  const [ey, em, ed] = data.period_end.split("-").map(Number);
  const periodDays =
    Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86400000) + 1;

  const back = `/services?tab=archive&role=${encodeURIComponent(data.position)}`;

  return (
    <>
      <Link href={back} className="mb-3 inline-block text-sm text-muted-foreground underline">
        ← არქივი
      </Link>
      <PageHeader
        title={`${t.title} · ${t.sub}`}
        description={`${positionLabels[data.position] ?? data.position} · ${dm(
          data.period_start
        )}–${dmy(data.period_end)} · დახურულია ${new Date(data.closed_at).toLocaleDateString(
          "en-GB",
          { timeZone: "Asia/Tbilisi" }
        )}`}
        action={<ReopenButton id={data.id} redirectTo={back} />}
      />

      <div className="space-y-6">
        {sections.map((s) => {
          const list = items.filter((i) => i.frequency === s.key);
          if (list.length === 0) return null;
          const done = list.filter((i) => i.dates.length > 0).length;
          return (
            <section key={s.key}>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-semibold">{s.label}</h2>
                <span className="text-sm text-muted-foreground">
                  შესრულებული: {done} / {list.length}
                </span>
              </div>
              <div className="space-y-2">
                {list.map((i) => (
                  <div key={i.title} className="rounded-lg border p-3">
                    <div className="flex items-start gap-2">
                      <span className={i.dates.length > 0 ? "text-green-600" : "text-red-500"}>
                        {i.dates.length > 0 ? "✓" : "✗"}
                      </span>
                      <div className="flex-1">
                        <div className="font-medium leading-snug">{i.title}</div>
                        {s.key === "daily" && (
                          <div className="text-xs text-muted-foreground">
                            {i.dates.length} / {periodDays} დღე
                          </div>
                        )}
                        {i.dates.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {i.dates.map((d) => (
                              <span key={d} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                                {dm(d)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

export default function ArchivePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">იტვირთება...</div>}>
      <Content params={params} />
    </Suspense>
  );
}