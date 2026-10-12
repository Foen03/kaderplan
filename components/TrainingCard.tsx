"use client";
import { useEffect, useState, useTransition } from "react";
import { cancelTraining, setResponse, uncancelTraining } from "@/app/actions";
import { hm, parts } from "@/lib/dates";
import { REASONS, type Response, type Status, type Training } from "@/lib/types";

type Player = { id: string; name: string };
const LABEL: Record<Status | "none", string> = { yes: "Zusagen", maybe: "Unsicher", no: "Absagen", none: "Noch keine Antwort" };

export function TrainingCard(props: {
  teamId: string;
  training: Training;
  today: string;
  players: Player[];
  responses: Response[];
  meId: string;
  isCoach: boolean;
}) {
  const { teamId, training: t, today, players, meId, isCoach } = props;
  const [responses, setResponses] = useState(props.responses);
  useEffect(() => setResponses(props.responses), [props.responses]);
  const mine = responses.find((r) => r.user_id === meId);
  const [comment, setComment] = useState(mine?.comment ?? "");
  useEffect(() => setComment(mine?.comment ?? ""), [mine?.comment]);
  const [open, setOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const p = parts(t.date);
  const isMember = players.some((pl) => pl.id === meId);

  const counts = { yes: 0, no: 0, maybe: 0, none: 0 };
  for (const pl of players) {
    const r = responses.find((x) => x.user_id === pl.id);
    counts[r ? r.status : "none"]++;
  }
  const total = Math.max(players.length, 1);

  function save(userId: string, patch: Partial<Pick<Response, "status" | "reason" | "comment">>) {
    const cur = responses.find((r) => r.user_id === userId);
    const next: Response = {
      training_id: t.id,
      user_id: userId,
      status: patch.status ?? cur?.status ?? "maybe",
      reason: patch.reason !== undefined ? patch.reason : cur?.reason ?? null,
      comment: patch.comment !== undefined ? patch.comment : cur?.comment ?? null,
      updated_at: new Date().toISOString(),
    };
    if (next.status === "yes") next.reason = null;
    const before = responses;
    setResponses([...responses.filter((r) => r.user_id !== userId), next]);
    setErr(null);
    start(async () => {
      const res = await setResponse({
        teamId,
        trainingId: t.id,
        userId: userId === meId ? undefined : userId,
        status: next.status,
        reason: next.reason,
        comment: next.comment,
      });
      if (res.error) {
        setResponses(before);
        setErr(res.error);
      }
    });
  }

  const commentDirty = comment.trim() !== (mine?.comment ?? "");

  return (
    <article className={`card ev${t.cancelled ? " cancelled" : ""}`}>
      <div className="date">
        <span className="wd">{p.wd}</span>
        <span className="d">{p.day}</span>
        <span className="m">{p.mon}</span>
      </div>
      <div className="ev-body">
        <div className="ev-head">
          <div style={{ minWidth: 0 }}>
            <div className="ev-title">
              {t.title}
              {t.date === today && <span className="tag today">Heute</span>}
              {!t.series_id && <span className="tag ex">Einzeltermin</span>}
              {t.cancelled && <span className="tag cx">Abgesagt</span>}
            </div>
            <div className="ev-meta">
              {hm(t.start_time)}
              {t.end_time ? `–${hm(t.end_time)}` : ""}
              {t.start_time ? " Uhr" : ""}
              {t.location ? ` · ${t.location}` : ""}
            </div>
            {t.cancelled && t.cancel_reason && <div className="ev-meta">Grund: {t.cancel_reason}</div>}
          </div>
          {isCoach &&
            (t.cancelled ? (
              <button className="btn small" disabled={pending} onClick={() => start(() => uncancelTraining(teamId, t.id))}>
                Wieder ansetzen
              </button>
            ) : (
              !cancelling && (
                <button className="btn small" onClick={() => setCancelling(true)}>
                  Training absagen
                </button>
              )
            ))}
        </div>

        {cancelling && !t.cancelled && (
          <form
            className="cmt"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await cancelTraining(teamId, t.id, cancelReason);
                if (r?.error) setErr(r.error);
                setCancelling(false);
              });
            }}
          >
            <input id={`cx-${t.id}`} type="text" placeholder="Grund (z. B. Halle belegt)" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} autoFocus />
            <button className="btn small primary" disabled={pending}>Absagen</button>
            <button type="button" className="btn small" onClick={() => setCancelling(false)}>Abbrechen</button>
          </form>
        )}

        {!t.cancelled && (
          <>
            <div className="tally">
              <span><i className="dot yes" />{counts.yes} Zusagen</span>
              <span><i className="dot no" />{counts.no} Absagen</span>
              <span><i className="dot maybe" />{counts.maybe} Unsicher</span>
              <span><i className="dot none" />{counts.none} offen</span>
            </div>
            <div className="bar" aria-hidden="true">
              <i className="yes" style={{ width: `${(counts.yes / total) * 100}%` }} />
              <i className="maybe" style={{ width: `${(counts.maybe / total) * 100}%` }} />
              <i className="no" style={{ width: `${(counts.no / total) * 100}%` }} />
            </div>

            {isMember && (
              <>
                <div className="choice" role="group" aria-label="Deine Antwort">
                  {(["yes", "maybe", "no"] as Status[]).map((s) => (
                    <button
                      key={s}
                      data-s={s}
                      aria-pressed={mine?.status === s}
                      onClick={() => save(meId, { status: s, comment: comment.trim() || null })}
                    >
                      {s === "yes" ? "Zusage" : s === "no" ? "Absage" : "Unsicher"}
                    </button>
                  ))}
                </div>
                {(mine?.status === "no" || mine?.status === "maybe") && (
                  <div className="reasons" aria-label="Grund">
                    {REASONS.map((r) => (
                      <button key={r} className="chip" aria-pressed={mine.reason === r} onClick={() => save(meId, { reason: mine.reason === r ? null : r })}>
                        {r}
                      </button>
                    ))}
                  </div>
                )}
                <div className="cmt">
                  <textarea
                    id={`c-${t.id}`}
                    rows={1}
                    maxLength={300}
                    placeholder="Kommentar (z. B. komme 15 Min später)"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                  <button className={`btn small${commentDirty ? " primary" : ""}`} disabled={!commentDirty || pending} onClick={() => save(meId, { comment: comment.trim() || null })}>
                    Speichern
                  </button>
                </div>
              </>
            )}
            {err && <p className="error">{err}</p>}

            <div>
              <button className="btn link small" onClick={() => setOpen(!open)}>
                {open ? "Übersicht schließen" : "Wer kommt? Übersicht"}
              </button>
            </div>
            {open && <WhoList players={players} responses={responses} isCoach={isCoach} onSet={(uid, s) => save(uid, { status: s })} />}
          </>
        )}
      </div>
    </article>
  );
}

