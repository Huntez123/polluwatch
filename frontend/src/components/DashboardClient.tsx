"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AQICard } from "./AQICard";
import { HistoricalChart } from "./HistoricalChart";
import { ForecastChart } from "./ForecastChart";
import { PollutantGrid } from "./PollutantGrid";
import type { DbLocation, DbMeasurement, HistoricalPoint, PredictionPoint } from "@/types";

interface Props {
  locations: DbLocation[];
  selectedCity: string;
  initialLatest: DbMeasurement | null;
  initialHistory: HistoricalPoint[];
  initialPredictions: PredictionPoint[];
}

export function DashboardClient({
  locations,
  selectedCity,
  initialLatest,
  initialHistory,
  initialPredictions,
}: Props) {
  const router = useRouter();
  const [latest, setLatest] = useState<DbMeasurement | null>(initialLatest);

  useEffect(() => {
    setLatest(initialLatest);
  }, [initialLatest]);

  useEffect(() => {
    const supabase = createClient();
    const locationId = locations.find((l) => l.name === selectedCity)?.id;
    if (!locationId) return;

    const channel = supabase
      .channel(`measurements-${locationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "aqi_measurements",
          filter: `location_id=eq.${locationId}`,
        },
        (payload) => {
          setLatest(payload.new as DbMeasurement);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedCity, locations]);

  function handleCityChange(city: string) {
    router.push(`/explore?city=${encodeURIComponent(city)}`);
  }

  const pollutantData = latest
    ? { pm25: latest.pm25, pm10: latest.pm10, co: latest.co, no2: latest.no2, o3: latest.o3, so2: latest.so2 }
    : null;

  return (
    <div className="max-w-7xl mx-auto space-y-16">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 sm:gap-0 border-b border-stone-200 pb-4">
        <h2 className="text-3xl font-serif text-stone-900">Live Telemetry</h2>
        <select
          value={selectedCity}
          onChange={(e) => handleCityChange(e.target.value)}
          className="border-b border-stone-900 bg-transparent py-1 pr-8 text-lg font-serif text-stone-900 focus:outline-none focus:ring-0 appearance-none rounded-none cursor-pointer"
          style={{ backgroundImage: "url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%231c1917%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')", backgroundRepeat: "no-repeat", backgroundPosition: "right 0.3rem top 50%", backgroundSize: "0.65rem auto" }}
        >
          {locations.map((l) => (
            <option key={l.id} value={l.name}>{l.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-4">
          {latest ? (
            <AQICard
              aqi={latest.aqi}
              category={latest.category}
              dominantPollutant={latest.dominant_pollutant}
              measuredAt={latest.measured_at}
            />
          ) : (
            <div className="h-48 bg-stone-200 animate-pulse" />
          )}
        </div>

        <div className="lg:col-span-8">
          {pollutantData ? (
            <PollutantGrid measurement={pollutantData as any} />
          ) : (
            <div className="h-48 bg-stone-200 animate-pulse" />
          )}
        </div>

        <div className="lg:col-span-6">
          <h3 className="font-sans uppercase tracking-widest text-sm text-stone-500 mb-6">48-Hour Historical Trend</h3>
          <div className="h-[400px]">
            <HistoricalChart data={initialHistory} />
          </div>
        </div>

        <div className="lg:col-span-6">
          <h3 className="font-sans uppercase tracking-widest text-sm text-stone-500 mb-6">Machine Learning Forecast</h3>
          <div className="h-[400px]">
            <ForecastChart data={initialPredictions as any} />
          </div>
        </div>
      </div>
    </div>
  );
}
