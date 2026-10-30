import type { ReactNode } from "react";
import type { CardEdition, CardFrame, CardTier, PlayerCard } from "@/lib/card";

export const CARD_WIDTH = 720;
export const CARD_HEIGHT = 1010;

const SHIELD_BOTTOM = "V782C696 872 556 962 360 1000C164 962 24 872 24 782";

const SHAPES: Record<CardFrame, string> = {
  classico: `M24 104L190 24L360 92L530 24L696 104${SHIELD_BOTTOM}Z`,
  podio: `M24 104L190 24L360 92L530 24L696 104${SHIELD_BOTTOM}Z`,
  tracejado: `M24 140L140 26H580L696 140${SHIELD_BOTTOM}Z`,
  duplo: `M96 24H624A72 72 0 0 1 696 96${SHIELD_BOTTOM}V96A72 72 0 0 1 96 24Z`,
};

export const BACKDROP = "#08090c";

const SHEEN_DARK =
  "linear-gradient(118deg, #7af7ff14 0%, #b48cff26 20%, #ff6fd81f 40%, #ffd86f26 62%, #7af7ff1f 82%, #b48cff14 100%)";
const SHEEN_LIGHT =
  "linear-gradient(118deg, #00b4d80f 0%, #7a4bff14 22%, #ff3fb30f 44%, #ffb30014 66%, #00b4d80f 100%)";

export interface Palette {
  accent: string;
  light: string;
  dark: string;
  fill: string;
  base: string;
  text: string;
  muted: string;
  veil: string;
  stripe: string;
  stripeAlt: string;
  portrait: string;
  mapTint: number;
  sheen: string;
  frame: CardFrame;
}

function darkPalette(accent: string, light: string, dark: string, fill: string): Palette {
  return {
    accent,
    light,
    dark,
    fill,
    base: BACKDROP,
    text: "#ffffff",
    muted: "#8b93a7",
    veil: "#06070aa6",
    stripe: "#ffffff0f",
    stripeAlt: "#00000026",
    portrait: "#0b0d12",
    mapTint: 1,
    sheen: SHEEN_DARK,
    frame: "classico",
  };
}

export const TIERS: Record<CardTier, Palette> = {
  lenda: darkPalette("#f7e7b0", "#fff6d8", "#b9933f", "#14151a"),
  ouro: darkPalette("#f0c75e", "#fbe9a8", "#a8802a", "#14130e"),
  prata: darkPalette("#cbd3dd", "#f2f5f9", "#78808d", "#111318"),
  bronze: darkPalette("#d79a62", "#f2c89c", "#8a5a2c", "#15110d"),
};

