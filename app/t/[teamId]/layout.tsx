import Link from "next/link";
import { getTeamContext } from "@/lib/team";
import { Tabs } from "@/components/Tabs";
import { PushToggle } from "@/components/PushToggle";

export default async function TeamLayout({ children, params }: { children: React.ReactNode; params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const { team, me, isCoach } = await getTeamContext(teamId);
  return (
    <div className="wrap">
      <header className="top">
        <div className="brand">
          <h1>
            <small>Trainingsplanung</small>
            {team.name}
          </h1>
          <div className="me">
            <span>
              Du bist <b>{me.display_name}</b>{isCoach ? " · Trainer" : ""}
            </span>
            <PushToggle />
            <Link className="btn link small" href="/?neu=1">Teams</Link>
          </div>
        </div>
        <Tabs teamId={teamId} isCoach={isCoach} />
      </header>
      <main>{children}</main>
    </div>
  );
}
