export const CANONICAL_SITE = "https://cs2.allanpinheiro.com";

const siteFlag = (origin: string, flag: string) =>
  origin === CANONICAL_SITE ? "" : ` ${flag} "${origin}"`;

export const windowsCommand = (origin: string) =>
  `irm ${origin}/cs2stats.ps1 -OutFile "$env:TEMP\\cs2stats.ps1"; powershell -ExecutionPolicy Bypass -File "$env:TEMP\\cs2stats.ps1"${siteFlag(origin, "-Site")}`;

export const macCommand = (origin: string) =>
  `curl -fsSL ${origin}/cs2stats.sh -o "$TMPDIR/cs2stats.sh"; bash "$TMPDIR/cs2stats.sh"${siteFlag(origin, "--site")}`;
