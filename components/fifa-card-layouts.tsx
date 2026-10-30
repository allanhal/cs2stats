import type { PlayerCard } from "@/lib/card";
import {
  CARD_WIDTH,
  CardShell,
  Footline,
  Portrait,
  nameSize,
  paletteOf,
  shortName,
} from "@/components/fifa-card";

const TIER_WORD: Record<string, string> = {
  lenda: "LENDA",
  ouro: "OURO",
  prata: "PRATA",
  bronze: "BRONZE",
};

function Pair({
  value,
  label,
  accent,
  text,
  size = 50,
}: {
  value: number;
  label: string;
  accent: string;
  text: string;
  size?: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", height: size + 14 }}>
      <div
        style={{
          display: "flex",
          width: size * 2,
          justifyContent: "flex-end",
          fontSize: size,
          color: text,
        }}
      >
        {value}
      </div>
      <div style={{ display: "flex", marginLeft: 16, fontSize: size - 8, color: accent }}>
        {label}
      </div>
    </div>
  );
}

function Stack({
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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 96 }}>
      <div style={{ display: "flex", fontSize: 50, color: text }}>{value}</div>
      <div style={{ display: "flex", marginTop: 2, fontSize: 28, color: accent }}>{label}</div>
    </div>
  );
}

function Centered({
  top,
  children,
  fontSize,
  color,
  letterSpacing = 0,
}: {
  top: number;
  children: React.ReactNode;
  fontSize: number;
  color: string;
  letterSpacing?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        position: "absolute",
        top,
        left: 40,
        width: CARD_WIDTH - 80,
        justifyContent: "center",
        overflow: "hidden",
        fontSize,
        letterSpacing,
        color,
      }}
    >
      {children}
    </div>
  );
}

export function CardMedalhao({ card, scale = 1 }: { card: PlayerCard; scale?: number }) {
  const tier = paletteOf(card);
  const name = shortName(card.name).toUpperCase();
  const left = card.stats.filter((_, i) => i % 2 === 0);
  const right = card.stats.filter((_, i) => i % 2 === 1);
  const chip = (label: string) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: 46,
        paddingLeft: 20,
        paddingRight: 20,
        borderRadius: 23,
        border: `2px solid ${tier.accent}66`,
        fontSize: 24,
        color: tier.text,
      }}
    >
      {label}
    </div>
  );

  return (
    <CardShell
      card={card}
      scale={scale}
      mapOpacity={0.5}
      scrim={`linear-gradient(160deg, ${tier.base}55 0%, ${tier.base}1a 28%, ${tier.base}d9 52%, ${tier.base}fa 100%)`}
    >
      <div
        style={{ display: "flex", flexDirection: "column", position: "absolute", top: 126, left: 66 }}
      >
        <div style={{ display: "flex", fontSize: 124, lineHeight: 1, color: tier.accent }}>
          {card.overall}
        </div>
        <div style={{ display: "flex", fontSize: 52, lineHeight: 1, color: tier.accent }}>
          {card.role}
        </div>
        <div
          style={{
            display: "flex",
            width: 108,
            height: 4,
            marginTop: 16,
            backgroundColor: tier.accent,
            opacity: 0.7,
          }}
        />
        <div
          style={{ display: "flex", marginTop: 14, fontSize: 24, letterSpacing: 3, color: tier.muted }}
        >
          {TIER_WORD[card.tier]}
        </div>
      </div>

      <div style={{ display: "flex", position: "absolute", top: 132, left: 372 }}>
        <Portrait card={card} size={268} accent={tier.accent} />
      </div>

      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 436,
          left: 60,
          width: CARD_WIDTH - 120,
          justifyContent: "center",
          gap: 14,
        }}
      >
        {chip(card.mapName.toUpperCase())}
        {chip(card.club.toUpperCase())}
      </div>

      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 520,
          left: 48,
          width: CARD_WIDTH - 96,
          height: 108,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          borderTop: `3px solid ${tier.accent}`,
          borderBottom: `3px solid ${tier.accent}`,
          backgroundColor: tier.veil,
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
          top: 666,
          left: 80,
          width: CARD_WIDTH - 160,
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          {left.map((stat) => (
            <Pair key={stat.key} value={stat.value} label={stat.key} accent={tier.accent} text={tier.text} />
          ))}
        </div>
        <div
          style={{
            display: "flex",
            width: 3,
            height: 176,
            marginTop: 8,
            backgroundColor: tier.accent,
            opacity: 0.35,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column" }}>
          {right.map((stat) => (
            <Pair key={stat.key} value={stat.value} label={stat.key} accent={tier.accent} text={tier.text} />
          ))}
        </div>
      </div>

      <Footline card={card} top={892} />
    </CardShell>
  );
}

