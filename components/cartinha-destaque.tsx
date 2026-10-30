import type { HeroCard, HeroTone } from "@/lib/bosta";

export const HERO_WIDTH = 720;
export const HERO_HEIGHT = 1010;

const PALETTES: Record<HeroTone, Record<string, string>> = {
  pior: {
    dark: "#2a1d0c",
    mid: "#5a3d18",
    light: "#8a5f28",
    glow: "#c08a3c",
    text: "#f0dcb4",
    backdrop: "#160f06",
  },
  melhor: {
    dark: "#0d2416",
    mid: "#1c5033",
    light: "#2f7f52",
    glow: "#6fd79a",
    text: "#e4f7ea",
    backdrop: "#07160d",
  },
};

export function heroBackdrop(tone: HeroTone) {
  return PALETTES[tone].backdrop;
}

function Poop({ size, p }: { size: number; p: Record<string, string> }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: "flex" }}>
      <path
        d="M32 6c6 4 7 9 4 13 7 0 11 4 11 9 0 2-1 4-2 5 8 1 12 5 12 10 0 3-2 6-5 7 5 2 7 5 7 8 0 4-4 6-10 6H15c-6 0-10-2-10-6 0-3 2-6 7-8-3-1-5-4-5-7 0-5 4-9 12-10-1-1-2-3-2-5 0-5 4-9 11-9-3-4-2-9 4-13Z"
        fill={p.mid}
        stroke={p.light}
        strokeWidth="2"
      />
      <circle cx="24" cy="44" r="3.5" fill={p.dark} />
      <circle cx="40" cy="44" r="3.5" fill={p.dark} />
      <path d="M26 53c4 3 8 3 12 0" stroke={p.dark} strokeWidth="3" fill="none" />
    </svg>
  );
}

function Trophy({ size, p }: { size: number; p: Record<string, string> }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: "flex" }}>
      <path
        d="M18 8h28v14c0 9-6 16-14 16s-14-7-14-16V8Z"
        fill={p.mid}
        stroke={p.glow}
        strokeWidth="2.5"
      />
      <path d="M18 12H9v6c0 7 4 11 9 12" fill="none" stroke={p.light} strokeWidth="3" />
      <path d="M46 12h9v6c0 7-4 11-9 12" fill="none" stroke={p.light} strokeWidth="3" />
      <path d="M28 38h8v8h-8Z" fill={p.light} />
      <path d="M18 54c0-5 6-8 14-8s14 3 14 8Z" fill={p.mid} stroke={p.glow} strokeWidth="2.5" />
      <path d="M14 54h36v4H14Z" fill={p.light} />
    </svg>
  );
}

function Mark({ size, tone, p }: { size: number; tone: HeroTone; p: Record<string, string> }) {
  return tone === "pior" ? <Poop size={size} p={p} /> : <Trophy size={size} p={p} />;
}

function Stat({
  label,
  value,
  p,
}: {
  label: string;
  value: string;
  p: Record<string, string>;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        flexGrow: 1,
        flexBasis: 0,
      }}
    >
      <div style={{ display: "flex", fontSize: 36, color: p.text }}>{value}</div>
      <div style={{ display: "flex", fontSize: 15, letterSpacing: 1, color: p.glow }}>{label}</div>
    </div>
  );
}

export function CartinhaDestaque({ card, scale = 1 }: { card: HeroCard; scale?: number }) {
  const p = PALETTES[card.tone];
  const pior = card.tone === "pior";
  const titles = card.titles.slice(0, 4);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: HERO_WIDTH * scale,
        height: HERO_HEIGHT * scale,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: HERO_WIDTH,
          height: HERO_HEIGHT,
          padding: 44,
          borderRadius: 36,
          border: `6px solid ${p.light}`,
          backgroundImage: `linear-gradient(160deg, ${p.mid} 0%, ${p.dark} 55%, ${p.mid} 100%)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 26, letterSpacing: 6, color: p.glow }}>
              {pior ? "PIOR JOGADOR" : "MELHOR JOGADOR"}
            </div>
            <div style={{ display: "flex", fontSize: 18, letterSpacing: 4, color: p.light }}>
              {card.club.toUpperCase()}
            </div>
          </div>
          <Mark size={86} tone={card.tone} p={p} />
        </div>

        <div style={{ display: "flex", alignItems: "center", marginTop: 30 }}>
          {card.avatar ? (
            <img
              src={card.avatar}
              width={132}
              height={132}
              alt=""
              style={{ borderRadius: 66, border: `5px solid ${p.light}` }}
            />
          ) : null}
          <div
            style={{
              display: "flex",
              fontSize: card.name.length > 16 ? 40 : 54,
              color: p.text,
              marginLeft: card.avatar ? 26 : 0,
              lineHeight: 1.1,
            }}
          >
            {card.name}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 30,
            paddingTop: 22,
            paddingBottom: 22,
            borderRadius: 20,
            backgroundColor: "rgba(0,0,0,0.28)",
          }}
        >
          <Stat label="K/D" value={card.kd.toFixed(2)} p={p} />
          <Stat label="KAST" value={`${Math.round(card.kast * 100)}%`} p={p} />
          <Stat
            label={pior ? "MORTES" : "KILLS"}
            value={String(pior ? card.deaths : card.kills)}
            p={p}
          />
          <Stat label="APROV." value={`${Math.round(card.winRate * 100)}%`} p={p} />
          <Stat label="RATING" value={card.rating.toFixed(2)} p={p} />
        </div>

        <div style={{ display: "flex", marginTop: 30, fontSize: 22, letterSpacing: 4, color: p.glow }}>
          {pior ? "HALL DA VERGONHA" : "HALL DA FAMA"}
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 14 }}>
          {titles.length === 0 ? (
            <div style={{ display: "flex", fontSize: 26, color: p.light }}>
              {pior ? "Nenhum título, só o conjunto da obra." : "Nenhum título, só regularidade."}
            </div>
          ) : (
            titles.map((t) => (
              <div
                key={t.title}
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: 10,
                  padding: 13,
                  borderRadius: 16,
                  backgroundColor: "rgba(0,0,0,0.22)",
                }}
              >
                <Mark size={38} tone={card.tone} p={p} />
                <div style={{ display: "flex", flexDirection: "column", marginLeft: 16 }}>
                  <div style={{ display: "flex", fontSize: 28, color: p.text }}>{t.title}</div>
                  <div style={{ display: "flex", fontSize: 20, color: p.glow }}>{t.label}</div>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ display: "flex", flexGrow: 1 }} />

        <div
          style={{
            display: "flex",
            paddingTop: 18,
            borderTop: `2px solid ${p.light}`,
            fontSize: 20,
            color: p.light,
            lineHeight: 1.35,
          }}
        >
          {pior
            ? "Menor KAST, menos kills por round, maior estrago no lobby."
            : "Maior KAST, mais kills por round, maior ganho no lobby."}
        </div>
      </div>
    </div>
  );
}
