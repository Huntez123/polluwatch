import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { AQI_CATEGORIES, POLLUTANT_THRESHOLDS } from "./constants";
import type { AQICategory, PollutantKey } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getAQICategory(aqi: number): AQICategory {
  return (
    AQI_CATEGORIES.find((c) => aqi >= c.min && aqi <= c.max) ??
    AQI_CATEGORIES[AQI_CATEGORIES.length - 1]
  );
}

export function getPollutantStatus(
  pollutant: PollutantKey,
  value: number
): "good" | "warning" | "danger" {
  const t = POLLUTANT_THRESHOLDS[pollutant];
  if (value >= t.dangerLevel)  return "danger";
  if (value >= t.warningLevel) return "warning";
  return "good";
}

export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi",
  });
}

export function formatHour(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-KE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Nairobi",
  });
}
