-- ────────────────────────────────────────────────────────────────────────────
-- Polluwatch — Industrial Facility Compliance module
-- Run this in the Supabase SQL editor (Settings → SQL Editor → New query).
-- These tables are ADDITIVE — they do not touch any existing tables.
-- ────────────────────────────────────────────────────────────────────────────

-- 1. Facilities registry ──────────────────────────────────────────────────────
create table if not exists facilities (
  id              serial primary key,
  slug            text unique not null,
  name            text not null,
  industry_type   text not null,
  county          text,
  lat             double precision not null,
  lng             double precision not null,
  -- NEMA ambient-air permit limits (µg/m³ or ppb)
  permit_pm25     numeric default 35,
  permit_pm10     numeric default 75,
  permit_so2_ppb  numeric default 75,
  permit_no2_ppb  numeric default 100,
  is_demo         boolean default true,
  is_active       boolean default true,
  created_at      timestamptz default now()
);

-- 2. Raw fence-line sensor readings ──────────────────────────────────────────
--    Stores what a cheap PMS5003/PMS7003-class sensor reported,
--    plus the environmental co-variables used for correction.
create table if not exists boundary_raw_readings (
  id              serial primary key,
  facility_id     integer references facilities(id) on delete cascade,
  measured_at     timestamptz not null,
  pollutant       text not null,            -- 'pm25' | 'pm10'
  raw_value       numeric not null,
  humidity_pct    numeric,
  temperature_c   numeric,
  sensor_age_days numeric,
  created_at      timestamptz default now(),
  unique (facility_id, measured_at, pollutant)
);

-- 3. AI-calibrated readings ───────────────────────────────────────────────────
--    One row per timestamp × pollutant × model_version.
--    Stores all three values so the frontend can plot all three lines.
--    split: 'calibration' = co-location training period; 'test' = field deployment.
create table if not exists boundary_calibrated_readings (
  id                serial primary key,
  facility_id       integer references facilities(id) on delete cascade,
  measured_at       timestamptz not null,
  pollutant         text not null,
  reference_value   numeric not null,
  raw_value         numeric not null,
  calibrated_value  numeric not null,
  model_version     text not null,
  split             text not null default 'calibration',  -- 'calibration' | 'test'
  created_at        timestamptz default now(),
  unique (facility_id, measured_at, pollutant, model_version)
);

-- 4. Predictive emissions estimates ──────────────────────────────────────────
--    Stores model predictions vs actual measured emissions.
--    sample_index matches the row index in the source dataset for traceability.
create table if not exists emission_estimates (
  id               serial primary key,
  facility_id      integer references facilities(id) on delete cascade,
  sample_index     integer not null,
  pollutant        text not null,            -- 'CO' | 'NOX'
  actual_value     numeric,
  predicted_value  numeric not null,
  split            text not null default 'test',
  model_version    text not null,
  created_at       timestamptz default now(),
  unique (facility_id, sample_index, pollutant, model_version)
);

-- ── Seed demo facilities ──────────────────────────────────────────────────────
-- Module A: real cement plant at Athi River (PM2.5/PM10 from Open-Meteo)
-- Module B: KenGen gas turbine unit — example deployment target only;
--           model is trained on Turkey UCI dataset, not on KenGen data.
insert into facilities
  (slug, name, industry_type, county, lat, lng, permit_pm25, permit_pm10, is_demo)
values
  (
    'eapcc-athi-river',
    'East African Portland Cement Co. — Athi River Plant',
    'Cement manufacturing',
    'Machakos',
    -1.431349, 36.961717,
    35, 75,
    true
  ),
  (
    'kengen-gas-turbine-demo',
    'KenGen Gas Turbine Unit — Demo',
    'Power generation (gas turbine)',
    'Nairobi',
    -1.3192, 36.9258,
    35, 75,
    true
  )
on conflict (slug) do nothing;
