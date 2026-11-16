-- Synthetic development fixture. Load only into an isolated test database.
INSERT INTO households(id, title) VALUES
  ('household-a', 'Примерно семейство А'), ('household-b', 'Примерно семейство Б'),
  ('household-c', 'Примерно семейство В'), ('household-d', 'Примерно семейство Г')
ON CONFLICT DO NOTHING;

INSERT INTO members(id, household_id, name, child, ordinal) VALUES
  ('adult-a1', 'household-a', 'Гост А1', false, 1),
  ('adult-a2', 'household-a', 'Гост А2', false, 2),
  ('child-a3', 'household-a', 'Дете А3', true, 3),
  ('adult-b1', 'household-b', 'Гост Б1', false, 1),
  ('adult-b2', 'household-b', 'Гост Б2', false, 2),
  ('child-b3', 'household-b', 'Дете Б3', true, 3),
  ('adult-c1', 'household-c', 'Гост В1', false, 1),
  ('adult-c2', 'household-c', 'Гост В2', false, 2),
  ('adult-c3', 'household-c', 'Гост В3', false, 3),
  ('child-c4', 'household-c', 'Дете В4', true, 4),
  ('adult-d1', 'household-d', 'Гост Г1', false, 1),
  ('adult-d2', 'household-d', 'Гост Г2', false, 2),
  ('child-d3', 'household-d', 'Дете Г3', true, 3),
  ('child-d4', 'household-d', 'Дете Г4', true, 4)
ON CONFLICT DO NOTHING;

INSERT INTO event_settings(id, value)
VALUES (1, '{"dates":["2026-12-31","2027-01-01","2027-01-02"],"nights":2}'::jsonb)
ON CONFLICT DO NOTHING;
