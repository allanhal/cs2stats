"use client";

import { useState } from "react";

export function CopyLine({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-3 flex items-stretch gap-2">
      <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-ink-700 bg-ink-850 px-3 py-2.5 font-mono text-xs text-fog-300">
        {text}
      </code>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-lg border border-ink-700 px-3 text-xs font-semibold text-fog-300 transition-colors hover:bg-ink-800 hover:text-fog-100"
      >
        {copied ? "copiado" : "copiar"}
      </button>
    </div>
  );
}
