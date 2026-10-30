"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, SectionTitle } from "@/components/ui";

export function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (response.ok) router.refresh();
    else setError("Senha incorreta");
  }

  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <SectionTitle title="Admin" hint="Entre para apagar partidas e configurar o time" />
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="senha"
            autoFocus
            className="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm outline-none placeholder:text-fog-500 focus:border-win/60"
          />
          {error ? <p className="text-xs text-loss">{error}</p> : null}
          <button
            type="submit"
            disabled={busy || password.length === 0}
            className="w-full rounded-lg bg-win px-3.5 py-2 text-sm font-semibold text-ink-950 transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </Card>
    </div>
  );
}
