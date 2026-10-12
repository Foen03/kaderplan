import Link from "next/link";

export default function NotFound() {
  return (
    <main className="center">
      <div className="panel">
        <h2>Nicht gefunden</h2>
        <p>Dieses Team gibt es nicht oder du bist kein aktives Mitglied.</p>
        <Link className="btn" href="/?neu=1">Zu deinen Teams</Link>
      </div>
    </main>
  );
}
