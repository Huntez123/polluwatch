import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { HistoricalChart } from "@/components/HistoricalChart";
import { ForecastChart } from "@/components/ForecastChart";
import { PollutantGrid } from "@/components/PollutantGrid";
import { calculateAQI } from "@/lib/aqi";

// Helper function
function getAqiColorClass(aqi: number) {
  if (aqi <= 50) return "text-aqi-good";
  if (aqi <= 100) return "text-aqi-moderate";
  if (aqi <= 150) return "text-aqi-sensitive";
  if (aqi <= 200) return "text-aqi-unhealthy";
  if (aqi <= 300) return "text-aqi-very";
  return "text-aqi-hazardous";
}

interface Props {
  params: Promise<{ city: string }>;
}

export default async function CityPage({ params }: Props) {
  const { city } = await params;
  const decodedCity = decodeURIComponent(city);
  const supabase = await createClient();

  const { data: location } = await supabase
    .from("locations")
    .select("*")
    .ilike("name", decodedCity)
    .single();

  if (!location) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-900">
        <div className="text-center">
          <h1 className="text-4xl font-serif mb-4">City Not Found</h1>
          <p className="text-stone-500 font-sans">We couldn't find data for {decodedCity}.</p>
        </div>
      </div>
    );
  }

  // Fetch latest measurement
  const { data: latestRows } = await supabase
    .from("aqi_measurements")
    .select("*")
    .eq("location_id", location.id)
    .order("measured_at", { ascending: false })
    .limit(1);

  const latest = latestRows?.[0];

  // Fetch history
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: historyRows } = await supabase
    .from("aqi_measurements")
    .select("measured_at, aqi, pm25, pm10, co, no2, o3, so2")
    .eq("location_id", location.id)
    .gte("measured_at", cutoff)
    .order("measured_at", { ascending: true });

  // Predictions
  const { data: predRows } = await supabase
    .from("aqi_predictions")
    .select("predicted_for, predicted_aqi, category")
    .eq("location_id", location.id)
    .gte("predicted_for", new Date().toISOString())
    .order("predicted_for", { ascending: true })
    .limit(24);

  const history = historyRows?.map(r => ({
    date: r.measured_at,
    aqi: r.aqi,
    pm25: r.pm25,
    pm10: r.pm10,
    co: r.co,
    no2: r.no2,
    o3: r.o3,
    so2: r.so2
  })) || [];

  const predictions = predRows?.map(p => ({
    predictedFor: p.predicted_for,
    predictedAqi: p.predicted_aqi,
    category: p.category
  })) || [];


  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-sage-100">

      <nav className="flex items-center justify-between px-6 py-6 md:px-12 lg:px-20 bg-stone-900 text-stone-50">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-sage-500 rounded-full" />
          <Link href="/"><span className="font-serif text-xl font-bold tracking-tight text-stone-50">PolluWatch.</span></Link>
        </div>
        <div className="flex gap-8 text-xs font-medium uppercase tracking-widest text-stone-400">
          <Link href="/" className="hover:text-stone-50 transition-colors">Overview</Link>
          <Link href="/explore" className="text-stone-50 border-b border-sage-500 pb-0.5">Air Quality</Link>
          <Link href="/facilities" className="hover:text-stone-50 transition-colors">Facilities</Link>
        </div>
      </nav>

      {/* Header section - Magazine style */}
      <header className="px-6 py-16 md:px-12 lg:px-24 border-b border-stone-200">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-end gap-12">
          <div>
            <p className="text-stone-400 font-sans uppercase tracking-widest text-sm mb-4">Location Report</p>
            <h1 className="text-6xl md:text-8xl font-serif text-stone-900 leading-none tracking-tight">
              {location.name}
            </h1>
            <p className="mt-4 text-stone-500 font-serif text-xl italic max-w-lg">
              Air quality insights and historical tracking.
            </p>
          </div>
          
          {latest && (
            <div className="text-right">
              <p className="text-stone-400 text-sm uppercase tracking-widest mb-2">Current AQI</p>
              <div className={`text-7xl md:text-9xl font-serif leading-none tracking-tighter ${getAqiColorClass(latest.aqi)}`}>
                {latest.aqi}
              </div>
              <p className="text-xl font-sans font-medium text-stone-600 mt-2">{latest.category}</p>
            </div>
          )}
        </div>
      </header>

      <main className="px-6 py-16 md:px-12 lg:px-24 max-w-7xl mx-auto space-y-24">
        
        {/* Current Pollutants */}
        {latest && (
          <section>
            <h2 className="text-3xl font-serif mb-8 text-stone-800 border-b border-stone-200 pb-4">Detailed Breakdown</h2>
            <PollutantGrid measurement={latest} />
          </section>
        )}

        {/* Charts side by side or stacked */}
        <div className="grid md:grid-cols-2 gap-12">
          <section>
            <h2 className="text-3xl font-serif mb-8 text-stone-800 border-b border-stone-200 pb-4">48-Hour History</h2>
            <div className="h-[400px] w-full">
              <HistoricalChart data={history} />
            </div>
          </section>

          <section>
            <h2 className="text-3xl font-serif mb-8 text-stone-800 border-b border-stone-200 pb-4">24-Hour Forecast</h2>
            <div className="h-[400px] w-full">
              <ForecastChart data={predictions} />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
