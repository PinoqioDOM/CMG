// ერთჯერადი სკრიპტი: მომარაგების ფოტოების ატვირთვა Supabase-ში.
// გაშვება (PowerShell, პროექტის ძირში):
//   $env:CMG_EMAIL="cmgmia@gmail.com"; $env:CMG_PASSWORD="პაროლი"
//   node --env-file=.env.local scripts/upload-supply-photos.mjs
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.CMG_EMAIL;
const password = process.env.CMG_PASSWORD;
if (!url || !anon) throw new Error("NEXT_PUBLIC_SUPABASE_URL / ANON_KEY ვერ მოიძებნა (.env.local)");
if (!email || !password) throw new Error("დააყენე CMG_EMAIL და CMG_PASSWORD");

const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(",", ".")
    .replace(/[^\p{L}\p{N}.]/gu, "");

const dir = path.join(import.meta.dirname, "supply-photos");
const mapping = JSON.parse(fs.readFileSync(path.join(dir, "mapping.json"), "utf8"));

const supabase = createClient(url, anon);
const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
if (authErr) throw new Error("შესვლა ვერ მოხერხდა: " + authErr.message);

const { data: items, error } = await supabase
  .from("supply_items")
  .select("id, name, volume, photo_url");
if (error) throw error;

let done = 0, skipped = 0;
const problems = [];

for (const m of mapping) {
  const matches = items.filter(
    (i) => norm(i.name) === norm(m.name) && norm(i.volume) === norm(m.volume)
  );
  if (matches.length !== 1) {
    problems.push(`${m.name} (${m.volume ?? "-"}): ნაპოვნია ${matches.length}`);
    continue;
  }
  const item = matches[0];
  if (item.photo_url) {
    skipped++;
    continue;
  }
  const ext = m.file.split(".").pop();
  const storagePath = `supplies/${randomUUID()}.${ext}`;
  const body = fs.readFileSync(path.join(dir, m.file));
  const { error: upErr } = await supabase.storage
    .from("photos")
    .upload(storagePath, body, { contentType: ext === "png" ? "image/png" : "image/jpeg" });
  if (upErr) {
    problems.push(`${m.name}: ატვირთვა ვერ მოხერხდა (${upErr.message})`);
    continue;
  }
  const { error: dbErr } = await supabase
    .from("supply_items")
    .update({ photo_url: storagePath })
    .eq("id", item.id);
  if (dbErr) {
    problems.push(`${m.name}: ბაზაში ვერ ჩაიწერა (${dbErr.message})`);
    continue;
  }
  done++;
  console.log("✓", m.name);
}

console.log(`\nატვირთულია: ${done}, უკვე ჰქონდა: ${skipped}, პრობლემა: ${problems.length}`);
problems.forEach((p) => console.log("!", p));
