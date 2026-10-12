export const TZ = "Europe/Berlin";
export const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
export const WDL = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
export const MO = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

/** YYYY-MM-DD in deutscher Zeit */
export function todayDE(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** HH:MM in deutscher Zeit */
export function nowTimeDE(): string {
  return new Intl.DateTimeFormat("de-DE", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}

export function parts(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return { wd: WD[dt.getUTCDay()], wdl: WDL[dt.getUTCDay()], day: d, mon: MO[m - 1], year: y };
}

export const hm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");

export function fmtDate(date: string) {
  const p = parts(date);
  return `${p.wd}, ${p.day}. ${p.mon}`;
}

/** Hat das Training schon begonnen? */
export function isPast(date: string, start: string | null) {
  const t = todayDE();
  if (date < t) return true;
  if (date > t) return false;
  return hm(start || "23:59") <= nowTimeDE();
}