export const EDITIONS: Record<CardEdition, Palette & { label: string }> = {
  colorida: {
    accent: "#ffe9a8",
    light: "#ffffff",
    dark: "#9a7bd6",
    fill: "#131019",
    base: "#07070b",
    text: "#ffffff",
    muted: "#a7a0bd",
    veil: "#07060cb3",
    stripe: "#ffffff14",
    stripeAlt: "#00000033",
    portrait: "#0b0d12",
    mapTint: 0.8,
    sheen: SHEEN_DARK,
    frame: "podio",
    label: "1º",
  },
  ouro: {
    ...darkPalette("#ffd34d", "#fff2bb", "#9c7310", "#16130a"),
    frame: "podio",
    label: "2º",
  },
  mvp: {
    accent: "#9a7a1e",
    light: "#ffffff",
    dark: "#c7a543",
    fill: "#edeff4",
    base: "#f4f5f9",
    text: "#14151a",
    muted: "#5b6472",
    veil: "#ffffffb3",
    stripe: "#00000012",
    stripeAlt: "#00000026",
    portrait: "#ffffff",
    mapTint: 0.5,
    sheen: SHEEN_LIGHT,
    frame: "podio",
    label: "MVP",
  },
  semana: {
    accent: "#f0c75e",
    light: "#fff3c4",
    dark: "#6f5410",
    fill: "#08080a",
    base: "#050507",
    text: "#ffffff",
    muted: "#9aa3b2",
    veil: "#000000b3",
    stripe: "#ffffff0f",
    stripeAlt: "#00000033",
    portrait: "#0b0d12",
    mapTint: 0.75,
    sheen: SHEEN_DARK,
    frame: "tracejado",
    label: "SEMANA",
  },
  sete: {
    accent: "#6fe3f2",
    light: "#d9fbff",
    dark: "#1b6b7a",
    fill: "#070b0d",
    base: "#04070a",
    text: "#ffffff",
    muted: "#93a7ad",
    veil: "#000000b3",
    stripe: "#ffffff0f",
    stripeAlt: "#00000033",
    portrait: "#0b0d12",
    mapTint: 0.75,
    sheen: SHEEN_DARK,
    frame: "duplo",
    label: "7 DIAS",
  },
  dia: {
    accent: "#ff8a4c",
    light: "#ffd9bd",
    dark: "#8a3a10",
    fill: "#0d0806",
    base: "#080504",
    text: "#ffffff",
    muted: "#b09a90",
    veil: "#000000b3",
    stripe: "#ffffff0f",
    stripeAlt: "#00000033",
    portrait: "#0b0d12",
    mapTint: 0.75,
    sheen: SHEEN_DARK,
    frame: "tracejado",
    label: "24H",
  },
  prime: {
    accent: "#8ef7d2",
    light: "#eafff8",
    dark: "#1f6f78",
    fill: "#070d12",
    base: "#03070a",
    text: "#ffffff",
    muted: "#7f9bab",
    veil: "#02060ab3",
    stripe: "#ffffff14",
    stripeAlt: "#00000033",
    portrait: "#081014",
    mapTint: 0.85,
    sheen: SHEEN_DARK,
    frame: "duplo",
    label: "PRIME",
  },
  prata: {
    ...darkPalette("#dfe6ef", "#ffffff", "#767f8d", "#0f1217"),
    frame: "podio",
    label: "2º",
  },
  bronze: {
    ...darkPalette("#e2995a", "#f8c99c", "#8a4f1d", "#16100a"),
    frame: "podio",
    label: "3º",
  },
};

export function paletteOf(card: PlayerCard): Palette {
  return card.edition ? EDITIONS[card.edition] : TIERS[card.tier];
}

export const HOLO_FROM = 90;

const HOLO_STOPS = ["#7af7ff", "#b48cff", "#ff6fd8", "#ffd86f", "#7af7ff"];

export const isHolo = (card: PlayerCard) =>
  card.edition === "colorida" || card.edition === "prime" || card.overall >= HOLO_FROM;

export function scrimFor(base: string, stops = ["80 0%", "26 30%", "e0 56%", "f7 100%"]): string {
  return `linear-gradient(180deg, ${stops.map((stop) => `${base}${stop}`).join(", ")})`;
}

