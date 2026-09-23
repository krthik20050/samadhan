-- 002_seed_sla_rules.sql — full category x priority matrix (9 x 4 = 36 rows),
-- so every complaint always finds a rule and sla_due_at is never NULL.
-- Re-runnable: re-apply tuned hours with ON CONFLICT DO UPDATE.
-- Run: psql $DATABASE_URL -f 002_seed_sla_rules.sql

INSERT INTO sla_rules (category, priority, response_hours, resolution_hours) VALUES
  -- unsafe_driving: safety first, fastest lane
  ('unsafe_driving',    'low',      8,  48),
  ('unsafe_driving',    'normal',   4,  24),
  ('unsafe_driving',    'high',     2,  12),
  ('unsafe_driving',    'critical', 1,   8),
  -- overcrowding / staff_behaviour: fast lane
  ('overcrowding',      'low',     24, 120),
  ('overcrowding',      'normal',  12,  72),
  ('overcrowding',      'high',     4,  24),
  ('overcrowding',      'critical', 2,  12),
  ('staff_behaviour',   'low',     24, 120),
  ('staff_behaviour',   'normal',  12,  72),
  ('staff_behaviour',   'high',     4,  24),
  ('staff_behaviour',   'critical', 2,  12),
  -- concession_denied / missed_stop: standard lane
  ('concession_denied', 'low',     24, 120),
  ('concession_denied', 'normal',   8,  48),
  ('concession_denied', 'high',     4,  24),
  ('concession_denied', 'critical', 2,  12),
  ('missed_stop',       'low',     24, 120),
  ('missed_stop',       'normal',   8,  48),
  ('missed_stop',       'high',     4,  24),
  ('missed_stop',       'critical', 2,  12),
  -- cleanliness / ticketing / bus_condition / other: routine lane
  ('cleanliness',       'low',     48, 168),
  ('cleanliness',       'normal',  24,  96),
  ('cleanliness',       'high',    12,  48),
  ('cleanliness',       'critical', 4,  24),
  ('ticketing',         'low',     48, 168),
  ('ticketing',         'normal',  24,  96),
  ('ticketing',         'high',    12,  48),
  ('ticketing',         'critical', 4,  24),
  ('bus_condition',     'low',     48, 168),
  ('bus_condition',     'normal',  24,  96),
  ('bus_condition',     'high',    12,  48),
  ('bus_condition',     'critical', 4,  24),
  ('other',             'low',     48, 168),
  ('other',             'normal',  24,  96),
  ('other',             'high',    12,  48),
  ('other',             'critical', 4,  24)
ON CONFLICT (category, priority) DO UPDATE
SET response_hours = EXCLUDED.response_hours,
    resolution_hours = EXCLUDED.resolution_hours;
