import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";

type Item = {
  name: string;
  volume: string | null;
  unit_price: number | null;
  quantity_needed: number;
  comment: string | null;
  photo_url: string | null;
};

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const withPhotos = new URL(request.url).searchParams.get("photos") !== "0";

  const { data } = await supabase
    .from("supply_items")
    .select("name, volume, unit_price, quantity_needed, comment, photo_url")
    .gt("quantity_needed", 0)
    .order("name");
  const items = (data ?? []) as Item[];

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("შეკვეთა");

  ws.columns = [
    { header: "№", key: "n", width: 5 },
    ...(withPhotos ? [{ header: "ფოტო", key: "p", width: 14 }] : []),
    { header: "დასახელება", key: "name", width: 42 },
    { header: "მოცულობა", key: "vol", width: 12 },
    { header: "რაოდენობა", key: "qty", width: 11 },
    { header: "ფასი (₾)", key: "price", width: 11 },
    { header: "ჯამი (₾)", key: "sum", width: 12 },
    { header: "კომენტარი", key: "c", width: 36 },
  ];

  const head = ws.getRow(1);
  head.font = { bold: true, name: "Arial" };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const qtyCol = ws.getColumn("qty").letter;
  const priceCol = ws.getColumn("price").letter;
  const sumCol = ws.getColumn("sum").letter;

  // ფოტოების ჩამოტვირთვა პარალელურად
  const photos = new Map<number, { buffer: Buffer; ext: "jpeg" | "png" }>();
  if (withPhotos) {
    await Promise.all(
      items.map(async (it, idx) => {
        if (!it.photo_url) return;
        const { data: blob } = await supabase.storage.from("photos").download(it.photo_url);
        if (!blob) return;
        const ext = it.photo_url.toLowerCase().endsWith(".png") ? "png" : "jpeg";
        photos.set(idx, { buffer: Buffer.from(await blob.arrayBuffer()), ext });
      })
    );
  }

  items.forEach((it, idx) => {
    const r = idx + 2;
    const row = ws.addRow({
      n: idx + 1,
      name: it.name,
      vol: it.volume ?? "",
      qty: it.quantity_needed,
      price: it.unit_price ?? null,
      sum: { formula: `IF(ISNUMBER(${priceCol}${r}),${qtyCol}${r}*${priceCol}${r},0)` },
      c: it.comment ?? "",
    });
    row.alignment = { vertical: "middle", wrapText: true };

    const photo = photos.get(idx);
    if (photo) {
      row.height = 58;
      const imageId = wb.addImage({
        buffer: photo.buffer as unknown as ExcelJS.Buffer,
        extension: photo.ext,
      });
      ws.addImage(imageId, {
        tl: { col: 1.1, row: r - 1 + 0.1 },
        ext: { width: 70, height: 70 },
      });
    }
  });

  if (items.length > 0) {
    const total = ws.addRow({
      name: "სულ",
      sum: { formula: `SUM(${sumCol}2:${sumCol}${items.length + 1})` },
    });
    total.font = { bold: true, name: "Arial" };
  }

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tbilisi" });
  const buffer = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="momaragheba-${today}.xlsx"`,
    },
  });
}