export function CardBarras({ card, scale = 1 }: { card: PlayerCard; scale?: number }) {
  const tier = paletteOf(card);
  const name = shortName(card.name).toUpperCase();

  return (
    <CardShell
      card={card}
      scale={scale}
      mapOpacity={0.55}
      scrim={`linear-gradient(180deg, ${tier.base}26 0%, ${tier.base}cc 34%, ${tier.base}fa 70%)`}
    >
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 120,
          left: 70,
          width: CARD_WIDTH - 140,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Portrait card={card} size={158} accent={tier.accent} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div style={{ display: "flex", fontSize: 116, lineHeight: 1, color: tier.accent }}>
            {card.overall}
          </div>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 3, color: tier.muted }}>
            OVERALL
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 292,
          left: 50,
          width: CARD_WIDTH - 100,
          height: 86,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          fontSize: nameSize(name),
          color: tier.accent,
        }}
      >
        {name}
      </div>

      <Centered top={382} fontSize={28} letterSpacing={2} color="#aab3c2">
        {card.role} · {card.mapName.toUpperCase()}
      </Centered>

      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 440,
          left: 70,
          width: CARD_WIDTH - 140,
          height: 3,
          backgroundColor: tier.accent,
          opacity: 0.5,
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "absolute",
          top: 462,
          left: 86,
          width: CARD_WIDTH - 172,
        }}
      >
        {card.stats.map((stat) => (
          <div key={stat.key} style={{ display: "flex", alignItems: "center", height: 62 }}>
            <div style={{ display: "flex", width: 104, fontSize: 40, color: tier.accent }}>
              {stat.key}
            </div>
            <div
              style={{
                display: "flex",
                width: 332,
                height: 22,
                borderRadius: 11,
                backgroundColor: tier.stripe,
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: (332 * stat.value) / 99,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: tier.accent,
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                width: 92,
                justifyContent: "flex-end",
                fontSize: 48,
                color: tier.text,
              }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <Centered top={858} fontSize={28} color="#e7ebf2">
        {card.club.toUpperCase()}
      </Centered>
      <Footline card={card} top={902} />
    </CardShell>
  );
}

function radarChart(values: number[], accent: string): string {
  const size = 420;
  const center = size / 2;
  const radius = 158;
  const at = (index: number, ratio: number) => {
    const angle = (Math.PI * 2 * index) / values.length - Math.PI / 2;
    return [center + Math.cos(angle) * radius * ratio, center + Math.sin(angle) * radius * ratio];
  };
  const points = (ratio: number, source?: number[]) =>
    values
      .map((value, index) => at(index, (source ? source[index] / 99 : ratio)).map((n) => n.toFixed(1)).join(","))
      .join(" ");
  const rings = [1, 0.66, 0.33]
    .map(
      (ratio) =>
        `<polygon points="${points(ratio)}" fill="none" stroke="${accent}" stroke-opacity="0.35" stroke-width="2"/>`,
    )
    .join("");
  const spokes = values
    .map((_, index) => {
      const [x, y] = at(index, 1);
      return `<line x1="${center}" y1="${center}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${accent}" stroke-opacity="0.3" stroke-width="2"/>`;
    })
    .join("");
  const shape = `<polygon points="${points(0, values)}" fill="${accent}" fill-opacity="0.32" stroke="${accent}" stroke-width="5"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${rings}${spokes}${shape}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function CardRadar({ card, scale = 1 }: { card: PlayerCard; scale?: number }) {
  const tier = paletteOf(card);
  const name = shortName(card.name).toUpperCase();
  const size = 420;
  const center = size / 2;
  const labelAt = (index: number) => {
    const angle = (Math.PI * 2 * index) / card.stats.length - Math.PI / 2;
    return {
      left: center + Math.cos(angle) * 186 - 52,
      top: center + Math.sin(angle) * 186 - 24,
    };
  };

  return (
    <CardShell card={card} scale={scale} mapOpacity={0.4}>
      <div
        style={{ display: "flex", flexDirection: "column", position: "absolute", top: 128, left: 68 }}
      >
        <div style={{ display: "flex", fontSize: 104, lineHeight: 1, color: tier.accent }}>
          {card.overall}
        </div>
        <div style={{ display: "flex", fontSize: 44, lineHeight: 1, color: tier.accent }}>
          {card.role}
        </div>
      </div>

      <div style={{ display: "flex", position: "absolute", top: 126, left: 506 }}>
        <Portrait card={card} size={146} accent={tier.accent} />
      </div>

      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 300,
          left: 150,
          width: size,
          height: size,
        }}
      >
        <img
          src={radarChart(
            card.stats.map((stat) => stat.value),
            tier.accent,
          )}
          width={size}
          height={size}
          alt=""
          style={{ position: "absolute", top: 0, left: 0, width: size, height: size }}
        />
        {card.stats.map((stat, index) => {
          const spot = labelAt(index);
          return (
            <div
              key={stat.key}
              style={{
                display: "flex",
                flexDirection: "column",
                position: "absolute",
                left: spot.left,
                top: spot.top,
                width: 104,
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", fontSize: 30, color: tier.text }}>{stat.value}</div>
              <div style={{ display: "flex", fontSize: 24, color: tier.accent }}>{stat.key}</div>
            </div>
          );
        })}
      </div>

      <Centered top={740} fontSize={nameSize(name)} color={tier.accent}>
        {name}
      </Centered>
      <Centered top={850} fontSize={26} letterSpacing={2} color="#aab3c2">
        {card.mapName.toUpperCase()} · {card.club.toUpperCase()}
      </Centered>
      <Footline card={card} top={896} />
    </CardShell>
  );
}

export function CardFaixaLateral({ card, scale = 1 }: { card: PlayerCard; scale?: number }) {
  const tier = paletteOf(card);
  const name = shortName(card.name).toUpperCase();

  return (
    <CardShell card={card} scale={scale} mapOpacity={0.42}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "absolute",
          top: 128,
          left: 54,
          width: 166,
          height: 560,
          alignItems: "center",
          justifyContent: "center",
          borderRight: `3px solid ${tier.accent}`,
          backgroundColor: `${tier.accent}14`,
        }}
      >
        <div style={{ display: "flex", fontSize: 104, lineHeight: 1, color: tier.accent }}>
          {card.overall}
        </div>
        <div style={{ display: "flex", marginTop: 10, fontSize: 46, color: tier.accent }}>
          {card.role}
        </div>
        <div
          style={{ display: "flex", marginTop: 18, fontSize: 22, letterSpacing: 3, color: tier.muted }}
        >
          {TIER_WORD[card.tier]}
        </div>
      </div>

      <div style={{ display: "flex", position: "absolute", top: 142, left: 430 }}>
        <Portrait card={card} size={190} accent={tier.accent} round={false} />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "absolute",
          top: 388,
          left: 252,
          width: 406,
        }}
      >
        <div style={{ display: "flex", fontSize: 58, color: tier.accent, overflow: "hidden" }}>
          {name}
        </div>
        <div style={{ display: "flex", marginTop: 6, fontSize: 26, color: tier.muted }}>
          {card.mapName.toUpperCase()} · {card.club.toUpperCase()}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "absolute",
          top: 522,
          left: 252,
        }}
      >
        {card.stats.map((stat) => (
          <Pair key={stat.key} value={stat.value} label={stat.key} accent={tier.accent} text={tier.text} size={36} />
        ))}
      </div>

      <Centered top={848} fontSize={26} color="#e7ebf2">
        {card.club.toUpperCase()}
      </Centered>
      <Footline card={card} top={892} />
    </CardShell>
  );
}

export function CardTipografico({ card, scale = 1 }: { card: PlayerCard; scale?: number }) {
  const tier = paletteOf(card);
  const name = shortName(card.name).toUpperCase();

  return (
    <CardShell
      card={card}
      scale={scale}
      mapOpacity={0.3}
      scrim={`linear-gradient(180deg, ${tier.base}b3 0%, ${tier.base}80 40%, ${tier.base}f2 100%)`}
    >
      <Centered top={150} fontSize={236} color={tier.accent}>
        {card.overall}
      </Centered>
      <Centered top={400} fontSize={56} letterSpacing={6} color="#e7ebf2">
        {card.role}
      </Centered>
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 490,
          left: 150,
          width: CARD_WIDTH - 300,
          height: 3,
          backgroundColor: tier.accent,
          opacity: 0.6,
        }}
      />
      <Centered top={520} fontSize={nameSize(name)} color={tier.accent}>
        {name}
      </Centered>
      <Centered top={624} fontSize={26} letterSpacing={2} color="#aab3c2">
        {card.mapName.toUpperCase()} · {card.club.toUpperCase()}
      </Centered>

      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 700,
          left: 60,
          width: CARD_WIDTH - 120,
          justifyContent: "space-between",
        }}
      >
        {card.stats.map((stat) => (
          <Stack key={stat.key} value={stat.value} label={stat.key} accent={tier.accent} text={tier.text} />
        ))}
      </div>

      <Footline card={card} top={848} />
    </CardShell>
  );
}

export function CardPlacar({ card, scale = 1 }: { card: PlayerCard; scale?: number }) {
  const tier = paletteOf(card);
  const name = shortName(card.name).toUpperCase();

  return (
    <CardShell card={card} scale={scale} mapOpacity={0.4}>
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 132,
          left: 76,
          width: CARD_WIDTH - 152,
          alignItems: "center",
        }}
      >
        <Portrait card={card} size={108} accent={tier.accent} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginLeft: 20,
            width: 272,
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", fontSize: 44, color: tier.accent }}>{name}</div>
          <div style={{ display: "flex", marginTop: 4, fontSize: 24, color: tier.muted }}>
            {card.role} · {card.mapName.toUpperCase()}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            width: 148,
            justifyContent: "flex-end",
            fontSize: 92,
            color: tier.accent,
          }}
        >
          {card.overall}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "absolute",
          top: 286,
          left: 76,
          width: CARD_WIDTH - 152,
        }}
      >
        {card.stats.map((stat, index) => (
          <div
            key={stat.key}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              height: 76,
              paddingLeft: 22,
              paddingRight: 22,
              backgroundColor: index % 2 === 0 ? tier.stripe : tier.stripeAlt,
            }}
          >
            <div style={{ display: "flex", fontSize: 40, color: tier.accent }}>{stat.key}</div>
            <div style={{ display: "flex", fontSize: 50, color: tier.text }}>{stat.value}</div>
          </div>
        ))}
      </div>

      <Centered top={768} fontSize={28} color="#e7ebf2">
        {card.club.toUpperCase()}
      </Centered>
      <Footline card={card} top={814} />
    </CardShell>
  );
}

export function CardFaixa({ card, scale = 1 }: { card: PlayerCard; scale?: number }) {
  const tier = paletteOf(card);
  const name = shortName(card.name).toUpperCase();
  const rows = [card.stats.slice(0, 3), card.stats.slice(3)];

  return (
    <CardShell card={card} scale={scale} mapOpacity={0.44}>
      <div
        style={{ display: "flex", flexDirection: "column", position: "absolute", top: 132, left: 70 }}
      >
        <div style={{ display: "flex", fontSize: 118, lineHeight: 1, color: tier.accent }}>
          {card.overall}
        </div>
        <div style={{ display: "flex", fontSize: 46, color: tier.accent }}>{card.role}</div>
        <div
          style={{ display: "flex", marginTop: 12, fontSize: 24, letterSpacing: 2, color: tier.muted }}
        >
          {card.mapName.toUpperCase()}
        </div>
      </div>

      <div style={{ display: "flex", position: "absolute", top: 146, left: 432 }}>
        <Portrait card={card} size={196} accent={tier.accent} round={false} />
      </div>

      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 422,
          left: 54,
          width: CARD_WIDTH - 108,
          height: 100,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          backgroundColor: tier.accent,
          fontSize: nameSize(name) - 6,
          color: tier.fill,
        }}
      >
        {name}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "absolute",
          top: 568,
          left: 60,
          width: CARD_WIDTH - 120,
        }}
      >
        {rows.map((row, index) => (
          <div
            key={index}
            style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}
          >
            {row.map((stat) => (
              <div
                key={stat.key}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 186,
                  height: 128,
                  border: `2px solid ${tier.accent}59`,
                  backgroundColor: tier.veil,
                }}
              >
                <div style={{ display: "flex", fontSize: 54, color: tier.text }}>{stat.value}</div>
                <div style={{ display: "flex", fontSize: 30, color: tier.accent }}>{stat.key}</div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <Centered top={858} fontSize={26} color="#e7ebf2">
        {card.club.toUpperCase()}
      </Centered>
      <Footline card={card} top={900} />
    </CardShell>
  );
}

export function CardMapaAberto({ card, scale = 1 }: { card: PlayerCard; scale?: number }) {
  const tier = paletteOf(card);
  const name = shortName(card.name).toUpperCase();

  return (
    <CardShell
      card={card}
      scale={scale}
      mapOpacity={0.9}
      scrim={`linear-gradient(180deg, ${tier.base}33 0%, ${tier.base}00 32%, ${tier.base}d9 58%, ${tier.base}fc 78%)`}
    >
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 128,
          left: 66,
          alignItems: "center",
          height: 104,
          paddingLeft: 22,
          paddingRight: 26,
          borderRadius: 52,
          border: `3px solid ${tier.accent}`,
          backgroundColor: tier.veil,
        }}
      >
        <div style={{ display: "flex", fontSize: 78, lineHeight: 1, color: tier.accent }}>
          {card.overall}
        </div>
        <div style={{ display: "flex", marginLeft: 16, fontSize: 40, color: tier.text }}>
          {card.role}
        </div>
      </div>

      <div style={{ display: "flex", position: "absolute", top: 126, left: 478 }}>
        <Portrait card={card} size={112} accent={tier.accent} />
      </div>

      <Centered top={556} fontSize={nameSize(name)} color={tier.accent}>
        {name}
      </Centered>
      <Centered top={660} fontSize={26} letterSpacing={2} color="#e7ebf2">
        {card.mapName.toUpperCase()} · {card.club.toUpperCase()}
      </Centered>

      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 730,
          left: 60,
          width: CARD_WIDTH - 120,
          justifyContent: "space-between",
        }}
      >
        {card.stats.map((stat) => (
          <Stack key={stat.key} value={stat.value} label={stat.key} accent={tier.accent} text={tier.text} />
        ))}
      </div>

      <Footline card={card} top={880} />
    </CardShell>
  );
}

export function CardPoster({ card, scale = 1 }: { card: PlayerCard; scale?: number }) {
  const tier = paletteOf(card);
  const name = shortName(card.name).toUpperCase();
  const left = card.stats.filter((_, i) => i % 2 === 0);
  const right = card.stats.filter((_, i) => i % 2 === 1);

  return (
    <CardShell card={card} scale={scale} mapOpacity={0.4}>
      <div style={{ display: "flex", position: "absolute", top: 118, left: 210 }}>
        <Portrait card={card} size={300} accent={tier.accent} />
      </div>

      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 318,
          left: 176,
          width: 128,
          height: 128,
          borderRadius: 64,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: tier.accent,
          fontSize: 62,
          color: tier.fill,
        }}
      >
        {card.overall}
      </div>

      <Centered top={452} fontSize={nameSize(name)} color={tier.accent}>
        {name}
      </Centered>
      <Centered top={556} fontSize={28} letterSpacing={2} color="#aab3c2">
        {card.role} · {card.mapName.toUpperCase()}
      </Centered>

      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 624,
          left: 96,
          width: CARD_WIDTH - 192,
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          {left.map((stat) => (
            <Pair key={stat.key} value={stat.value} label={stat.key} accent={tier.accent} text={tier.text} size={46} />
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {right.map((stat) => (
            <Pair key={stat.key} value={stat.value} label={stat.key} accent={tier.accent} text={tier.text} size={46} />
          ))}
        </div>
      </div>

      <Centered top={856} fontSize={26} color="#e7ebf2">
        {card.club.toUpperCase()}
      </Centered>
      <Footline card={card} top={900} />
    </CardShell>
  );
}
