import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendToUsers } from "@/lib/push";
import { todayDE, fmtDate, hm } from "@/lib/dates";

export const dynamic = "force-dynamic";

/**
 * Täglich (Vercel Cron, siehe vercel.json): erinnert alle aktiven Spieler,
 * die für die Trainings von morgen noch nicht geantwortet haben.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const tomorrow = todayDE(1);

  const { data: trainings } = await admin
    .from("trainings")
    .select("id, team_id, date, start_time, title, location")
    .eq("date", tomorrow)
    .eq("cancelled", false);

  let sent = 0;
  for (const t of trainings ?? []) {
    const [{ data: members }, { data: responses }, { data: logged }] = await Promise.all([
      admin.from("team_members").select("user_id, joined_on").eq("team_id", t.team_id).eq("active", true),
      admin.from("responses").select("user_id").eq("training_id", t.id),
      admin.from("reminder_log").select("user_id").eq("training_id", t.id),
    ]);
    const answered = new Set([...(responses ?? []), ...(logged ?? [])].map((r) => r.user_id));
    const open = (members ?? []).filter((m) => m.joined_on <= t.date && !answered.has(m.user_id)).map((m) => m.user_id);
    if (!open.length) continue;

    await sendToUsers(open, {
      title: `Morgen: ${t.title}${t.start_time ? " um " + hm(t.start_time) : ""}`,
      body: `Kommst du am ${fmtDate(t.date)}${t.location ? " (" + t.location + ")" : ""}? Bitte zu- oder absagen.`,
      url: `/t/${t.team_id}`,
      tag: `reminder-${t.id}`,
    });
    await admin.from("reminder_log").insert(open.map((user_id) => ({ training_id: t.id, user_id })));
    sent += open.length;
  }
  return NextResponse.json({ trainings: trainings?.length ?? 0, reminded: sent });
}
