// Database schema — shared by lib/db.ts (runtime) and scripts/seed.mjs.
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'draft',            -- draft | open | closed | drawn | settled
  title TEXT NOT NULL DEFAULT '',
  ticket_price INTEGER NOT NULL DEFAULT 15,
  max_per_person INTEGER NOT NULL DEFAULT 2,
  restriction_lifts_at TEXT,                       -- ISO 8601, null = restriction always on
  sales_close_at TEXT,                             -- ISO 8601, null = only closes manually
  draw_mode TEXT NOT NULL DEFAULT 'physical',      -- physical | digital
  grid_size INTEGER NOT NULL DEFAULT 6,
  organizer_name TEXT NOT NULL DEFAULT '',
  vipps_number TEXT NOT NULL DEFAULT '',
  vipps_qr_image TEXT,                             -- data URI of an uploaded personal Vipps QR
  vipps_message TEXT NOT NULL DEFAULT '',
  carried_over INTEGER NOT NULL DEFAULT 0,         -- kr carried in from previous round
  polet_cost INTEGER,                              -- kr; null = auto-sum of prize prices
  notes TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL DEFAULT 'auto'               -- auto | none | jul | paske | 17mai | sommer
);

CREATE TABLE IF NOT EXISTS prizes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  varenummer TEXT,
  category TEXT,
  price INTEGER,
  volume TEXT,
  image_url TEXT
);
CREATE INDEX IF NOT EXISTS idx_prizes_round ON prizes(round_id);

-- Pasted/dropped prize photos (downscaled client-side); prizes.image_url points at /api/prize-image/<id>.
CREATE TABLE IF NOT EXISTS prize_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mime TEXT NOT NULL,
  data BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cells (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  row INTEGER NOT NULL,
  col INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',        -- available | held | sold
  buyer_name TEXT,
  buyer_name_norm TEXT,
  buyer_contact TEXT,
  paid INTEGER NOT NULL DEFAULT 0,
  hold_expires_at TEXT,
  created_at TEXT,
  paid_marked_at TEXT,
  wishes TEXT,                                     -- JSON: prize ids in the buyer's order of preference
  UNIQUE(round_id, row, col)
);
CREATE INDEX IF NOT EXISTS idx_cells_round ON cells(round_id);

CREATE TABLE IF NOT EXISTS draws (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  prize_id INTEGER REFERENCES prizes(id) ON DELETE SET NULL,
  rank INTEGER NOT NULL,
  row INTEGER,
  col INTEGER,
  winner_cell_id INTEGER REFERENCES cells(id) ON DELETE SET NULL,
  winner_name TEXT,
  method TEXT NOT NULL,                            -- physical | digital
  seed TEXT,
  rerolls TEXT,                                    -- JSON: [[row,col], ...] empty squares hit before a winner
  skipped INTEGER NOT NULL DEFAULT 0,              -- winner wasn't there; picks later, the draw goes on
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(round_id, rank)
);
CREATE INDEX IF NOT EXISTS idx_draws_round ON draws(round_id);

-- Teams messages already sent (lib/notify.ts), so each is posted at most once per round.
CREATE TABLE IF NOT EXISTS notifications (
  round_id INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (round_id, key)
);

-- Years whose Wrapped ("Årgang") has been released from /superadmin (lib/wrapped.ts).
CREATE TABLE IF NOT EXISTS wrapped_releases (
  year INTEGER PRIMARY KEY,
  released_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Switches set from /superadmin (lib/settings.ts), e.g. history_edit = '1'.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;
