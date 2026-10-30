import type { MatchView } from "./aggregate";
import type { BuyType, RoundRecord, Side } from "./types";

export interface Insight {
  id: string;
  finding: string;
  action: string;
  evidence: string;
  tone: "good" | "bad";
}

interface OurRound {
  won: boolean;
  side: Side;
  buy: BuyType;
  theirBuy: BuyType;
  snipers: number;
  planted: boolean;
  map: string;
  next: { won: boolean; buy: BuyType } | null;
}

const MIN_SAMPLE = 8;
const MIN_MAP_ROUNDS = 30;

const share = (won: number, total: number) => (total ? won / total : 0);
const asPercent = (won: number, total: number) => `${Math.round(share(won, total) * 100)}%`;
const tally = (rounds: OurRound[]) => ({
  won: rounds.filter((r) => r.won).length,
  total: rounds.length,
});
const score = (rounds: OurRound[]) => {
  const { won, total } = tally(rounds);
  return `${asPercent(won, total)} (${won}/${total})`;
};

function sideOf(round: RoundRecord, ourSquad: "A" | "B"): Side {
  if (round.winnerSquad === ourSquad) return round.winnerSide;
  return round.winnerSide === "CT" ? "T" : "CT";
}

export function ourRounds(views: MatchView[]): OurRound[] {
  const rounds: OurRound[] = [];
  for (const view of views) {
    const ours = view.ourSquad;
    if (!ours) continue;
    const theirs = ours === "A" ? "B" : "A";
    const list = view.match.rounds;
    for (let i = 0; i < list.length; i++) {
      const round = list[i];
      const following = list[i + 1];
      rounds.push({
        won: round.winnerSquad === ours,
        side: sideOf(round, ours),
        buy: round.buyType[ours],
        theirBuy: round.buyType[theirs],
        snipers: round.snipers?.[ours] ?? 0,
        planted: round.bombPlanted,
        map: view.match.map,
        next: following
          ? { won: following.winnerSquad === ours, buy: following.buyType[ours] }
          : null,
      });
    }
  }
  return rounds;
}

