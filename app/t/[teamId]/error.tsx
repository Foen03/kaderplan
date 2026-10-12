"use client";

export default function TeamError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="empty" style={{ marginTop: 20 }}>
      <b>Das hat nicht geklappt</b>
      Die Daten konnten nicht geladen oder gespeichert werden. Prüfe deine Verbindung.
      <div style={{ marginTop: 10 }}>
        <button className="btn" onClick={reset}>Erneut versuchen</button>
      </div>
    </div>
  );
}
