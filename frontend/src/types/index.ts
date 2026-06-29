// ── Database row types (snake_case mirrors Supabase columns) ─────────────────

export interface DbLocation {
  id: number;
  name: string;
  lat: number;
  lng: number;
  is_active: boolean;
  created_at: string;
  country?: string;
  flag?: string;
  continent?: string;
}

export interface DbMeasurement {
  id: number;
  location_id: number;
  measured_at: string;
  aqi: number;
  category: string;
  dominant_pollutant: string;
  pm25: number;
  pm10: number;
  co: number;
  no2: number;
  o3: number;
  so2: number;
  created_at: string;
}

export interface DbPrediction {
  id: number;
  location_id: number;
  predicted_for: string;
  predicted_at: string;
  predicted_aqi: number;
  category: string;
  model_version: string;
}

// ── Application-level types ───────────────────────────────────────────────────

export interface PollutantData {
  pm25: number; pm10: number;
  co: number;   no2: number;
  o3: number;   so2: number;
}

export interface HistoricalPoint extends PollutantData {
  date: string;
  aqi: number;
}

export interface PredictionPoint {
  predictedFor: string;
  predictedAqi: number;
  category: string;
}

export interface AlertRecord {
  pollutant: string;
  threshold: number;
  value: number;
  alertLevel: "warning" | "danger";
  locationName: string;
  measuredAt: string;
}

export interface AQICategory {
  min: number;
  max: number;
  label: string;
  color: string;
  bg: string;
}

export type PollutantKey = "pm25" | "pm10" | "co" | "no2" | "o3" | "so2";

// Enriched city type used on homepage
export interface CityWithData extends DbLocation {
  measurement: DbMeasurement | null;
}

// ── Industrial Facility Compliance module ─────────────────────────────────────

export interface DbFacility {
  id: number;
  slug: string;
  name: string;
  industry_type: string;
  county: string | null;
  lat: number;
  lng: number;
  permit_pm25: number;
  permit_pm10: number;
  permit_so2_ppb: number;
  permit_no2_ppb: number;
  is_demo: boolean;
  is_active: boolean;
  created_at: string;
}

export interface BoundaryReading {
  id: number;
  facility_id: number;
  measured_at: string;
  pollutant: string;
  reference_value: number;
  raw_value: number;
  calibrated_value: number;
  model_version: string;
  split: string;      // 'calibration' | 'test'
  created_at: string;
}

export interface EmissionEstimate {
  id: number;
  facility_id: number;
  sample_index: number;
  pollutant: string;  // 'CO' | 'NOX'
  actual_value: number | null;
  predicted_value: number;
  split: string;
  model_version: string;
  created_at: string;
}
