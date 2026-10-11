// Types and texts for Wrapped that the client cards share with the tally in lib/wrapped.ts
// (which reads the database and so can't be imported from client components).
import type { Cell, Draw, Prize, Round } from "./types";

export interface WrapRound {
  round: Round;
  cells: Cell[];
  draws: Draw[];
  prizes: Prize[];
}

/** Several people can share a record; they share the card too. */
export interface Leader {
  names: string[];
  value: number;
}

export interface SquareTally {
  row: number;
  col: number;
  sold: number;
  wins: number;
}

export interface YearWrap {
  year: number;
  rounds: number;
  lodd: number;
  bottles: number;
  people: number;
  /** People with a lodd this year and none in any earlier year; null without earlier years. */
  newFaces: number | null;
  regular: Leader | null;
  topWinners: { name: string; wins: number }[];
  /** Most 1. premier (drawn first, who then arranges the next round). */
  crown: Leader | null;
  gridSize: number;
  squares: SquareTally[];
  hottest: SquareTally | null;
  /** Bought most often without ever winning. */
  coldest: SquareTally | null;
  /** The organiser of each round, in order. */
  relay: string[];
  topOrganizer: Leader | null;
  money: { start: number; lodd: number; polet: number; end: number; adjusted: number };
  /** Only when the year's prizes carry categories or prices (the app era, not the import). */
  cellar: { categories: { name: string; count: number }[]; priciest: { name: string; price: number } | null } | null;
  optimist: Leader | null;
  /** Most rounds in a row with lodd and no win. */
  drought: Leader | null;
}

export type TitleId =
  | "polkongen"
  | "snikskytter"
  | "optimist"
  | "stamgjest"
  | "arrangor"
  | "vanedyr"
  | "nykommer"
  | "smaker";

export interface PersonWrap {
  name: string;
  lodd: number;
  rounds: number;
  wins: number;
  firstPrizes: number;
  organized: number;
  spent: number;
  /** Kroner the wins were worth; null when any won prize has no price. */
  wonWorth: number | null;
  /** Place by lodd among everyone this year (1 = most). */
  loddRank: number;
  squares: SquareTally[];
  lucky: SquareTally | null;
  drought: number;
  isNew: boolean;
  title: TitleId;
  note: string;
}

export const TITLES: { [K in TitleId]: { name: string; line: string } } = {
  polkongen: { name: "Polkongen", line: "Flest førstepremier i år. Kronen er din." },
  snikskytter: { name: "Snikskytteren", line: "Få lodd, mye vin. Ingen traff oftere." },
  optimist: { name: "Evig optimist", line: "Lodd etter lodd, uten gevinst. Neste år, kanskje." },
  stamgjest: { name: "Stamgjesten", line: "Med i nesten hver eneste runde." },
  arrangor: { name: "Arrangørveteranen", line: "Du holdt lotteriet i gang, uke etter uke." },
  vanedyr: { name: "Vanedyret", line: "Samme rute, gang på gang. Lojalitet." },
  nykommer: { name: "Nykommeren", line: "Første år i lotteriet. Velkommen." },
  smaker: { name: "Den trofaste smakeren", line: "Jevnt og trutt, runde etter runde." },
};

/** "Ola", "Ola og Kari", "Ola, Kari og Per". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} og ${names[names.length - 1]}`;
}
