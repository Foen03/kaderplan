import Link from "next/link";
import { getTeamContext } from "@/lib/team";
import { isPast, parts, todayDE } from "@/lib/dates";
import type { Response, Training } from "@/lib/types";

const PERIODS = [
  { v: "28", l: "4 Wochen" },
  { v: "90", l: "3 Monate" },
  { v: "182", l: "6 Monate" },
  { v: "all", l: "Gesamt" },
];
const SORTS = ["name", "yes", "no", "none", "q"] as const;
type Sort = (typeof SORTS)[number];

export default async function StatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ p?: string; s?: string }>;
}) {
  const { teamId } = await params;
  const sp = await searchParams;
  const period = PERIODS.some((x) => x.v === sp.p) ? sp.p! : "90";
  const sort: Sort = (SORTS as readonly string[]).includes(sp.s ?? "") ? (sp.s as Sort) : "q";
  const { supabase, active } = await getTeamContext(teamId);

  let q = supabase.from("trainings").select("*").eq("team_id", teamId).eq("cancelled", false).lte("date", todayDE()).order("date");
  if (period !== "all") q = q.gte("date", todayDE(-Number(period)));
  const { data: tr } = await q;
  const trainings = ((tr ?? []) as Training[]).filter((t) => isPast(t.date, t.start_time));

  // Antworten in Blöcken laden (URL-Länge)
  const responses: Response[] = [];
  for (let i = 0; i < trainings.length; i += 150) {
    const ids = trainings.slice(i, i + 150).map((t) => t.id);
    const { data } = await supabase.from("responses").select("*").in("training_id", ids);
    responses.push(...((data ?? []) as Response[]));
  }
  const key = (t: string, u: string) => `${t}|${u}`;
  const map = new Map(responses.map((r) => [key(r.training_id, r.user_id), r]));

  const rows = active.map((m) => {
    const r = { id: m.user_id, name: m.display_name, n: 0, yes: 0, no: 0, maybe: 0, none: 0, q: 0 };
    for (const t of trainings) {
      if (m.joined_on > t.date) continue;
      r.n++;
      const x = map.get(key(t.id, m.user_id));
      r[x ? x.status : "none"]++;
    }
    r.q = r.n ? r.yes / r.n : 0;
    return r;
  });
  const cmp: Record<Sort, (a: (typeof rows)[0], b: (typeof rows)[0]) => number> = {
    name: (a, b) => a.name.localeCompare(b.name, "de"),
    yes: (a, b) => b.yes - a.yes,
    no: (a, b) => b.no - a.no,
    none: (a, b) => b.none - a.none,
    q: (a, b) => b.q - a.q || b.yes - a.yes,
  };
  rows.sort(cmp[sort]);

  const per = trainings.map((t) => {
    const elig = active.filter((m) => m.joined_on <= t.date);
    const yes = elig.filter((m) => map.get(key(t.id, m.user_id))?.status === "yes").length;
    return { t, yes, total: elig.length };
  });
  const reasons = new Map<string, number>();
  for (const t of trainings)
    for (const m of active) {
      const x = map.get(key(t.id, m.user_id));
      if (x?.status === "no") reasons.set(x.reason ?? "Ohne Angabe", (reasons.get(x.reason ?? "Ohne Angabe") ?? 0) + 1);
    }
  const rs = [...reasons.entries()].sort((a, b) => b[1] - a[1]);
  const rmax = Math.max(1, ...rs.map((r) => r[1]));
  const max = Math.max(1, ...per.map((x) => x.total));
  const avg = per.length ? per.reduce((s, x) => s + x.yes, 0) / per.length : 0;
  const tn = rows.reduce((s, r) => s + r.n, 0);
  const ty = rows.reduce((s, r) => s + r.yes, 0);

  const href = (o: { p?: string; s?: string }) => `/t/${teamId}/statistik?p=${o.p ?? period}&s=${o.s ?? sort}`;
  const filters = (
    <div className="filters">
      {PERIODS.map((x) => (
        <Link key={x.v} className="btn small" href={href({ p: x.v })} aria-current={period === x.v ? "true" : undefined} scroll={false}>
          {x.l}
        </Link>
      ))}
    </div>
  );

  if (!trainings.length)
    return (
      <>
        {filters}
        <div className="empty" style={{ marginTop: 14 }}>
          <b>Noch keine Daten</b>
          Gezählt werden stattgefundene Trainings im gewählten Zeitraum. Abgesagte Trainings zählen nicht.
        </div>
      </>
    );

  const th = (s: Sort, label: string, title?: string) => (
    <th title={title}>
      <Link href={href({ s })} scroll={false}>
        {label}
        {sort === s ? " ↓" : ""}
      </Link>
    </th>
  );
  const first = parts(per[0].t.date);
  const last = parts(per[per.length - 1].t.date);

  return (
    <>
      {filters}
      <div className="kpis">
        <div className="kpi"><div className="v">{trainings.length}</div><div className="l">Trainings</div></div>
        <div className="kpi"><div className="v">{avg.toFixed(1).replace(".", ",")}</div><div className="l">Ø Zusagen</div></div>
        <div className="kpi"><div className="v">{tn ? Math.round((ty / tn) * 100) : 0}%</div><div className="l">Quote Team</div></div>
      </div>

      <div className="section-h"><span>Anwesenheit pro Spieler</span></div>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              {th("name", "Spieler")}
              {th("yes", "Zu", "Zusagen")}
              {th("no", "Ab", "Absagen")}
              <th title="Unsicher">?</th>
              {th("none", "Offen", "Keine Antwort")}
              {th("q", "Quote")}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.yes}</td>
                <td>{r.no}</td>
                <td>{r.maybe}</td>
                <td>{r.none}</td>
                <td className="q">
                  <div className="qbar">
                    <span className="track"><i style={{ width: `${r.q * 100}%` }} /></span>
                    <span>{Math.round(r.q * 100)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ margin: "6px 2px 0" }}>Quote = Zusagen ÷ Trainings seit Beitritt zum Team. Spaltenköpfe sortieren.</p>

      <div className="section-h"><span>Zusagen pro Training</span></div>
      <div className="cols" role="img" aria-label="Zusagen pro Training">
        {per.map((x) => {
          const d = parts(x.t.date);
          return (
            <div className="col" key={x.t.id} title={`${d.wd} ${d.day}. ${d.mon}: ${x.yes} von ${x.total}`}>
              <i style={{ height: `${(x.yes / max) * 100}%` }} />
            </div>
          );
        })}
      </div>
      <div className="cols-axis">
        <span>{first.day}. {first.mon}</span>
        <span>max. {max} Spieler</span>
        <span>{last.day}. {last.mon}</span>
      </div>

      <div className="section-h"><span>Absagegründe</span></div>
      {rs.length ? (
        <div className="rlist">
          {rs.map(([k, v]) => (
            <div className="rrow" key={k}>
              <span>{k}</span>
              <span className="track"><i style={{ width: `${(v / rmax) * 100}%` }} /></span>
              <span>{v}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">Keine Absagen im Zeitraum.</div>
      )}
    </>
  );
}

