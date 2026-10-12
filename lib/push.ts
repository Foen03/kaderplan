import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

let configured = false;
function configure() {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub, priv);
  configured = true;
  return true;
}

/** Schickt eine Benachrichtigung an alle Geräte der angegebenen Nutzer. Gibt die Anzahl erfolgreicher Sendungen zurück. */
export async function sendToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  if (!userIds.length || !configure() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return 0;
  const admin = createAdminClient();
  const { data: subs } = await admin.from("push_subscriptions").select("endpoint, p256dh, auth, user_id").in("user_id", userIds);
  let ok = 0;
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 12 },
        );
        ok++;
      } catch (err: unknown) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    }),
  );
  return ok;
}

export async function sendToTeam(teamId: string, payload: PushPayload) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return 0;
  const admin = createAdminClient();
  const { data } = await admin.from("team_members").select("user_id").eq("team_id", teamId).eq("active", true);
  return sendToUsers((data ?? []).map((m) => m.user_id), payload);
}
