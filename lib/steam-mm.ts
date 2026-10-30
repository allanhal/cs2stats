import SteamUser from "steam-user";
import GlobalOffensive from "globaloffensive";
import SteamTotp from "steam-totp";

const CHAIN_URL =
  "https://api.steampowered.com/ICSGOPlayers_730/GetNextMatchSharingCode/v1";

export interface BotCredentials {
  username: string;
  password: string;
  sharedSecret?: string;
}

export class SteamChainError extends Error {}

export async function nextShareCode(
  steamApiKey: string,
  steamId: string,
  authCode: string,
  knownCode: string,
): Promise<string | null> {
  const url = `${CHAIN_URL}?key=${encodeURIComponent(steamApiKey)}&steamid=${encodeURIComponent(
    steamId,
  )}&steamidkey=${encodeURIComponent(authCode)}&knowncode=${encodeURIComponent(knownCode)}`;

  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (response.status === 202) return null;
  if (response.status === 412) {
    throw new SteamChainError(
      "a Steam recusou a combinacao steamid + auth code + sharecode (HTTP 412)",
    );
  }
  if (response.status === 403) {
    throw new SteamChainError("a STEAM_API_KEY foi recusada (HTTP 403)");
  }
  if (!response.ok) {
    throw new SteamChainError(`GetNextMatchSharingCode respondeu ${response.status}`);
  }

  const body = (await response.json()) as { result?: { nextcode?: string } };
  const code = body.result?.nextcode;
  if (!code || code === "n/a") return null;
  return code;
}

export async function collectShareCodes(
  steamApiKey: string,
  steamId: string,
  authCode: string,
  fromCode: string,
  max: number,
): Promise<string[]> {
  const found: string[] = [];
  let cursor = fromCode;
  while (found.length < max) {
    const next = await nextShareCode(steamApiKey, steamId, authCode, cursor);
    if (!next) break;
    found.push(next);
    cursor = next;
  }
  return found;
}

export class MatchmakingSession {
  private user: InstanceType<typeof SteamUser>;
  private cs: InstanceType<typeof GlobalOffensive>;
  private ready = false;

  constructor() {
    this.user = new SteamUser();
    this.cs = new GlobalOffensive(this.user);
  }

  connect(credentials: BotCredentials, timeoutMs = 90_000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("o Game Coordinator nao respondeu a tempo")),
        timeoutMs,
      );

      this.user.on("error", (error: Error) => {
        clearTimeout(timer);
        reject(error);
      });

      this.user.on("loggedOn", () => {
        this.user.gamesPlayed([730], true);
      });

      this.cs.on("connectedToGC", () => {
        clearTimeout(timer);
        this.ready = true;
        resolve();
      });

      this.user.logOn({
        accountName: credentials.username,
        password: credentials.password,
        twoFactorCode: credentials.sharedSecret
          ? SteamTotp.generateAuthCode(credentials.sharedSecret)
          : undefined,
      });
    });
  }

  demoUrlFor(shareCode: string, timeoutMs = 45_000): Promise<string | null> {
    if (!this.ready) throw new Error("sessao do Game Coordinator nao esta pronta");

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.cs.removeListener("matchList", onList);
        reject(new Error("o Game Coordinator nao respondeu a tempo"));
      }, timeoutMs);

      const onList = (matches: unknown[]) => {
        clearTimeout(timer);
        this.cs.removeListener("matchList", onList);
        resolve(demoUrlFromMatches(matches));
      };

      this.cs.on("matchList", onList);
      try {
        this.cs.requestGame(shareCode);
      } catch (error) {
        clearTimeout(timer);
        this.cs.removeListener("matchList", onList);
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.ready = false;
    this.user.logOff();
  }
}

function demoUrlFromMatches(matches: unknown[]): string | null {
  const match = matches?.[0] as { roundstatsall?: { map?: string }[] } | undefined;
  const rounds = match?.roundstatsall;
  if (!rounds || rounds.length === 0) return null;
  const last = rounds[rounds.length - 1];
  const url = last?.map;
  if (typeof url !== "string" || !url.startsWith("http")) return null;
  return url;
}
