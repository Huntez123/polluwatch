import Link from "next/link";
import { formatTimestamp } from "@/lib/utils";

interface Measurement {
  aqi: number;
  category: string;
  dominant_pollutant: string;
  measured_at: string;
  pm25: number; pm10: number; co: number; no2: number; o3: number; so2: number;
}

interface Props {
  city: { name: string; measurement: Measurement | null };
}

function getAqiColorClass(aqi: number) {
  if (aqi <= 50) return "text-aqi-good";
  if (aqi <= 100) return "text-aqi-moderate";
  if (aqi <= 150) return "text-aqi-sensitive";
  if (aqi <= 200) return "text-aqi-unhealthy";
  if (aqi <= 300) return "text-aqi-very";
  return "text-aqi-hazardous";
}

export function KenyaCityCard({ city }: Props) {
  const { name, measurement } = city;

  if (!measurement) {
    return (
      <div className="border-t border-stone-200 pt-6">
        <h3 className="text-2xl font-serif text-stone-900 mb-2">{name}</h3>
        <p className="text-sm font-sans text-stone-500 italic">Awaiting first reading…</p>
      </div>
    );
  }

  return (
    <div className="border-t border-stone-200 pt-6 group">
      <div className="flex justify-between items-start mb-4">
        <div>
          <Link href={`/cities/${name}`} className="block">
            <h3 className="text-2xl font-serif text-stone-900 group-hover:underline underline-offset-4 decoration-stone-300 transition-all">
              {name}
            </h3>
          </Link>
          <p className="text-xs font-sans text-stone-500 mt-1 uppercase tracking-widest">
            {formatTimestamp(measurement.measured_at)}
          </p>
        </div>
        <div className="text-right">
          <div className={`text-4xl font-serif leading-none ${getAqiColorClass(measurement.aqi)}`}>
            {measurement.aqi}
          </div>
          <div className="text-[10px] font-sans uppercase tracking-widest text-stone-400 mt-1">
            {measurement.category}
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-y-4 gap-x-2 mt-6">
        {[
          { label: 'PM2.5', value: measurement.pm25 },
          { label: 'PM10', value: measurement.pm10 },
          { label: 'O₃', value: measurement.o3 },
        ].map((p) => (
          <div key={p.label}>
            <div className="text-[10px] font-sans uppercase tracking-widest text-stone-400 mb-1">{p.label}</div>
            <div className="font-sans text-stone-800 text-sm">
              {p.value.toFixed(1)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
