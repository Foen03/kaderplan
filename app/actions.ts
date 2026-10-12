"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { REASONS, type Status } from "@/lib/types";
import { sendToTeam } from "@/lib/push";
import { fmtDate, todayDE } from "@/lib/dates";

type FormState = { error?: string } | undefined;

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const orNull = (s: string) => (s === "" ? null : s);

async function sb() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/* ───────── Team anlegen / beitreten ───────── */

export async function createTeam(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await sb();
  const name = str(fd, "team");
  const me = str(fd, "name");
  if (!name || !me) return { error: "Bitte Teamname und deinen Namen angeben." };
  const { data, error } = await supabase.rpc("create_team", { p_name: name, p_display_name: me });
  if (error) return { error: "Team konnte nicht angelegt werden." };
  redirect(`/t/${data}/verwaltung`);
}

export async function joinTeam(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await sb();
  const code = str(fd, "code");
  const me = str(fd, "name");
  if (!code || !me) return { error: "Bitte Teamcode und deinen Namen angeben." };
  const { data, error } = await supabase.rpc("join_team", { p_code: code, p_display_name: me });
  if (error) return { error: error.message.includes("Unbekannter") ? "Diesen Teamcode gibt es nicht." : "Beitritt fehlgeschlagen." };
  redirect(`/t/${data}`);
}

export async function signOut() {
  const { supabase } = await sb();
  await supabase.auth.signOut();
  redirect("/login");
}

/* ───────── Zu- und Absagen ───────── */

export async function setResponse(input: {
  teamId: string;
  trainingId: string;
  userId?: string; // nur Trainer: Antwort für einen Spieler setzen
  status: Status;
  reason: string | null;
  comment: string | null;
}): Promise<{ error?: string }> {
  const { supabase, user } = await sb();
  if (!["yes", "no", "maybe"].includes(input.status)) return { error: "Ungültiger Status" };
  const reason = input.status === "yes" || !input.reason || !(REASONS as readonly string[]).includes(input.reason) ? null : input.reason;
  const comment = input.comment?.trim().slice(0, 300) || null;
  const { error } = await supabase.from("responses").upsert({
    training_id: input.trainingId,
    user_id: input.userId ?? user.id,
    status: input.status,
    reason,
    comment,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: "Speichern fehlgeschlagen." };
  revalidatePath(`/t/${input.teamId}`, "layout");
  return {};
}

/* ───────── Trainer: Termine ───────── */

export async function cancelTraining(teamId: string, trainingId: string, reason: string) {
  const { supabase } = await sb();
  const { data, error } = await supabase
    .from("trainings")
    .update({ cancelled: true, cancel_reason: reason.trim().slice(0, 200) || null })
    .eq("id", trainingId)
    .select("date, title, team_id")
    .single();
  if (error) return { error: "Absagen fehlgeschlagen." };
  await sendToTeam(teamId, {
    title: `${data.title} am ${fmtDate(data.date)} fällt aus`,
    body: reason.trim() || "Das Training wurde vom Trainer abgesagt.",
    url: `/t/${teamId}`,
  }).catch(() => {});
  revalidatePath(`/t/${teamId}`, "layout");
  return {};
}

export async function uncancelTraining(teamId: string, trainingId: string) {
  const { supabase } = await sb();
  await supabase.from("trainings").update({ cancelled: false, cancel_reason: null }).eq("id", trainingId);
  revalidatePath(`/t/${teamId}`, "layout");
}

export async function addSeries(teamId: string, fd: FormData) {
  const { supabase } = await sb();
  await supabase.from("training_series").insert({
    team_id: teamId,
    weekday: Number(str(fd, "weekday")),
    start_time: str(fd, "start"),
    end_time: orNull(str(fd, "end")),
    location: orNull(str(fd, "location")),
    title: str(fd, "title") || "Training",
    starts_on: str(fd, "starts_on") || undefined,
  });
  await supabase.rpc("ensure_trainings", { p_team: teamId });
  revalidatePath(`/t/${teamId}`, "layout");
}

export async function endSeries(teamId: string, seriesId: string) {
  const { supabase } = await sb();
  const yesterday = todayDE(-1);
  await supabase.from("training_series").update({ ends_on: yesterday }).eq("id", seriesId);
  await supabase.rpc("ensure_trainings", { p_team: teamId });
  revalidatePath(`/t/${teamId}`, "layout");
}

export async function addTraining(teamId: string, fd: FormData) {
  const { supabase } = await sb();
  const date = str(fd, "date");
  if (!date) return;
  await supabase.from("trainings").insert({
    team_id: teamId,
    date,
    start_time: orNull(str(fd, "start")),
    end_time: orNull(str(fd, "end")),
    location: orNull(str(fd, "location")),
    title: str(fd, "title") || "Training",
  });
  revalidatePath(`/t/${teamId}`, "layout");
}

/* ───────── Trainer: Team und Kader ───────── */

export async function renameTeam(teamId: string, fd: FormData) {
  const { supabase } = await sb();
  const name = str(fd, "name");
  if (name) await supabase.from("teams").update({ name }).eq("id", teamId);
  revalidatePath(`/t/${teamId}`, "layout");
}

export async function regenerateCode(teamId: string) {
  const { supabase } = await sb();
  await supabase.rpc("regenerate_join_code", { p_team: teamId });
  revalidatePath(`/t/${teamId}/verwaltung`);
}

export async function setMember(teamId: string, userId: string, patch: { active?: boolean; role?: "coach" | "player" }) {
  const { supabase, user } = await sb();
  if (userId === user.id && (patch.active === false || patch.role === "player")) {
    // Sich selbst nicht aussperren
    const { count } = await supabase
      .from("team_members")
      .select("*", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("role", "coach")
      .eq("active", true);
    if ((count ?? 0) <= 1) return;
  }
  await supabase.from("team_members").update(patch).eq("team_id", teamId).eq("user_id", userId);
  revalidatePath(`/t/${teamId}`, "layout");
}

export async function setMyName(teamId: string, fd: FormData) {
  const { supabase } = await sb();
  const name = str(fd, "name");
  if (name) await supabase.rpc("set_my_name", { p_team: teamId, p_display_name: name });
  revalidatePath(`/t/${teamId}`, "layout");
}

/* ───────── Push ───────── */

export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  const { supabase, user } = await sb();
  const { error } = await supabase.from("push_subscriptions").upsert({
    endpoint: sub.endpoint,
    user_id: user.id,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
  });
  return { ok: !error };
}

export async function deletePushSubscription(endpoint: string) {
  const { supabase } = await sb();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return { ok: true };
}
