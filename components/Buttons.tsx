"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";

/** Erst-Klick fragt nach, zweiter Klick schickt das Formular ab. */
export function ConfirmButton({ children, confirmLabel, className }: { children: React.ReactNode; confirmLabel: string; className?: string }) {
  const [armed, setArmed] = useState(false);
  const { pending } = useFormStatus();
  return (
    <button
      className={className}
      type={armed ? "submit" : "button"}
      disabled={pending}
      onClick={(e) => {
        if (!armed) {
          e.preventDefault();
          setArmed(true);
          setTimeout(() => setArmed(false), 4000);
        }
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn small"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          (document.getElementById("join-url") as HTMLInputElement | null)?.select();
        }
      }}
    >
      {done ? "Kopiert" : "Kopieren"}
    </button>
  );
}
