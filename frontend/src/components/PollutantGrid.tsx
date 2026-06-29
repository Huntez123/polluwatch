"use client";

import { POLLUTANT_LABELS } from "@/lib/constants";
import type { PollutantData, PollutantKey } from "@/types";

interface Props {
  measurement: PollutantData;
}

export function PollutantGrid({ measurement }: Props) {
  const keys: PollutantKey[] = ["pm25", "pm10", "co", "no2", "o3", "so2"];

  return (
    <div className="border-t border-stone-200 pt-6">
      <h3 className="font-sans uppercase tracking-widest text-sm text-stone-500 mb-6">Pollutant Concentration</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-y-12 gap-x-8">
        {keys.map((key) => {
          const { label, unit } = POLLUTANT_LABELS[key];
          const value  = measurement[key];
          return (
            <div key={key} className="border-b border-stone-200 pb-4">
              <div className="text-xs font-sans uppercase tracking-widest text-stone-500 mb-2">{label}</div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-serif text-stone-900">{value.toFixed(1)}</span>
                <span className="text-xs font-sans text-stone-400">{unit}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
