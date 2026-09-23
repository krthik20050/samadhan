-- 001_initial_schema.sql — grievance MVP core tables (PostgreSQL).
-- Run: psql $DATABASE_URL -f 001_initial_schema.sql

-- Supabase provides an `extensions` schema; local Postgres may not, so create it.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

CREATE TABLE depots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  district    text,
  phone       text,
  address     text,
  external_id text UNIQUE            -- dataset data/final/depots.csv -> depot_id
);
CREATE INDEX idx_depots_name ON depots (name);

CREATE TABLE routes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,         -- e.g. 'Adoor - Ernakulam'
  origin      text NOT NULL,
  destination text NOT NULL,
  service_type text,
  external_id text UNIQUE            -- dataset data/final/routes.csv -> route_id
);
CREATE INDEX idx_routes_external ON routes (external_id);
CREATE INDEX idx_routes_od ON routes (origin, destination);

CREATE TABLE route_depot_mapping (
  route_id        uuid NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  depot_id        uuid NOT NULL REFERENCES depots(id) ON DELETE CASCADE,
  mapping_status  text NOT NULL DEFAULT 'VERIFIED' CHECK (mapping_status IN ('VERIFIED','PROBABLE')),
  review_required boolean NOT NULL DEFAULT false,
  PRIMARY KEY (route_id, depot_id)
);
CREATE INDEX idx_mapping_depot ON route_depot_mapping (depot_id);

CREATE TABLE sla_rules (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category         text NOT NULL,
  priority         text NOT NULL DEFAULT 'normal',
  response_hours   integer NOT NULL CHECK (response_hours > 0),
  resolution_hours integer NOT NULL CHECK (resolution_hours > 0),
  UNIQUE (category, priority)
);

CREATE TABLE complaints (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id  text NOT NULL UNIQUE,  -- e.g. 'KSRTC-2026-A1B2C3'
  bus_number    text,
  route_id      uuid REFERENCES routes(id),
  route_text    text,                  -- free text when route unknown
  category      text NOT NULL CHECK (category IN (
    'cleanliness','unsafe_driving','overcrowding','missed_stop',
    'concession_denied','ticketing','staff_behaviour','bus_condition','other')),
  location_text text,
  description   text NOT NULL CHECK (char_length(description) >= 10),
  contact_phone text,                  -- operational only, never in analytics
  depot_id      uuid REFERENCES depots(id),
  status        text NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'submitted','in_review','resolved','closed','escalated','needs_triage')),
  priority      text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','critical')),
  sla_due_at    timestamptz,
  sla_breached  boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (route_id IS NOT NULL OR route_text IS NOT NULL)
);
CREATE INDEX idx_complaints_ref ON complaints (reference_id);
CREATE INDEX idx_complaints_status ON complaints (status);
CREATE INDEX idx_complaints_depot ON complaints (depot_id);
CREATE INDEX idx_complaints_category ON complaints (category);
CREATE INDEX idx_complaints_created ON complaints (created_at);

CREATE TABLE status_history (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  from_status  text,
  to_status    text NOT NULL,
  changed_by   text,
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_history_complaint ON status_history (complaint_id, created_at);

CREATE TABLE evidence (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  storage_path text NOT NULL,          -- Supabase Storage path; bytes live there
  mime_type    text,
  size_bytes   integer,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_evidence_complaint ON evidence (complaint_id);

-- Anonymised dashboard view: no phone, no verbatim location.
CREATE OR REPLACE VIEW dashboard_complaints AS
SELECT c.reference_id, c.category, c.status, c.priority,
       d.name AS depot, c.sla_breached, c.created_at
FROM complaints c LEFT JOIN depots d ON d.id = c.depot_id;