export function insights(views: MatchView[]): Insight[] {
  const rounds = ourRounds(views);
  const found: Insight[] = [];

  const forceCt = rounds.filter((r) => r.buy === "force" && r.side === "CT");
  if (forceCt.length >= MIN_SAMPLE && share(tally(forceCt).won, forceCt.length) <= 0.2) {
    const forceT = rounds.filter((r) => r.buy === "force" && r.side === "T");
    found.push({
      id: "force-ct",
      tone: "bad",
      finding: "Forçar como CT não ganha round.",
      action:
        "Com economia curta no CT, salvar inteiro é melhor aposta: a arma do round seguinte vale mais que a tentativa.",
      evidence:
        forceT.length >= MIN_SAMPLE
          ? `Force buy no CT: ${score(forceCt)}. No TR o mesmo force dá ${score(forceT)}.`
          : `Force buy no CT: ${score(forceCt)}.`,
    });
  }

  const lostForce = rounds.filter((r) => r.buy === "force" && !r.won && r.next);
  const lostEco = rounds.filter((r) => r.buy === "eco" && !r.won && r.next);
  if (lostForce.length >= MIN_SAMPLE && lostEco.length >= MIN_SAMPLE) {
    const afterForce = share(lostForce.filter((r) => r.next!.won).length, lostForce.length);
    const afterEco = share(lostEco.filter((r) => r.next!.won).length, lostEco.length);
    if (afterEco - afterForce >= 0.08) {
      found.push({
        id: "force-cobra-depois",
        tone: "bad",
        finding: "O force cobra o preço no round seguinte, não no próprio round.",
        action:
          "Trate o force como decisão de duas jogadas: se perder deixa o próximo round quebrado, o eco honesto rende mais.",
        evidence: `Depois de perder um force vencemos o próximo em ${Math.round(afterForce * 100)}% (${lostForce.filter((r) => r.next!.won).length}/${lostForce.length}); depois de um eco, ${Math.round(afterEco * 100)}% (${lostEco.filter((r) => r.next!.won).length}/${lostEco.length}).`,
      });
    }
  }

  const pistols = rounds.filter((r) => r.buy === "pistol" && r.next);
  const wonPistol = pistols.filter((r) => r.won);
  const lostPistol = pistols.filter((r) => !r.won);
  if (wonPistol.length >= MIN_SAMPLE && lostPistol.length >= MIN_SAMPLE) {
    const afterWin = share(wonPistol.filter((r) => r.next!.won).length, wonPistol.length);
    const afterLoss = share(lostPistol.filter((r) => r.next!.won).length, lostPistol.length);
    if (afterWin - afterLoss >= 0.3) {
      const all = rounds.filter((r) => r.buy === "pistol");
      found.push({
        id: "pistola",
        tone: "bad",
        finding: "A pistola não vale um round, vale dois.",
        action:
          "Tratar o round de pistola como round decisivo: granada comprada, entrada combinada e trade pronto. É o investimento de maior retorno que existe hoje.",
        evidence: `Ganhando a pistola, levamos o round seguinte em ${Math.round(afterWin * 100)}%; perdendo, em ${Math.round(afterLoss * 100)}%. Aproveitamento nas pistolas: ${score(all)}.`,
      });
    }
  }

  const asT = rounds.filter((r) => r.side === "T");
  const planted = asT.filter((r) => r.planted);
  const notPlanted = asT.filter((r) => !r.planted);
  if (planted.length >= MIN_SAMPLE && notPlanted.length >= MIN_SAMPLE) {
    const withPlant = share(tally(planted).won, planted.length);
    const without = share(tally(notPlanted).won, notPlanted.length);
    if (withPlant - without >= 0.25) {
      found.push({
        id: "plantar",
        tone: "good",
        finding: "Plantar a bomba decide o round quase sozinho.",
        action: `Em round perdido, jogar para o plant em vez do duelo: plantamos em ${asPercent(planted.length, asT.length)} dos rounds de TR, e cada plant a mais vale quase um round.`,
        evidence: `Com a bomba no chão vencemos ${score(planted)}; sem plantar, ${score(notPlanted)}.`,
      });
    }
  }

  const asCt = rounds.filter((r) => r.side === "CT");
  const bombUp = asCt.filter((r) => r.planted);
  if (bombUp.length >= MIN_SAMPLE) {
    const lost = bombUp.filter((r) => !r.won).length;
    if (share(lost, bombUp.length) >= 0.6) {
      found.push({
        id: "retake",
        tone: "bad",
        finding: "Retake raramente volta.",
        action:
          "Como CT, o jogo é impedir o plant: posição adiantada e rotação cedo valem mais do que guardar utilitário para a retomada.",
        evidence: `Eles plantaram em ${asPercent(bombUp.length, asCt.length)} dos nossos rounds de CT e perdemos ${Math.round(share(lost, bombUp.length) * 100)}% deles.`,
      });
    }
  }

  const rich = rounds.filter(
    (r) => (r.buy === "full" || r.buy === "semi") && (r.theirBuy === "eco" || r.theirBuy === "force"),
  );
  if (rich.length >= MIN_SAMPLE && share(tally(rich).won, rich.length) >= 0.85) {
    found.push({
      id: "anti-eco",
      tone: "good",
      finding: "Anti-eco é ponto forte: não precisa mexer.",
      action: "Manter o que já se faz contra economia fraca e gastar o tempo de treino nos pontos acima.",
      evidence: `Contra eco ou force do adversário, vencemos ${score(rich)}.`,
    });
  }

  const sniperOpen = views
    .flatMap((v) => (v.ourSquad ? v.ourPlayers : []))
    .reduce(
      (soma, p) => ({
        kills: soma.kills + (p.sniperOpeningKills ?? 0),
        deaths: soma.deaths + (p.sniperOpeningDeaths ?? 0),
      }),
      { kills: 0, deaths: 0 },
    );
  const sniperDuels = sniperOpen.kills + sniperOpen.deaths;
  if (sniperDuels >= MIN_SAMPLE) {
    const ganhos = share(sniperOpen.kills, sniperDuels);
    found.push({
      id: "abertura-sniper",
      tone: ganhos >= 0.5 ? "good" : "bad",
      finding:
        ganhos >= 0.5
          ? "A sniper abre round a nosso favor."
          : "A primeira morte do round costuma vir de uma sniper adversária.",
      action:
        ganhos >= 0.5
          ? "Vale manter alguém de AWP fixo e dar utilitário para ele abrir o round."
          : "Antes de cruzar, gastar smoke e flash nos ângulos de AWP: hoje esses duelos são perdidos mais do que ganhos.",
      evidence: `Em ${sniperDuels} aberturas decididas na AWP ou Scout, ganhamos ${sniperOpen.kills} e perdemos ${sniperOpen.deaths}.`,
    });
  }

  const sniperLowBuy = rounds.filter(
    (r) => r.snipers > 0 && (r.buy === "eco" || r.buy === "force"),
  );
  const sniperFullBuy = rounds.filter(
    (r) => r.snipers > 0 && (r.buy === "semi" || r.buy === "full"),
  );
  if (sniperLowBuy.length >= MIN_SAMPLE && sniperFullBuy.length >= MIN_SAMPLE) {
    const lowBuyRate = share(tally(sniperLowBuy).won, sniperLowBuy.length);
    const fullBuyRate = share(tally(sniperFullBuy).won, sniperFullBuy.length);
    const gap = lowBuyRate - fullBuyRate;
    found.push({
      id: "sniper-economia",
      tone: gap >= 0 ? "good" : "bad",
      finding:
        gap >= 0.1
          ? "Comprar AWP ou Scout sem economia tem dado resultado."
          : gap <= -0.1
            ? "Comprar AWP ou Scout sem economia não está compensando."
            : "Ainda não há diferença clara entre a sniper no eco/force e no full buy.",
      action:
        gap >= 0.1
          ? "Quando só uma AWP ou Scout cabe no orçamento, vale jogar o round para ela e proteger as armas leves."
          : gap <= -0.1
            ? "Em eco ou force, preservar a sniper para o full buy seguinte rende mais do que montar o round inteiro em torno dela."
            : "Manter a decisão ligada ao mapa e à posição: a amostra atual ainda não mostra vantagem de forçar ou guardar a sniper.",
      evidence: `Com AWP ou Scout em eco/force vencemos ${score(sniperLowBuy)}; em semi/full buy, ${score(sniperFullBuy)}.`,
    });
  }

  const maps = new Map<string, OurRound[]>();
  for (const round of rounds) {
    const list = maps.get(round.map) ?? [];
    list.push(round);
    maps.set(round.map, list);
  }
  const lopsided = [...maps.entries()]
    .map(([map, list]) => {
      const ct = list.filter((r) => r.side === "CT");
      const t = list.filter((r) => r.side === "T");
      return { map, list, ct, t, gap: share(tally(t).won, t.length) - share(tally(ct).won, ct.length) };
    })
    .filter((m) => m.list.length >= MIN_MAP_ROUNDS && m.ct.length >= MIN_SAMPLE && m.t.length >= MIN_SAMPLE)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))[0];

  if (lopsided && Math.abs(lopsided.gap) >= 0.15) {
    const forte = lopsided.gap > 0 ? "TR" : "CT";
    const fraco = lopsided.gap > 0 ? "CT" : "TR";
    found.push({
      id: "lado-mapa",
      tone: "bad",
      finding: `Em ${lopsided.map.replace("de_", "")} somos um time de ${forte} só.`,
      action: `Escolher começar pelo ${fraco} nesse mapa, para que o lado ruim seja jogado com a economia cheia do início, e revisar o setup de ${fraco}.`,
      evidence: `${lopsided.map.replace("de_", "")}: CT ${score(lopsided.ct)}, TR ${score(lopsided.t)}.`,
    });
  }

  return found;
}
