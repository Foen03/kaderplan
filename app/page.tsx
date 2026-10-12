import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { CreateTeamForm, JoinTeamForm } from "@/components/TeamForms";
import { signOut } from "./actions";

export default async function Home({ searchParams }: { searchParams: Promise<{ neu?: string }> }) {
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login");
  const sp = await searchParams;

  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id, role, teams(name)")
    .eq("user_id", user.id)
    .eq("active", true);

  const teams = (memberships ?? []) as unknown as { team_id: string; role: string; teams: { name: string } | null }[];
  if (teams.length === 1 && !sp.neu) redirect(`/t/${teams[0].team_id}`);

  return (
    <main className="center">
      <div className="panel">
        {teams.length > 0 && (
          <>
            <h2>Deine Teams</h2>
            <div className="items">
              {teams.map((t) => (
                <div className="item" key={t.team_id}>
                  <Link href={`/t/${t.team_id}`}>{t.teams?.name ?? "Team"}</Link>
                  <span className="sub">{t.role === "coach" ? "Trainer" : "Spieler"}</span>
                </div>
              ))}
            </div>
          </>
        )}
        <h2>Team beitreten</h2>
        <p>Den Teamcode bekommst du von deinem Trainer.</p>
        <JoinTeamForm />
        <h2 style={{ marginTop: 12 }}>Neues Team</h2>
        <p>Du wirst automatisch Trainer und kannst Kader und Trainingszeiten verwalten.</p>
        <CreateTeamForm />
        <form action={signOut}>
          <button className="btn link small">Abmelden ({user.email})</button>
        </form>
      </div>
    </main>
  );
}
