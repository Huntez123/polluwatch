import type { AQICategory, PollutantKey } from "@/types";

export const KENYAN_CITIES = [
  { name: "Nairobi",  lat: -1.2921, lng: 36.8219 },
  { name: "Mombasa",  lat: -4.0435, lng: 39.6682 },
  { name: "Kisumu",   lat: -0.0917, lng: 34.7679 },
  { name: "Nakuru",   lat: -0.3031, lng: 36.0800 },
  { name: "Eldoret",  lat:  0.5140, lng: 35.2698 },
] as const;

export const AQI_CATEGORIES: AQICategory[] = [
  { min: 0,   max: 50,  label: "Good",                           color: "#15803d", bg: "#dcfce7" },
  { min: 51,  max: 100, label: "Moderate",                       color: "#ca8a04", bg: "#fef9c3" },
  { min: 101, max: 150, label: "Unhealthy for Sensitive Groups", color: "#ea580c", bg: "#ffedd5" },
  { min: 151, max: 200, label: "Unhealthy",                      color: "#dc2626", bg: "#fee2e2" },
  { min: 201, max: 300, label: "Very Unhealthy",                 color: "#9333ea", bg: "#f3e8ff" },
  { min: 301, max: 500, label: "Hazardous",                      color: "#7f1d1d", bg: "#fce7f3" },
];

export const POLLUTANT_THRESHOLDS: Record<PollutantKey, { warningLevel: number; dangerLevel: number }> = {
  pm25: { warningLevel: 35,  dangerLevel: 75  },
  pm10: { warningLevel: 50,  dangerLevel: 150 },
  o3:   { warningLevel: 70,  dangerLevel: 100 },
  no2:  { warningLevel: 53,  dangerLevel: 100 },
  co:   { warningLevel: 9,   dangerLevel: 35  },
  so2:  { warningLevel: 35,  dangerLevel: 75  },
};

export const POLLUTANT_LABELS: Record<PollutantKey, { label: string; unit: string }> = {
  pm25: { label: "PM2.5", unit: "µg/m³" },
  pm10: { label: "PM10",  unit: "µg/m³" },
  o3:   { label: "O₃",   unit: "µg/m³" },
  no2:  { label: "NO₂",  unit: "µg/m³" },
  co:   { label: "CO",   unit: "µg/m³" },
  so2:  { label: "SO₂",  unit: "µg/m³" },
};
