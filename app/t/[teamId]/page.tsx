import Link from "next/link";
import { getTeamContext } from "@/lib/team";
import { todayDE } from "@/lib/dates";
import type { Response, Training } from "@/lib/types";
import { TrainingCard } from "@/components/TrainingCard";

export default async function TerminePage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ vergangen?: string }>;
}) {
  const { teamId } = await params;
  const showPast = (await searchParams).vergangen === "1";
  const { supabase, me, active, isCoach } = await getTeamContext(teamId);
  await supabase.rpc("ensure_trainings", { p_team: teamId });

  const today = todayDE();
  const [{ data: up }, { data: past }, { count: pastCount }] = await Promise.all([
    supabase.from("trainings").select("*").eq("team_id", teamId).gte("date", today).order("date").order("start_time").limit(40),
    showPast
      ? supabase.from("trainings").select("*").eq("team_id", teamId).lt("date", today).order("date", { ascending: false }).limit(30)
      : Promise.resolve({ data: [] as Training[] }),
    supabase.from("trainings").select("*", { count: "exact", head: true }).eq("team_id", teamId).lt("date", today),
  ]);
  const upcoming = (up ?? []) as Training[];
  const previous = (past ?? []) as Training[];
  const ids = [...upcoming, ...previous].map((t) => t.id);
  const { data: resp } = ids.length
    ? await supabase.from("responses").select("*").in("training_id", ids)
    : { data: [] as Response[] };
  const byTraining = new Map<string, Response[]>();
  for (const r of (resp ?? []) as Response[]) {
    if (!byTraining.has(r.training_id)) byTraining.set(r.training_id, []);
    byTraining.get(r.training_id)!.push(r);
  }
  const players = active.map((m) => ({ id: m.user_id, name: m.display_name, joined: m.joined_on }));

  const card = (t: Training) => (
    <TrainingCard
      key={t.id}
      teamId={teamId}
      training={t}
      today={today}
      players={players.filter((p) => p.joined <= t.date)}
      responses={byTraining.get(t.id) ?? []}
      meId={me.user_id}
      isCoach={isCoach}
    />
  );

  if (!upcoming.length && !pastCount) {
    return (
      <div className="empty" style={{ marginTop: 20 }}>
        <b>Noch keine Trainings</b>
        {isCoach ? (
          <>
            Lege unter <Link href={`/t/${teamId}/verwaltung`}>Verwaltung</Link> die festen Trainingszeiten an und teile den Teamcode mit deiner
            Mannschaft.
          </>
        ) : (
          "Dein Trainer hat noch keine Trainingszeiten angelegt."
        )}
      </div>
    );
  }

  return (
    <>
      <div className="section-h">
        <span>Nächste Trainings</span>
        <span className="count">{upcoming.length} Termine</span>
      </div>
      {upcoming.length ? <div className="list">{upcoming.map(card)}</div> : <div className="empty">Keine anstehenden Termine.</div>}
      {(pastCount ?? 0) > 0 && (
        <>
          <div className="section-h">
            <span>Vergangene Trainings</span>
            <Link className="btn small" href={showPast ? `/t/${teamId}` : `/t/${teamId}?vergangen=1`} scroll={false}>
              {showPast ? "Ausblenden" : `Anzeigen (${pastCount})`}
            </Link>
          </div>
          {showPast && <div className="list">{previous.map(card)}</div>}
        </>
      )}
    </>
  );
}
