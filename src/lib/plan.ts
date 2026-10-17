export const monthGenitive = [
  "იანვრის",
  "თებერვლის",
  "მარტის",
  "აპრილის",
  "მაისის",
  "ივნისის",
  "ივლისის",
  "აგვისტოს",
  "სექტემბრის",
  "ოქტომბრის",
  "ნოემბრის",
  "დეკემბრის",
];

const iso = (ts: number) => new Date(ts).toISOString().slice(0, 10);
const nums = (s: string) => s.split("-").map(Number);

export const dm = (s: string) => s.split("-").reverse().slice(0, 2).join(".");
export const dmy = (s: string) => s.split("-").reverse().join(".");

export function weekRange(date: string) {
  const [y, m, d] = nums(date);
  const ts = Date.UTC(y, m - 1, d);
  const offset = (new Date(ts).getUTCDay() + 6) % 7;
  return { start: iso(ts - offset * 86400000), end: iso(ts + (6 - offset) * 86400000) };
}

export function monthRange(date: string) {
  const [y, m] = nums(date);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const ym = date.slice(0, 7);
  return { start: `${ym}-01`, end: `${ym}-${String(last).padStart(2, "0")}` };
}

export function periodTitle(type: string, start: string, end: string) {
  const [y, sm, sd] = nums(start);
  const [, em, ed] = nums(end);
  if (type === "month") {
    return { title: `${monthGenitive[sm - 1]} დასუფთავების გეგმა`, sub: String(y) };
  }
  if (sm === em) {
    return { title: `${monthGenitive[sm - 1]} კვირის გეგმა`, sub: `${sd}–${ed}` };
  }
  return { title: "კვირის გეგმა", sub: `${dm(start)}–${dm(end)}` };
}