function WhoList({
  players,
  responses,
  isCoach,
  onSet,
}: {
  players: Player[];
  responses: Response[];
  isCoach: boolean;
  onSet: (userId: string, s: Status) => void;
}) {
  const groups: Record<Status | "none", { p: Player; r?: Response }[]> = { yes: [], maybe: [], no: [], none: [] };
  for (const p of players) {
    const r = responses.find((x) => x.user_id === p.id);
    groups[r ? r.status : "none"].push({ p, r });
  }
  return (
    <div className="who">
      {(Object.keys(groups) as (Status | "none")[])
        .filter((k) => groups[k].length)
        .map((k) => (
          <div key={k}>
            <h4>
              <i className={`dot ${k}`} />
              {LABEL[k]} ({groups[k].length})
            </h4>
            <ul>
              {groups[k].map(({ p, r }) => (
                <li key={p.id}>
                  {p.name}
                  {r?.reason && <span className="rs">{r.reason}</span>}
                  {r?.comment && <span className="c"> – {r.comment}</span>}
                  {isCoach && (
                    <select
                      aria-label={`Antwort für ${p.name} setzen`}
                      value={r?.status ?? ""}
                      onChange={(e) => e.target.value && onSet(p.id, e.target.value as Status)}
                      style={{ marginLeft: 8, padding: "1px 4px", fontSize: 12 }}
                    >
                      <option value="">–</option>
                      <option value="yes">Zu</option>
                      <option value="maybe">?</option>
                      <option value="no">Ab</option>
                    </select>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
    </div>
  );
}
