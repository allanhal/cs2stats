const OPENID = "https://steamcommunity.com/openid/login";
const IDENTIFIER_SELECT = "http://specs.openid.net/auth/2.0/identifier_select";

export function signInUrl(origin: string): string {
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": `${origin}/api/auth/steam/callback`,
    "openid.realm": origin,
    "openid.identity": IDENTIFIER_SELECT,
    "openid.claimed_id": IDENTIFIER_SELECT,
  });
  return `${OPENID}?${params}`;
}

export async function verifySignIn(params: URLSearchParams): Promise<string | null> {
  const body = new URLSearchParams(params);
  body.set("openid.mode", "check_authentication");

  const response = await fetch(OPENID, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) return null;
  if (!/is_valid\s*:\s*true/.test(await response.text())) return null;

  const claimed = params.get("openid.claimed_id") ?? "";
  return /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/.exec(claimed)?.[1] ?? null;
}

export async function fetchPersona(
  steamId: string,
): Promise<{ persona: string; avatar: string }> {
  const key = process.env.STEAM_API_KEY;
  if (!key) return { persona: "", avatar: "" };

  try {
    const url = new URL("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/");
    url.searchParams.set("key", key);
    url.searchParams.set("steamids", steamId);
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return { persona: "", avatar: "" };
    const data = (await response.json()) as {
      response?: { players?: { personaname?: string; avatarmedium?: string }[] };
    };
    const player = data.response?.players?.[0];
    return { persona: player?.personaname ?? "", avatar: player?.avatarmedium ?? "" };
  } catch {
    return { persona: "", avatar: "" };
  }
}

export const AUTH_CODE = /^[A-Z0-9]{4}-[A-Z0-9]{5}-[A-Z0-9]{4}$/i;

export const SHARE_CODE = /^CSGO(-[ABCDEFGHJKLMNOPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789]{5}){5}$/;

const SHARE_CODE_ANYWHERE =
  /CSGO(-[ABCDEFGHJKLMNOPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789]{5}){5}/;

export function readShareCode(input: string): string | null {
  const text = input.trim();
  let decoded = text;
  try {
    decoded = decodeURIComponent(text);
  } catch {
  }
  return SHARE_CODE_ANYWHERE.exec(decoded)?.[0] ?? null;
}
