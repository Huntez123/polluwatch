import Link from "next/link";
import type { GlobalResult } from "@/app/page";

interface Props {
  city: GlobalResult;
}

// ── AQI color helper (editorial theme) ──
function getAqiColorClass(aqi: number | null) {
  if (aqi === null) return "text-stone-400";
  if (aqi <= 50) return "text-aqi-good";
  if (aqi <= 100) return "text-aqi-moderate";
  if (aqi <= 150) return "text-aqi-sensitive";
  if (aqi <= 200) return "text-aqi-unhealthy";
  if (aqi <= 300) return "text-aqi-very";
  return "text-aqi-hazardous";
}

export function GlobalCityCard({ city }: Props) {
  return (
    <div className="flex items-start justify-between group">
      <div>
        <Link href={`/cities/${city.name}`} className="block">
          <h4 className="text-xl font-serif text-stone-900 mb-1 group-hover:underline underline-offset-4 decoration-stone-300 transition-all">
            {city.name}, {city.country}
          </h4>
        </Link>
        {city.pm25 !== null && (
          <p className="text-sm font-sans text-stone-500">
            PM2.5: {city.pm25.toFixed(1)} µg/m³
          </p>
        )}
      </div>
      <div className="text-right pl-4">
        <div className={`text-3xl font-serif leading-none ${getAqiColorClass(city.aqi)}`}>
          {city.aqi !== null ? city.aqi : "—"}
        </div>
        <div className="text-[10px] font-sans uppercase tracking-widest text-stone-400 mt-1">
          AQI
        </div>
      </div>
    </div>
  );
}
