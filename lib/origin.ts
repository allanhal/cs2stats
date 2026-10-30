import { CANONICAL_SITE } from "@/lib/site";

const first = (value: string | null): string | null =>
  value ? (value.split(",")[0] ?? "").trim() || null : null;

const isLocal = (host: string) => /^(localhost|127\.|\[::1\]|0\.0\.0\.0)/.test(host);

export function publicOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = first(request.headers.get("x-forwarded-host")) ?? first(request.headers.get("host"));
  if (!host) return url.origin;
  const proto = first(request.headers.get("x-forwarded-proto")) ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export function originFromHeaders(headers: Headers): string {
  const host = first(headers.get("x-forwarded-host")) ?? first(headers.get("host"));
  if (!host) return CANONICAL_SITE;
  const proto = first(headers.get("x-forwarded-proto")) ?? (isLocal(host) ? "http" : "https");
  return `${proto}://${host}`;
}
