CREATE TABLE IF NOT EXISTS t27_ai_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id TEXT NOT NULL REFERENCES households(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS t27_ai_requests_household_idx ON t27_ai_requests(household_id,created_at DESC);
-- Do not retain AI prompt text or health/allergy details in usage logs.