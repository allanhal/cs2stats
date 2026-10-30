"use client";

import { useState } from "react";

export function ShareCard({ url, fileName }: { url: string; fileName: string }) {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");

  async function share() {
    setState("busy");
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("falhou");
      const file = new File([await response.blob()], fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        setState("idle");
        return;
      }
      window.open(url, "_blank", "noreferrer");
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      disabled={state === "busy"}
      className="rounded-md bg-win px-3.5 py-2 text-sm font-medium text-ink-950 transition-colors hover:bg-win/85 disabled:opacity-60"
    >
      {state === "busy" ? "Gerando…" : state === "error" ? "Tentar de novo" : "Compartilhar"}
    </button>
  );
}
