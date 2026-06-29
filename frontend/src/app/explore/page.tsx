import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/NavBar";
import { DashboardClient } from "@/components/DashboardClient";
import type { DbLocation, HistoricalPoint, PredictionPoint } from "@/types";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ city?: string }>;
}

export default async function ExplorePage({ searchParams }: Props) {
  const { city = "Nairobi" } = await searchParams;
  const supabase = await createClient();

  // All active locations for the city selector
  const { data: locations } = await supabase
    .from("locations")
    .select("id, name, lat, lng, is_active, created_at")
    .eq("is_active", true)
    .order("name");

  const allLocations = (locations ?? []) as DbLocation[];

  const selected =
    allLocations.find((l) => l.name.toLowerCase() === city.toLowerCase()) ??
    allLocations[0];

  const locationId = selected?.id ?? 0;

  // Latest measurement
  const { data: latestRows } = await supabase
    .from("aqi_measurements")
    .select("*")
    .eq("location_id", locationId)
    .order("measured_at", { ascending: false })
    .limit(1);

  const latest = latestRows?.[0] ?? null;

  // 48-hour history for the trend chart
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: historyRows } = await supabase
    .from("aqi_measurements")
    .select("measured_at, aqi, pm25, pm10, co, no2, o3, so2")
    .eq("location_id", locationId)
    .gte("measured_at", cutoff)
    .order("measured_at", { ascending: true });

  const history: HistoricalPoint[] = (historyRows ?? []).map((r) => ({
    date:  r.measured_at as string,
    aqi:   r.aqi as number,
    pm25:  r.pm25 as number,
    pm10:  r.pm10 as number,
    co:    r.co as number,
    no2:   r.no2 as number,
    o3:    r.o3 as number,
    so2:   r.so2 as number,
  }));

  // Next 24-hour predictions
  const { data: predRows } = await supabase
    .from("aqi_predictions")
    .select("predicted_for, predicted_aqi, category")
    .eq("location_id", locationId)
    .gte("predicted_for", new Date().toISOString())
    .order("predicted_for", { ascending: true })
    .limit(24);

  const predictions: PredictionPoint[] = (predRows ?? []).map((p) => ({
    predictedFor: p.predicted_for as string,
    predictedAqi: p.predicted_aqi as number,
    category:     p.category as string,
  }));

  return (
    <div className="min-h-screen bg-stone-50">
      <NavBar active="explore" />
      <header className="px-6 py-8 border-b border-stone-200">
        <h1 className="text-3xl sm:text-5xl font-serif text-stone-900 mb-2">Air Quality Explorer</h1>
        <p className="text-stone-500 font-sans max-w-2xl text-lg">
          Real-time analytics and historical trends across our monitored Kenyan cities.
        </p>
      </header>
      <main className="px-6 py-12">
        <DashboardClient
          key={selected?.name}
          locations={allLocations}
          selectedCity={selected?.name ?? "Nairobi"}
          initialLatest={latest}
          initialHistory={history}
          initialPredictions={predictions}
        />
      </main>
    </div>
  );
}
