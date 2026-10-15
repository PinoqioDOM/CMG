import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { monthNames, paymentStatusLabels } from "@/lib/labels";

type Prop = { id: string; type: string; number: string };
type Pay = {
  property_id: string;
  year: number;
  month: number;
  amount_due: number;
  amount_paid: number;
  balance: number;
  status: string;
  comment: string | null;
};

const num = (s: string) => parseInt(s.replace(/\D/g, ""), 10) || 0;
const sortProps = (a: Prop, b: Prop) =>
  a.type === b.type ? num(a.number) - num(b.number) : a.type === "apartment" ? -1 : 1;

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "1";
  const ym = url.searchParams.get("ym") ?? "";
  const m = /^(\d{4})-(\d{2})$/.exec(ym);

  const { data: propsData } = await supabase.from("properties").select("id, type, number");
  const props = ((propsData ?? []) as Prop[]).sort(sortProps);

  const { data: resData } = await supabase
    .from("residents")
    .select("property_id, full_name, is_primary")
    .order("is_primary", { ascending: false });
  const owners = new Map<string, string[]>();
  (resData ?? []).forEach((r) => {
    owners.set(r.property_id, [...(owners.get(r.property_id) ?? []), r.full_name]);
  });
  const ownerOf = (id: string) => (owners.get(id) ?? []).join(" / ");

  const wb = new ExcelJS.Workbook();
  const head = (ws: ExcelJS.Worksheet) => {
    const r = ws.getRow(1);
    r.font = { bold: true, name: "Arial" };
    r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  };

  let filename: string;

  if (all) {
    const { data } = await supabase.from("payments_view").select("*").limit(5000);
    const pays = (data ?? []) as Pay[];
    const keys = Array.from(new Set(pays.map((p) => p.year * 100 + p.month))).sort();
    const ws = wb.addWorksheet("გადახდები");
    ws.columns = [
      { header: "ობიექტი", key: "n", width: 14 },
      { header: "მესაკუთრე", key: "o", width: 34 },
      ...keys.map((k) => ({
        header: `${monthNames[(k % 100) - 1].slice(0, 3)} ${Math.floor(k / 100)}`,
        key: String(k),
        width: 11,
      })),
      { header: "სულ", key: "t", width: 12 },
      { header: "დავალიანება", key: "d", width: 14 },
    ];
    head(ws);

    const byProp = new Map<string, Map<number, Pay>>();
    pays.forEach((p) => {
      if (!byProp.has(p.property_id)) byProp.set(p.property_id, new Map());
      byProp.get(p.property_id)!.set(p.year * 100 + p.month, p);
    });

    props.forEach((p, i) => {
      const row: Record<string, string | number | { formula: string }> = {
        n: p.number,
        o: ownerOf(p.id),
      };
      let debt = 0;
      keys.forEach((k) => {
        const pay = byProp.get(p.id)?.get(k);
        if (pay) {
          row[String(k)] = pay.amount_paid;
          if (pay.status === "overdue" || pay.status === "partial") debt += Math.max(pay.balance, 0);
        }
      });
      const first = ws.getColumn(3).letter;
      const last = ws.getColumn(2 + keys.length).letter;
      row.t = { formula: `SUM(${first}${i + 2}:${last}${i + 2})` };
      row.d = Math.round(debt * 100) / 100;
      ws.addRow(row);
    });
    filename = "gadakhdebi-yvela-tve.xlsx";
  } else {
    if (!m) return new Response("Bad request", { status: 400 });
    const year = Number(m[1]);
    const month = Number(m[2]);
    const { data } = await supabase
      .from("payments_view")
      .select("*")
      .eq("year", year)
      .eq("month", month);
    const byProp = new Map(((data ?? []) as Pay[]).map((p) => [p.property_id, p]));

    const ws = wb.addWorksheet(`${monthNames[month - 1]} ${year}`);
    ws.columns = [
      { header: "ობიექტი", key: "n", width: 14 },
      { header: "მესაკუთრე", key: "o", width: 34 },
      { header: "გადასახდელი", key: "due", width: 14 },
      { header: "გადახდილი", key: "paid", width: 14 },
      { header: "ნაშთი", key: "bal", width: 12 },
      { header: "სტატუსი", key: "s", width: 18 },
      { header: "კომენტარი", key: "c", width: 40 },
    ];
    head(ws);

    let count = 0;
    props.forEach((p) => {
      const pay = byProp.get(p.id);
      if (!pay) return;
      count += 1;
      const r = count + 1;
      ws.addRow({
        n: p.number,
        o: ownerOf(p.id),
        due: pay.amount_due,
        paid: pay.amount_paid,
        bal: { formula: `MAX(C${r}-D${r},0)` },
        s: paymentStatusLabels[pay.status] ?? pay.status,
        c: pay.comment ?? "",
      });
    });
    if (count > 0) {
      const t = ws.addRow({
        n: "სულ",
        due: { formula: `SUM(C2:C${count + 1})` },
        paid: { formula: `SUM(D2:D${count + 1})` },
        bal: { formula: `SUM(E2:E${count + 1})` },
      });
      t.font = { bold: true, name: "Arial" };
    }
    filename = `gadakhdebi-${ym}.xlsx`;
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}