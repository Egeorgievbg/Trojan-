-- Additive and safe to reapply. Keep the previous deployment compatible.
BEGIN;
ALTER TABLE households ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE members ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE guest_sessions ADD COLUMN IF NOT EXISTS invitation_hash text;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS allergen_reviewed boolean NOT NULL DEFAULT false;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS purchased_qty numeric(12,3) CHECK (purchased_qty >= 0);
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS stock_qty numeric(12,3) NOT NULL DEFAULT 0 CHECK (stock_qty >= 0);

CREATE TABLE IF NOT EXISTS t27_questionnaire_versions (
  version integer GENERATED ALWAYS AS IDENTITY (START WITH 2) PRIMARY KEY,
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  published_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS t27_settings (
  id integer PRIMARY KEY CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  fixture_only boolean NOT NULL DEFAULT false,
  active_version integer NOT NULL DEFAULT 1,
  draft jsonb,
  draft_revision integer NOT NULL DEFAULT 0
);
INSERT INTO t27_settings(id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS t27_surveys (
  household_id text PRIMARY KEY REFERENCES households(id),
  questionnaire_version integer NOT NULL CHECK (questionnaire_version > 0),
  revision integer NOT NULL CHECK (revision > 0),
  draft jsonb NOT NULL CHECK (jsonb_typeof(draft) = 'object'),
  submitted_revision integer,
  submitted jsonb,
  submitted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (submitted_revision IS NULL AND submitted IS NULL AND submitted_at IS NULL)
    OR (submitted_revision IS NOT NULL AND submitted_revision > 0 AND submitted_revision <= revision
      AND submitted IS NOT NULL AND submitted_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS t27_submissions (
  household_id text NOT NULL REFERENCES households(id),
  revision integer NOT NULL CHECK (revision > 0),
  questionnaire_version integer NOT NULL,
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, revision)
);

CREATE TABLE IF NOT EXISTS t27_household_photos (
  household_id text PRIMARY KEY REFERENCES households(id),
  photo bytea NOT NULL CHECK (octet_length(photo) BETWEEN 1 AND 600000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS t27_dish_photos (
  recipe_id text PRIMARY KEY,
  photo bytea NOT NULL CHECK (octet_length(photo) BETWEEN 1 AND 600000),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS t27_contribution_acceptances (
  household_id text NOT NULL REFERENCES households(id),
  contribution_id text NOT NULL,
  proposal jsonb NOT NULL,
  PRIMARY KEY (household_id, contribution_id)
);
COMMIT;
