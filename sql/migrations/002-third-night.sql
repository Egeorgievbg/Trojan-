-- TROJAN 2027: additive event extension from two to three nights.
-- Apply only after preview validation and a confirmed Neon backup/recovery point.
-- Existing survey snapshots, participant answers and invitation data are never updated.
BEGIN;
UPDATE event_settings
SET value = jsonb_set(
  jsonb_set(value, '{dates}', '["2026-12-31","2027-01-01","2027-01-02","2027-01-03"]'::jsonb, true),
  '{nights}', '3'::jsonb, true
), updated_at = now()
WHERE id = 1
  AND value->'dates' = '["2026-12-31","2027-01-01","2027-01-02"]'::jsonb
  AND value->>'nights' = '2';
COMMIT;

-- Verification (read-only):
-- SELECT value->'dates' AS dates, value->'nights' AS nights FROM event_settings WHERE id=1;
-- No rollback data loss: restore only the original event_settings JSONB snapshot, never the survey tables.
