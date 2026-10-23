export type RoundStatus = "draft" | "open" | "closed" | "drawn" | "settled";
export type DrawMode = "physical" | "digital";
export type CellStatus = "available" | "held" | "sold";

export interface Round {
  id: number;
  created_at: string;
  status: RoundStatus;
  title: string;
  ticket_price: number;
  max_per_person: number;
  restriction_lifts_at: string | null;
  sales_close_at: string | null;
  draw_mode: DrawMode;
  grid_size: number;
  organizer_name: string;
  vipps_number: string;
  vipps_qr_image: string | null;
  vipps_message: string;
  carried_over: number;
  polet_cost: number | null;
  notes: string;
  /** Seasonal look of the buyer page: "none" or a season (lib/season.ts). */
  theme: string;
}

export interface Prize {
  id: number;
  round_id: number;
  rank: number;
  name: string;
  varenummer: string | null;
  category: string | null;
  price: number | null;
  volume: string | null;
  image_url: string | null;
}

export interface Cell {
  id: number;
  round_id: number;
  row: number;
  col: number;
  status: CellStatus;
  buyer_name: string | null;
  buyer_name_norm: string | null;
  buyer_contact: string | null;
  paid: number;
  hold_expires_at: string | null;
  created_at: string | null;
  paid_marked_at: string | null;
  /** JSON list of prize ids, most wanted first; null = no wishes. */
  wishes: string | null;
}

export interface Draw {
  id: number;
  round_id: number;
  prize_id: number | null;
  rank: number;
  row: number | null;
  col: number | null;
  winner_cell_id: number | null;
  winner_name: string | null;
  method: DrawMode;
  seed: string | null;
  rerolls: string | null;
  /** 1 = the winner wasn't there and picks later; the draw carried on without them. */
  skipped: number;
  created_at: string;
}

/** Cell shape exposed to the public grid (no contact info). */
export interface PublicCell {
  row: number;
  col: number;
  status: CellStatus;
  name: string | null;
  paid: boolean;
  mine?: boolean;
  /** Your own prize wishes (only sent for your own squares). */
  wishes?: number[];
}

export interface MoneySummary {
  ticketPrice: number;
  sold: number;
  paidCount: number;
  unpaidCount: number;
  carriedOver: number;
  loddSolgt: number;
  poletCost: number;
  poletCostAuto: boolean;
  videre: number;
}

export interface VippsPresentation {
  number: string;
  link: string | null;
  qr: string | null;
}

export interface RoundState {
  round: Round;
  prizes: Prize[];
  cells: PublicCell[];
  draws: PublicDraw[];
  money: MoneySummary;
  salesOpen: boolean;
  restrictionActive: boolean;
  now: string;
  vipps?: VippsPresentation;
  /** The dice roll in progress, for the big screen (lib/liveRoll.ts). */
  live: LiveRoll | null;
}

export type LiveOutcome = "winner" | "empty" | "taken" | "no-eligible";

export interface LiveRoll {
  /** New for every roll; the same while one roll gets its second die and its outcome. */
  seq: number;
  /** Which winner is being drawn (draw order). */
  rank: number;
  col: number | null;
  row: number | null;
  /** null while the dice are still being read off. */
  outcome: LiveOutcome | null;
  method: DrawMode;
}

export interface PublicDraw {
  /** Draw order: 1 = first winner drawn, who picks first. */
  rank: number;
  /** The prize the winner picked; null until they have chosen. */
  prizeId: number | null;
  prizeName: string | null;
  prizeImage: string | null;
  row: number | null;
  col: number | null;
  winnerName: string | null;
  method: DrawMode;
  pending: boolean;
  /** The winner wasn't there and picks later. */
  skipped: boolean;
}

export interface NameStat {
  name: string;
  wins: number;
}

export interface ParticipantStat {
  name: string;
  rounds: number;
  lodd: number;
}

export interface LuckStat {
  name: string;
  lodd: number;
  wins: number;
  pct: number;
}

/** Lodd and rounds since someone's last win; all of them if they never won. */
export interface DroughtStat {
  name: string;
  lodd: number;
  rounds: number;
  neverWon: boolean;
}

/** One square's tally across all rounds, for the win heatmap. */
export interface SquareHeat {
  row: number;
  col: number;
  wins: number;
  sold: number;
}

export interface LotteryStats {
  topWinners: NameStat[];
  topParticipants: ParticipantStat[];
  luckIndex: LuckStat[];
  drought: DroughtStat[];
  gridSize: number;
  squares: SquareHeat[];
  /** Winners we could pin to a square, out of all winners — heatmap coverage. */
  locatedWins: number;
  totalWins: number;
}
