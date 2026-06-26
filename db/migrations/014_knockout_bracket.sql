-- Migration 014: Knockout bracket linkage + penalty shootout
-- Enables auto-propagation of winners/losers into dependent knockout matches.
--   *_source_match_id  -> which prior match feeds each slot
--   *_source_kind      -> 'winner' | 'loser' (loser is needed for the 3rd-place match)
--   penales_*          -> shootout score, used ONLY to resolve advancement on a tie.
--                         Scoring stays on resultado_local/visitante, so penalties
--                         never change how many points a bet earns.

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS home_source_match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS away_source_match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS home_source_kind VARCHAR(10),
  ADD COLUMN IF NOT EXISTS away_source_kind VARCHAR(10),
  ADD COLUMN IF NOT EXISTS penales_local INTEGER,
  ADD COLUMN IF NOT EXISTS penales_visitante INTEGER;

CREATE INDEX IF NOT EXISTS idx_matches_home_source ON matches(home_source_match_id);
CREATE INDEX IF NOT EXISTS idx_matches_away_source ON matches(away_source_match_id);
