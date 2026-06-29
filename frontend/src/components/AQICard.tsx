"use client";

import { formatTimestamp } from "@/lib/utils";
import { POLLUTANT_LABELS } from "@/lib/constants";
import type { PollutantKey } from "@/types";

interface Props {
  aqi: number;
  category: string;
  dominantPollutant: string;
  measuredAt: string;
}

function getAqiColorClass(aqi: number) {
  if (aqi <= 50) return "text-aqi-good";
  if (aqi <= 100) return "text-aqi-moderate";
  if (aqi <= 150) return "text-aqi-sensitive";
  if (aqi <= 200) return "text-aqi-unhealthy";
  if (aqi <= 300) return "text-aqi-very";
  return "text-aqi-hazardous";
}

export function AQICard({ aqi, category, dominantPollutant, measuredAt }: Props) {
  const pollutantLabel = POLLUTANT_LABELS[dominantPollutant as PollutantKey]?.label ?? dominantPollutant.toUpperCase();

  return (
    <div className="border-t border-stone-200 pt-6">
      <h3 className="font-sans uppercase tracking-widest text-sm text-stone-500 mb-6">Current AQI</h3>
      <div className={`text-8xl font-serif leading-none tracking-tighter ${getAqiColorClass(aqi)}`}>
        {aqi}
      </div>
      <div className="mt-4 text-stone-900 font-serif text-2xl">
        {category}
      </div>
      <div className="mt-6 text-sm font-sans text-stone-600 space-y-1">
        <p>Dominant Pollutant: <span className="text-stone-900 font-medium">{pollutantLabel}</span></p>
        <p className="text-stone-400 uppercase tracking-widest text-xs mt-2">{formatTimestamp(measuredAt)}</p>
      </div>
    </div>
  );
}
