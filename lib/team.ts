import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Member, Team } from "@/lib/types";

/** Lädt Team, alle Mitglieder und die eigene Mitgliedschaft (einmal pro Request). */
export const getTeamContext = cache(async (teamId: string) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: team }, { data: members }] = await Promise.all([
    supabase.from("teams").select("id, name, join_code").eq("id", teamId).maybeSingle(),
    supabase.from("team_members").select("*").eq("team_id", teamId).order("display_name"),
  ]);
  if (!team) notFound();
  const all = (members ?? []) as Member[];
  const me = all.find((m) => m.user_id === user.id);
  if (!me || !me.active) notFound();

  return {
    supabase,
    user,
    team: team as Team,
    members: all,
    active: all.filter((m) => m.active),
    me,
    isCoach: me.role === "coach",
  };
});
