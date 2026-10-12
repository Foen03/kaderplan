"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ next }: { next: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}` },
    });
    setBusy(false);
    if (error) setErr("Senden fehlgeschlagen. Prüfe die Adresse und versuche es in einer Minute erneut.");
    else setSent(true);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) setErr("Der Code stimmt nicht oder ist abgelaufen.");
    else {
      router.replace(safeNext);
      router.refresh();
    }
  }

  if (!sent)
    return (
      <form onSubmit={send} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input id="email" type="email" required autoComplete="email" placeholder="name@beispiel.de" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="btn primary" disabled={busy}>{busy ? "Wird gesendet …" : "Anmelden"}</button>
        {err && <p className="error">{err}</p>}
      </form>
    );

  return (
    <form onSubmit={verify} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p>
        E-Mail an <b>{email}</b> ist unterwegs. Tippe auf den Link oder gib den Code ein. Der Code funktioniert auch in der installierten App.
      </p>
      <input id="code" type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="6-stelliger Code" value={code} onChange={(e) => setCode(e.target.value)} />
      <button className="btn primary" disabled={busy || code.trim().length < 6}>Code bestätigen</button>
      <button type="button" className="btn link" onClick={() => setSent(false)}>Andere Adresse verwenden</button>
      {err && <p className="error">{err}</p>}
    </form>
  );
}
