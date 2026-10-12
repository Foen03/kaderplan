import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getTeamContext } from "@/lib/team";
import { WDL, hm, todayDE, parts } from "@/lib/dates";
import type { Series } from "@/lib/types";
import { addSeries, addTraining, endSeries, regenerateCode, renameTeam, setMember, setMyName } from "@/app/actions";
import { ConfirmButton, CopyButton } from "@/components/Buttons";

const fmt = (d: string) => {
  const p = parts(d);
  return `${p.day}. ${p.mon} ${p.year}`;
};

export default async function AdminPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { supabase, team, members, me, isCoach } = await getTeamContext(teamId);
  if (!isCoach) notFound();

  const { data: s } = await supabase.from("training_series").select("*").eq("team_id", teamId).order("weekday");
  const series = (s ?? []) as Series[];
  const today = todayDE();
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const joinUrl = `${origin}/join/${team.join_code}`;
  const activeMembers = members.filter((m) => m.active);
  const inactive = members.filter((m) => !m.active);

  return (
    <>
      <div className="section-h"><span>Mannschaft einladen</span></div>
      <div className="form">
        <div className="item" style={{ borderBottom: 0 }}>
          <span>
            <span className="muted">Teamcode</span>
            <br />
            <span className="code">{team.join_code}</span>
          </span>
          <form action={regenerateCode.bind(null, teamId)}>
            <ConfirmButton className="btn small" confirmLabel="Alten Code ungültig machen?">Neuer Code</ConfirmButton>
          </form>
        </div>
        <div className="cmt">
          <input id="join-url" type="text" readOnly value={joinUrl} />
          <CopyButton text={joinUrl} />
        </div>
        <p className="muted" style={{ margin: 0 }}>Schick den Link in die Mannschaftsgruppe. Wer ihn öffnet, meldet sich per E-Mail an und ist im Team.</p>
      </div>

      <div className="section-h"><span>Team</span></div>
      <div className="form">
        <form className="row" action={renameTeam.bind(null, teamId)}>
          <label>Teamname<input id="team-name" name="name" type="text" defaultValue={team.name} maxLength={80} required /></label>
          <button className="btn">Speichern</button>
        </form>
        <form className="row" action={setMyName.bind(null, teamId)}>
          <label>Dein Name im Team<input id="my-name" name="name" type="text" defaultValue={me.display_name} maxLength={60} required /></label>
          <button className="btn">Speichern</button>
        </form>
      </div>

      <div className="section-h">
        <span>Kader</span>
        <span className="count">{activeMembers.length} aktiv</span>
      </div>
      <div className="form">
        <div className="items">
          {activeMembers.map((m) => (
            <div className="item" key={m.user_id}>
              <span>
                {m.display_name}
                <br />
                <span className="sub">
                  {m.role === "coach" ? "Trainer" : "Spieler"} · seit {fmt(m.joined_on)}
                </span>
              </span>
              <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <form action={setMember.bind(null, teamId, m.user_id, { role: m.role === "coach" ? "player" : "coach" })}>
                  <button className="btn small">{m.role === "coach" ? "Zum Spieler machen" : "Zum Trainer machen"}</button>
                </form>
                {m.user_id !== me.user_id && (
                  <form action={setMember.bind(null, teamId, m.user_id, { active: false })}>
                    <ConfirmButton className="btn small danger" confirmLabel="Wirklich entfernen?">Entfernen</ConfirmButton>
                  </form>
                )}
              </span>
            </div>
          ))}
        </div>
        {inactive.length > 0 && (
          <details>
            <summary className="muted">Entfernte Mitglieder ({inactive.length})</summary>
            <div className="items">
              {inactive.map((m) => (
                <div className="item" key={m.user_id}>
                  <span>{m.display_name}</span>
                  <form action={setMember.bind(null, teamId, m.user_id, { active: true })}>
                    <button className="btn small">Wieder aufnehmen</button>
                  </form>
                </div>
              ))}
            </div>
          </details>
        )}
        <p className="muted" style={{ margin: 0 }}>Entfernte Mitglieder fehlen in Listen und Statistik. Ihre Antworten bleiben gespeichert.</p>
      </div>

      <div className="section-h"><span>Feste Trainingszeiten</span></div>
      <div className="form">
        <div className="items">
          {series.length === 0 && <div className="item sub">Noch keine festen Zeiten.</div>}
          {series.map((x) => {
            const ended = x.ends_on && x.ends_on < today;
            return (
              <div className="item" key={x.id}>
                <span>
                  {x.title} · {WDL[x.weekday]} {hm(x.start_time)}
                  {x.end_time ? `–${hm(x.end_time)}` : ""}
                  <br />
                  <span className="sub">
                    {x.location ? `${x.location} · ` : ""}ab {fmt(x.starts_on)}
                    {x.ends_on ? ` bis ${fmt(x.ends_on)}` : ""}
                  </span>
                </span>
                {ended ? (
                  <span className="sub">beendet</span>
                ) : (
                  <form action={endSeries.bind(null, teamId, x.id)}>
                    <ConfirmButton className="btn small" confirmLabel="Ab heute beenden?">Beenden</ConfirmButton>
                  </form>
                )}
              </div>
            );
          })}
        </div>
        <form action={addSeries.bind(null, teamId)} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="row">
            <label>
              Wochentag
              <select id="s-wd" name="weekday" defaultValue="2">
                {[1, 2, 3, 4, 5, 6, 0].map((i) => (
                  <option key={i} value={i}>{WDL[i]}</option>
                ))}
              </select>
            </label>
            <label>Beginn<input id="s-start" name="start" type="time" defaultValue="19:00" required /></label>
            <label>Ende<input id="s-end" name="end" type="time" defaultValue="20:30" /></label>
          </div>
          <div className="row">
            <label>Ort<input id="s-loc" name="location" type="text" placeholder="z. B. Sportpark Halle 2" maxLength={120} /></label>
            <label>Bezeichnung<input id="s-title" name="title" type="text" defaultValue="Training" maxLength={80} /></label>
            <label>Ab Datum<input id="s-from" name="starts_on" type="date" defaultValue={today} /></label>
          </div>
          <div><button className="btn primary">Trainingszeit anlegen</button></div>
        </form>
      </div>

      <div className="section-h"><span>Einzeltermin</span></div>
      <form className="form" action={addTraining.bind(null, teamId)}>
        <div className="row">
          <label>Datum<input id="x-date" name="date" type="date" defaultValue={today} required /></label>
          <label>Beginn<input id="x-start" name="start" type="time" defaultValue="18:00" /></label>
          <label>Ende<input id="x-end" name="end" type="time" /></label>
        </div>
        <div className="row">
          <label>Ort<input id="x-loc" name="location" type="text" maxLength={120} /></label>
          <label>Bezeichnung<input id="x-title" name="title" type="text" defaultValue="Zusatztraining" maxLength={80} /></label>
        </div>
        <div><button className="btn primary">Termin anlegen</button></div>
      </form>
      <p className="muted">Einzelne Trainings sagst du im Tab Termine direkt am Termin ab. Alle mit aktivierten Benachrichtigungen bekommen dann eine Push-Nachricht.</p>
    </>
  );
}
