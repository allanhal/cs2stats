"use client";

import { useSyncExternalStore } from "react";
import { SERVER_TIME_ZONE, fullDateTime, humanDateTime } from "@/lib/format";

const subscribe = () => () => {};

export function LocalTime({ iso, className }: { iso: string; className?: string }) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const timeZone = hydrated ? undefined : SERVER_TIME_ZONE;

  return (
    <time
      dateTime={iso}
      title={fullDateTime(iso, timeZone)}
      className={className}
      suppressHydrationWarning
    >
      {humanDateTime(iso, timeZone)}
    </time>
  );
}
