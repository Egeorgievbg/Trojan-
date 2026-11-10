-- Run once in a new dedicated Neon Postgres database; non-destructive DDL.
CREATE TABLE IF NOT EXISTS households(id TEXT PRIMARY KEY, title TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS members(id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id), name TEXT NOT NULL, child BOOLEAN NOT NULL DEFAULT FALSE, ordinal INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS invitations(household_id TEXT PRIMARY KEY REFERENCES households(id), token_hash TEXT NOT NULL, issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS guest_sessions(token_hash TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id), expires_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS attendance(person_id TEXT PRIMARY KEY REFERENCES members(id), status TEXT NOT NULL CHECK(status IN ('yes','maybe','no')), days TEXT[] NOT NULL DEFAULT '{}', version INTEGER NOT NULL DEFAULT 1, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS preferences(person_id TEXT NOT NULL REFERENCES members(id), topic TEXT NOT NULL, value JSONB NOT NULL DEFAULT '{}'::jsonb, version INTEGER NOT NULL DEFAULT 1, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(person_id,topic));
CREATE TABLE IF NOT EXISTS household_shared(household_id TEXT NOT NULL REFERENCES households(id), topic TEXT NOT NULL, value JSONB NOT NULL DEFAULT '{}'::jsonb, version INTEGER NOT NULL DEFAULT 1, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(household_id,topic));
CREATE TABLE IF NOT EXISTS event_settings(id INTEGER PRIMARY KEY CHECK(id=1), value JSONB NOT NULL DEFAULT '{}'::jsonb, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS menu_items(slot_id TEXT NOT NULL, recipe_id TEXT NOT NULL, portions INTEGER NOT NULL CHECK(portions BETWEEN 0 AND 120), PRIMARY KEY(slot_id,recipe_id));
CREATE TABLE IF NOT EXISTS purchases(item_id TEXT PRIMARY KEY, bought BOOLEAN NOT NULL DEFAULT FALSE, assigned_to TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS guest_sessions_expires_at_idx ON guest_sessions(expires_at);
-- Immutable source snapshots for reconciliation after an authorized AppDeploy export.
CREATE TABLE IF NOT EXISTS migration_archives(source_id TEXT PRIMARY KEY,payload JSONB NOT NULL,digest TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
