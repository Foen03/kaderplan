"use client";
import { useEffect, useState } from "react";
import { deletePushSubscription, savePushSubscription } from "@/app/actions";

function urlB64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type State = "unsupported" | "ios-install" | "off" | "on" | "denied" | "busy";

export function PushToggle() {
  const [state, setState] = useState<State>("busy");
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !key) {
        setState(ios && !standalone ? "ios-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, [key]);

  async function enable() {
    setState("busy");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(key!) });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const res = await savePushSubscription(json);
      setState(res.ok ? "on" : "off");
    } catch {
      setState("off");
    }
  }

  async function disable() {
    setState("busy");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await deletePushSubscription(sub.endpoint);
      await sub.unsubscribe();
    }
    setState("off");
  }

  if (state === "unsupported") return null;
  if (state === "ios-install")
    return <span className="muted" title="Auf dem iPhone: Teilen → Zum Home-Bildschirm, dann die App von dort öffnen">Push: App zum Home-Bildschirm hinzufügen</span>;
  if (state === "denied") return <span className="muted">Benachrichtigungen blockiert</span>;
  return (
    <button className="btn small" disabled={state === "busy"} onClick={state === "on" ? disable : enable}>
      {state === "on" ? "Benachrichtigungen an" : "Benachrichtigungen aktivieren"}
    </button>
  );
}
