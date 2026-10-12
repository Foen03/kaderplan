# Kaderplan

Mannschafts-App zur Trainingsorganisation, ähnlich wie SpielerPlus:

- **Zu- und Absagen** zu jedem Training (Zusage, Unsicher, Absage), mit Absagegrund und Kommentar
- **Übersicht pro Training:** wer kommt, wer nicht, aus welchem Grund und wer noch nicht geantwortet hat
- **Statistik:** Anwesenheitsquote pro Spieler, Zusagen pro Training und Absagegründe über 4 Wochen, 3 Monate, 6 Monate oder die gesamte Zeit
- **Trainer-Verwaltung:** feste Wochentermine, Einzeltermine, Training absagen, Kader, Rollen, Einladungscode und -link
- **Push-Benachrichtigungen:** Erinnerung am Vortag an alle, die noch nicht geantwortet haben, plus Hinweis bei abgesagtem Training
- **Installierbar** als App auf iPhone und Android (PWA), ohne App Store

Technik: Next.js 15 (App Router) · Supabase (Postgres, Auth, Row Level Security) · Web Push · Hosting auf Vercel. Supabase und Vercel lassen sich für eine Mannschaft im kostenlosen Tarif betreiben.

---

## 1. Lokal starten

```bash
cd ~/Coding2026/kaderplan
npm install
cp .env.example .env.local   # Werte eintragen, siehe Schritt 2–3
npm run dev                  # http://localhost:3000
```

## 2. Supabase einrichten

1. Lege auf [supabase.com](https://supabase.com) ein neues Projekt an (Region: Frankfurt `eu-central-1`).
2. **Datenbank:** SQL Editor öffnen, den Inhalt von `supabase/migrations/0001_init.sql` einfügen und **Run** klicken.
3. **API-Schlüssel:** Unter *Project Settings → API* findest du die Werte für `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `anon`- oder Publishable-Key
   - `SUPABASE_SERVICE_ROLE_KEY` = `service_role`- oder Secret-Key. **Geheim halten!** Er wird nur auf dem Server für Push und Erinnerungen benutzt.
4. **Login per E-Mail:**
   - *Authentication → URL Configuration:* Site URL auf deine App-Adresse setzen (lokal `http://localhost:3000`). Unter Redirect URLs `http://localhost:3000/**` und `https://<deine-domain>/**` eintragen.
   - *Authentication → Email Templates → Magic Link:* den Code mit in die Mail aufnehmen, damit der Login auch in der installierten iPhone-App klappt. Ein Link öffnet sich dort in Safari statt in der App. Beispiel:
     ```html
     <h2>Dein Login für Kaderplan</h2>
     <p>Code: <strong>{{ .Token }}</strong></p>
     <p>oder <a href="{{ .ConfirmationURL }}">hier tippen zum Anmelden</a></p>
     ```
   - Der eingebaute Supabase-Mailversand ist auf wenige Mails pro Stunde begrenzt. Für eine ganze Mannschaft unter *Project Settings → Auth → SMTP* einen eigenen Mailserver eintragen (z. B. Brevo oder Resend, beide mit kostenlosem Kontingent).

## 3. Push-Benachrichtigungen

```bash
npm run vapid
```

Die ausgegebenen Schlüssel in `.env.local` eintragen: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`. Dazu `VAPID_SUBJECT=mailto:deine@adresse.de` und für `CRON_SECRET` einen langen Zufallswert, z. B. aus `openssl rand -hex 32`.

- **iPhone:** Push funktioniert erst ab iOS 16.4 und nur, wenn die App über *Teilen → Zum Home-Bildschirm* installiert und von dort geöffnet wurde.
- **Android und Desktop:** Push funktioniert direkt im Browser.

## 4. Veröffentlichen (Vercel)

1. Projekt in ein GitHub-Repo pushen und auf [vercel.com](https://vercel.com) importieren.
2. Alle Variablen aus `.env.local` unter *Settings → Environment Variables* eintragen. `NEXT_PUBLIC_SITE_URL` ist dabei die Vercel-Adresse.
3. Die tägliche Erinnerung läuft über `vercel.json`: jeden Tag um 15:00 UTC, also 17:00 Uhr im Sommer und 16:00 Uhr im Winter. Vercel schickt dabei automatisch das `CRON_SECRET` mit.
4. In Supabase die Site URL und Redirect URL auf die Vercel-Domain umstellen.

## 5. Erste Schritte in der App

1. Anmelden und **Neues Team** anlegen. Du bist dann automatisch Trainer.
2. Unter **Verwaltung** die festen Trainingszeiten anlegen. Die Termine erscheinen dann 9 Wochen im Voraus.
3. Den **Einladungslink** in die Mannschaftsgruppe schicken. Wer ihn öffnet, meldet sich an und gibt seinen Namen ein.
4. Spieler sagen unter **Termine** zu oder ab. Die Auswertung steht unter **Statistik**.

---

## Projektstruktur

```
app/
  actions.ts                  Server Actions (Antworten, Termine, Kader, Push)
  login/                      Login per Link oder 6-stelligem Code
  auth/callback/              Rücksprung aus dem E-Mail-Link
  join/[code]/                Einladungslink
  t/[teamId]/                 Termine (Zu-/Absage, Übersicht)
  t/[teamId]/statistik/       Anwesenheitsstatistik
  t/[teamId]/verwaltung/      Trainer-Bereich
  api/cron/reminders/         Tägliche Push-Erinnerung
components/                   TrainingCard, PushToggle, Formulare
lib/                          Supabase-Clients, Datumshilfen (Europe/Berlin), Push
supabase/migrations/          Datenbankschema mit Row Level Security
public/sw.js                  Service Worker für Push
```

## Datenmodell und Rechte

| Tabelle | Inhalt | Wer darf schreiben |
|---|---|---|
| `teams` | Name, Einladungscode | Trainer |
| `team_members` | Name, Rolle, aktiv, Beitrittsdatum | Trainer (Beitritt über `join_team`) |
| `training_series` | feste Wochentermine | Trainer |
| `trainings` | einzelne Termine, aus Serien erzeugt oder als Einzeltermin | Trainer |
| `responses` | Status, Grund, Kommentar pro Spieler und Training | jeder für sich selbst, Trainer für alle |
| `push_subscriptions` | Geräte für Push | jeder für sich selbst |

Alle Regeln sind als Row Level Security in der Datenbank hinterlegt. Mitglieder sehen nur ihr eigenes Team.

## Ideen für später

- Spiele und Turniere als eigener Termintyp, mit Aufstellung
- Antwortfrist, z. B. bis 24 Stunden vor dem Training
- Tatsächliche Anwesenheit durch den Trainer bestätigen lassen statt nur Zusagen zu zählen
- Export der Statistik als CSV
