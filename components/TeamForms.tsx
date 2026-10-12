"use client";
import { useActionState } from "react";
import { createTeam, joinTeam } from "@/app/actions";

export function JoinTeamForm({ code = "" }: { code?: string }) {
  const [state, action, pending] = useActionState(joinTeam, undefined);
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input id="join-code" name="code" type="text" placeholder="Teamcode, z. B. 4F7A21C9" defaultValue={code} required autoCapitalize="characters" />
      <input id="join-name" name="name" type="text" placeholder="Dein Name im Team" required maxLength={60} />
      <button className="btn primary" disabled={pending}>{pending ? "Trete bei …" : "Beitreten"}</button>
      {state?.error && <p className="error">{state.error}</p>}
    </form>
  );
}

export function CreateTeamForm() {
  const [state, action, pending] = useActionState(createTeam, undefined);
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input id="new-team" name="team" type="text" placeholder="Teamname, z. B. Herren II" required maxLength={80} />
      <input id="new-name" name="name" type="text" placeholder="Dein Name" required maxLength={60} />
      <button className="btn" disabled={pending}>{pending ? "Lege an …" : "Team anlegen"}</button>
      {state?.error && <p className="error">{state.error}</p>}
    </form>
  );
}
