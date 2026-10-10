// Minimal builders for domain objects in tests: only override what the test cares about.
import type { Cell, Draw, Prize, Round } from "./types";

export function round(over: Partial<Round> = {}): Round {
  return {
    id: 1,
    created_at: "2026-01-01T00:00:00.000Z",
    status: "open",
    title: "Vinlotteri",
    ticket_price: 20,
    max_per_person: 5,
    restriction_lifts_at: null,
    sales_close_at: null,
    draw_mode: "digital",
    grid_size: 10,
    organizer_name: "Test",
    vipps_number: "12345",
    vipps_qr_image: null,
    vipps_message: "",
    carried_over: 0,
    polet_cost: null,
    notes: "",
    theme: "auto",
    ...over,
  };
}

export function prize(over: Partial<Prize> = {}): Prize {
  return {
    id: 1,
    round_id: 1,
    rank: 1,
    name: "Vin",
    varenummer: null,
    category: null,
    price: null,
    volume: null,
    image_url: null,
    ...over,
  };
}

export function cell(over: Partial<Cell> = {}): Cell {
  return {
    id: 1,
    round_id: 1,
    row: 1,
    col: 1,
    status: "available",
    buyer_name: null,
    buyer_name_norm: null,
    buyer_contact: null,
    paid: 0,
    hold_expires_at: null,
    created_at: null,
    paid_marked_at: null,
    wishes: null,
    ...over,
  };
}

export function draw(over: Partial<Draw> = {}): Draw {
  return {
    id: 1,
    round_id: 1,
    prize_id: null,
    rank: 1,
    row: null,
    col: null,
    winner_cell_id: null,
    winner_name: null,
    method: "digital",
    seed: null,
    rerolls: null,
    skipped: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}