export function frameFor(card: PlayerCard): string {
  const palette = paletteOf(card);
  const shape = SHAPES[card.frame ?? palette.frame];
  const ring = (scale: number, width: number, opacity: number, dash = "", grad = "t") =>
    `<path d="${shape}" fill="none" stroke="url(#${grad})" stroke-width="${width}" stroke-opacity="${opacity}"${dash ? ` stroke-dasharray="${dash}"` : ""} transform="translate(360 505) scale(${scale}) translate(-360 -505)"/>`;
  const recipes: Record<CardFrame, string> = {
    classico: `${ring(1, 10, 1)}${ring(0.962, 2, 0.5)}`,
    podio: `${ring(1, 13, 1)}${ring(0.972, 3.5, 0.85)}${ring(0.936, 1.6, 0.45)}`,
    tracejado: `${ring(1, 11, 1)}${ring(0.952, 5, 0.9, "26 16")}${ring(0.9, 1.5, 0.4)}`,
    duplo: `${ring(1, 7, 1)}${ring(0.973, 7, 1)}${ring(0.928, 2.5, 0.55)}`,
  };
  const holoRing = isHolo(card) ? ring(0.988, 4.5, 0.95, "", "h") : "";
  const holoGradient = isHolo(card)
    ? `<linearGradient id="h" x1="0" y1="0" x2="1" y2="1">${HOLO_STOPS.map(
        (color, index) =>
          `<stop offset="${index / (HOLO_STOPS.length - 1)}" stop-color="${color}"/>`,
      ).join("")}</linearGradient>`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}"><defs><linearGradient id="t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.light}"/><stop offset="0.45" stop-color="${palette.dark}"/><stop offset="1" stop-color="${palette.light}"/></linearGradient>${holoGradient}</defs><path fill="${BACKDROP}" fill-rule="evenodd" d="M0 0h${CARD_WIDTH}v${CARD_HEIGHT}H0Z ${shape}"/>${recipes[card.frame ?? palette.frame]}${holoRing}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function shortName(name: string): string {
  const clean = name.trim();
  const first = clean.split(/[\s_|.-]+/).filter(Boolean)[0] ?? clean;
  const picked = clean.length > 14 ? first : clean;
  return picked.length > 13 ? `${picked.slice(0, 12)}…` : picked;
}

export function nameSize(name: string): number {
  if (name.length <= 8) return 78;
  if (name.length <= 11) return 66;
  return 54;
}

