import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/delete-button";
import { DocumentForm, type Doc } from "./document-form";
import { deleteDocument } from "./actions";

type SearchParams = Promise<{ folder?: string; q?: string; exp?: string }>;
type Row = Doc & { created_at: string };

const defaultFolders = ["უსაფრთხოება", "ხელშეკრულებები", "სხვადასხვა"];

const tabCls = (active: boolean) =>
  `rounded-md px-3 py-2 text-sm ${active ? "bg-muted font-medium" : "text-muted-foreground"}`;
const dmy = (s: string) => s.split("-").reverse().join(".");
const num = (s: string) => parseInt(s.replace(/\D/g, ""), 10) || 0;

function size(n: number | null) {
  if (!n) return "";
  return n >= 1048576 ? `${(n / 1048576).toFixed(1)} მბ` : `${Math.max(1, Math.round(n / 1024))} კბ`;
}

function icon(d: Row) {
  if (!d.file_path) return "🔗";
  const ext = (d.file_name ?? d.file_path).split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "webp", "gif", "heic"].includes(ext)) return "🖼️";
  if (["xls", "xlsx", "csv"].includes(ext)) return "📊";
  return "📄";
}

async function Content({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const sp = await searchParams;
  const folder = sp.folder ?? "";
  const q = (sp.q ?? "").trim().toLowerCase();
  const exp = sp.exp === "1";

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tbilisi" });
  const daysLeft = (d: string) => {
    const [y1, m1, d1] = d.split("-").map(Number);
    const [y2, m2, d2] = today.split("-").map(Number);
    return Math.round((Date.UTC(y1, m1 - 1, d1) - Date.UTC(y2, m2 - 1, d2)) / 86400000);
  };

  const supabase = await createClient();
  const [{ data: docData }, { data: propData }] = await Promise.all([
    supabase
      .from("documents")
      .select(
        "id, title, folder_name, file_path, file_url, file_name, size_bytes, property_id, expires_at, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("properties").select("id, number, type"),
  ]);

  const docs = (docData ?? []) as Row[];
  const props = [...(propData ?? [])].sort((a, b) =>
    a.type === b.type ? num(a.number) - num(b.number) : a.type === "apartment" ? -1 : 1
  );
  const propMap = new Map(props.map((p) => [p.id, p.number]));

  const folders = Array.from(new Set([...defaultFolders, ...docs.map((d) => d.folder_name)]));
  const counts = new Map<string, number>();
  docs.forEach((d) => counts.set(d.folder_name, (counts.get(d.folder_name) ?? 0) + 1));

  const expired = docs.filter((d) => d.expires_at && daysLeft(d.expires_at) < 0).length;
  const soon = docs.filter(
    (d) => d.expires_at && daysLeft(d.expires_at) >= 0 && daysLeft(d.expires_at) <= 30
  ).length;

  const shown = docs
    .filter((d) => (folder ? d.folder_name === folder : true))
    .filter((d) => (exp ? d.expires_at && daysLeft(d.expires_at) <= 30 : true))
    .filter((d) => {
      if (!q) return true;
      return [d.title, d.folder_name, d.file_name, d.property_id ? propMap.get(d.property_id) : ""]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(q));
    })
    .sort((a, b) => {
      if (exp) return (a.expires_at ?? "").localeCompare(b.expires_at ?? "");
      return 0;
    });

  const paths = shown.map((d) => d.file_path).filter((p): p is string => !!p);
  const signedMap: Record<string, string> = {};
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("documents").createSignedUrls(paths, 3600);
    signed?.forEach((s) => {
      if (s.path && s.signedUrl) signedMap[s.path] = s.signedUrl;
    });
  }

  const link = (o: Record<string, string>) => {
    const p = new URLSearchParams();
    const base: Record<string, string> = { folder, q: sp.q ?? "", exp: exp ? "1" : "", ...o };
    Object.entries(base).forEach(([k, v]) => v && p.set(k, v));
    const s = p.toString();
    return s ? `/documents?${s}` : "/documents";
  };

  return (
    <>
      <PageHeader
        title="დოკუმენტები"
        action={
          <DocumentForm
            properties={props.map((p) => ({ id: p.id, number: p.number }))}
            folders={folders}
            defaultFolder={folder || undefined}
          />
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">სულ</div>
          <div className="text-lg font-semibold">{docs.length}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">ვადაგასული</div>
          <div className={`text-lg font-semibold ${expired ? "text-red-600" : ""}`}>{expired}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">30 დღეში გასული</div>
          <div className={`text-lg font-semibold ${soon ? "text-amber-600" : ""}`}>{soon}</div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        <Link href={link({ folder: "" })} className={tabCls(!folder)}>
          ყველა ({docs.length})
        </Link>
        {folders.map((f) => (
          <Link key={f} href={link({ folder: f })} className={tabCls(folder === f)}>
            {f} ({counts.get(f) ?? 0})
          </Link>
        ))}
      </div>

      <form action="/documents" method="get" className="mb-4 flex flex-wrap items-center gap-2">
        {folder && <input type="hidden" name="folder" value={folder} />}
        {exp && <input type="hidden" name="exp" value="1" />}
        <Input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="ძიება: სათაური, ბინა, ფაილი..."
          className="h-11 min-w-48 flex-1"
        />
        <Button type="submit" className="h-11">
          ძიება
        </Button>
        <Link href={link({ exp: exp ? "" : "1" })} className={`${tabCls(exp)} border`}>
          ვადიანი (≤ 30 დღე)
        </Link>
      </form>

      <div className="space-y-2">
        {shown.length === 0 && <p className="text-muted-foreground">დოკუმენტები არ არის</p>}
        {shown.map((d) => {
          const href = d.file_path ? signedMap[d.file_path] : d.file_url;
          const left = d.expires_at ? daysLeft(d.expires_at) : null;
          return (
            <div key={d.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <div className="text-2xl">{icon(d)}</div>
              <div className="min-w-48 flex-1">
                <div className="font-medium leading-snug">{d.title}</div>
                <div className="text-sm text-muted-foreground">
                  {[
                    `📁 ${d.folder_name}`,
                    d.property_id ? `🏠 ${propMap.get(d.property_id) ?? ""}` : null,
                    size(d.size_bytes),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>

              {left !== null && d.expires_at && (
                <span
                  className={`whitespace-nowrap rounded px-2 py-0.5 text-xs ${
                    left < 0
                      ? "bg-red-100 text-red-700"
                      : left <= 30
                        ? "bg-amber-100 text-amber-800"
                        : "bg-muted"
                  }`}
                >
                  {left < 0
                    ? `ვადა გაუვიდა · ${dmy(d.expires_at)}`
                    : left <= 30
                      ? `${left} დღე დარჩა · ${dmy(d.expires_at)}`
                      : `ვადა: ${dmy(d.expires_at)}`}
                </span>
              )}

              {href && (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center rounded-md border px-3 text-sm"
                >
                  გახსნა
                </a>
              )}
              <DocumentForm
                key={`${d.id}-${d.title}-${d.folder_name}-${d.expires_at}-${d.property_id}-${d.file_path}-${d.file_url}`}
                doc={d}
                properties={props.map((p) => ({ id: p.id, number: p.number }))}
                folders={folders}
              />
              <DeleteButton
                action={deleteDocument.bind(null, d.id)}
                title="დოკუმენტის წაშლა"
                description={`„${d.title}"${d.file_path ? " და მისი ფაილი" : ""} სამუდამოდ წაიშლება.`}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}

export default function DocumentsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">იტვირთება...</div>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}