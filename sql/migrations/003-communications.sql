-- TROJAN 2027: additive messaging and opt-in notifications. Never import personal data from AppDeploy.
CREATE TABLE IF NOT EXISTS t27_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id TEXT NOT NULL REFERENCES households(id),
  sender_role TEXT NOT NULL CHECK (sender_role IN ('guest', 'admin')),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS t27_messages_household_created_idx ON t27_messages(household_id,created_at DESC);
CREATE TABLE IF NOT EXISTS t27_push_subscriptions (
  endpoint_hash TEXT PRIMARY KEY,
  recipient_role TEXT NOT NULL CHECK (recipient_role IN ('guest','admin')),
  household_id TEXT REFERENCES households(id),
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth_secret TEXT NOT NULL,
  categories TEXT[] NOT NULL DEFAULT '{messages,announcements,menu,tasks}',
  consent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((recipient_role='guest' AND household_id IS NOT NULL) OR
         (recipient_role='admin' AND household_id IS NULL))
);
CREATE INDEX IF NOT EXISTS t27_push_household_idx ON t27_push_subscriptions(household_id);
CREATE TABLE IF NOT EXISTS t27_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id TEXT REFERENCES households(id),
  sender_email TEXT,
  endpoint_hash TEXT,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('messages','announcements','menu','tasks')),
  status TEXT NOT NULL CHECK (status IN ('accepted','failed','expired','not_subscribed')),
  error_code INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS t27_notification_log_created_idx ON t27_notification_log(created_at DESC);