export function CardShell({
  card,
  scale = 1,
  mapOpacity = 0.46,
  scrim,
  children,
}: {
  card: PlayerCard;
  scale?: number;
  mapOpacity?: number;
  scrim?: string;
  children: ReactNode;
}) {
  const palette = paletteOf(card);
  const medal = card.badge ? { ...palette, label: card.badge } : null;

  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: CARD_WIDTH * scale,
        height: CARD_HEIGHT * scale,
        backgroundColor: BACKDROP,
      }}
    >
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 0,
          left: 0,
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          fontFamily: "Anton, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            backgroundColor: palette.fill,
          }}
        />
        {card.mapImage ? (
          <img
            src={card.mapImage}
            width={CARD_WIDTH}
            height={CARD_HEIGHT}
            alt=""
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              objectFit: "cover",
              opacity: mapOpacity * palette.mapTint,
            }}
          />
        ) : null}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            background: scrim ?? scrimFor(palette.base),
          }}
        />
        {isHolo(card) ? (
          <div
            style={{
              display: "flex",
              position: "absolute",
              top: 0,
              left: 0,
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              background: palette.sheen,
            }}
          />
        ) : null}
        {children}
        <img
          src={frameFor(card)}
          width={CARD_WIDTH}
          height={CARD_HEIGHT}
          alt=""
          style={{ position: "absolute", top: 0, left: 0, width: CARD_WIDTH, height: CARD_HEIGHT }}
        />
        {medal ? (
          <div
            style={{
              display: "flex",
              position: "absolute",
              top: 46,
              left: 0,
              width: CARD_WIDTH,
              justifyContent: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                height: 74,
                paddingLeft: 28,
                paddingRight: 28,
                borderRadius: 37,
                border: `4px solid ${medal.light}`,
                backgroundColor: medal.accent,
                fontSize: 34,
                letterSpacing: 2,
                color: medal.fill,
              }}
            >
              {medal.label}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Portrait({
  card,
  size,
  accent,
  round = true,
}: {
  card: PlayerCard;
  size: number;
  accent: string;
  round?: boolean;
}) {
  const palette = paletteOf(card);

  return (
    <div
      style={{
        display: "flex",
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: round ? size / 2 : 16,
        border: `4px solid ${accent}`,
        backgroundColor: palette.portrait,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {card.avatar ? (
        <img
          src={card.avatar}
          alt=""
          style={{ display: "flex", width: size, height: size, objectFit: "cover" }}
        />
      ) : (
        <div style={{ display: "flex", fontSize: size * 0.4, color: accent }}>
          {shortName(card.name).toUpperCase().slice(0, 2)}
        </div>
      )}
    </div>
  );
}

export function Footline({ card, top }: { card: PlayerCard; top: number }) {
  const palette = paletteOf(card);

  return (
    <div
      style={{
        display: "flex",
        position: "absolute",
        top,
        left: 0,
        width: CARD_WIDTH,
        justifyContent: "center",
        fontSize: 25,
        color: palette.muted,
      }}
    >
      {card.matches} partida{card.matches === 1 ? "" : "s"} · K/D {card.kd.toFixed(2)} · ADR{" "}
      {card.adr.toFixed(0)}
    </div>
  );
}

function StatRow({
  value,
  label,
  accent,
  text,
}: {
  value: number;
  label: string;
  accent: string;
  text: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", height: 62 }}>
      <div
        style={{
          display: "flex",
          width: 104,
          justifyContent: "flex-end",
          fontSize: 50,
          color: text,
        }}
      >
        {value}
      </div>
      <div style={{ display: "flex", marginLeft: 18, fontSize: 44, color: accent }}>{label}</div>
    </div>
  );
}

export function FifaCard({ card, scale = 1 }: { card: PlayerCard; scale?: number }) {
  const tier = paletteOf(card);
  const name = shortName(card.name).toUpperCase();
  const left = card.stats.filter((_, i) => i % 2 === 0);
  const right = card.stats.filter((_, i) => i % 2 === 1);

  return (
    <CardShell card={card} scale={scale}>
      <div style={{ display: "flex", position: "absolute", top: 164, left: 392 }}>
        <Portrait card={card} size={236} accent={tier.accent} round={false} />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "absolute",
          top: 132,
          left: 68,
        }}
      >
        <div style={{ display: "flex", fontSize: 112, lineHeight: 1, color: tier.accent }}>
          {card.overall}
        </div>
        <div style={{ display: "flex", marginTop: 4, fontSize: 48, lineHeight: 1, color: tier.accent }}>
          {card.role}
        </div>
        <div
          style={{
            display: "flex",
            width: 92,
            height: 3,
            marginTop: 22,
            marginBottom: 18,
            backgroundColor: tier.accent,
            opacity: 0.55,
          }}
        />
        <div style={{ display: "flex", fontSize: 30, color: tier.text }}>{card.mapName}</div>
        <div
          style={{
            display: "flex",
            width: 92,
            height: 3,
            marginTop: 18,
            marginBottom: 18,
            backgroundColor: tier.accent,
            opacity: 0.55,
          }}
        />
        <div style={{ display: "flex", fontSize: 26, color: tier.muted }}>
          {card.club.toUpperCase()}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 572,
          left: 60,
          width: CARD_WIDTH - 120,
          height: 96,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          fontSize: nameSize(name),
          color: tier.accent,
        }}
      >
        {name}
      </div>

      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 684,
          left: 110,
          width: CARD_WIDTH - 220,
          height: 2,
          backgroundColor: tier.accent,
          opacity: 0.45,
        }}
      />

      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 706,
          left: 86,
          width: CARD_WIDTH - 172,
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          {left.map((stat) => (
            <StatRow
              key={stat.key}
              value={stat.value}
              label={stat.key}
              accent={tier.accent}
              text={tier.text}
            />
          ))}
        </div>
        <div
          style={{
            display: "flex",
            width: 2,
            height: 172,
            marginTop: 8,
            backgroundColor: tier.accent,
            opacity: 0.4,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column" }}>
          {right.map((stat) => (
            <StatRow
              key={stat.key}
              value={stat.value}
              label={stat.key}
              accent={tier.accent}
              text={tier.text}
            />
          ))}
        </div>
      </div>

      <Footline card={card} top={906} />
    </CardShell>
  );
}
