import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { POLLUTANT_THRESHOLDS } from "@/lib/constants";
import type { AlertRecord, PollutantKey } from "@/types";

export async function GET(req: NextRequest) {
  const location = req.nextUrl.searchParams.get("location") ?? "Nairobi";
  const supabase = await createClient();

  const { data: loc } = await supabase
    .from("locations")
    .select("id, name")
    .ilike("name", location)
    .single();

  if (!loc) return NextResponse.json({ data: [] });

  const { data: rows } = await supabase
    .from("aqi_measurements")
    .select("*")
    .eq("location_id", loc.id)
    .order("measured_at", { ascending: false })
    .limit(1);

  const row = rows?.[0];
  if (!row) return NextResponse.json({ data: [] });

  const alerts: AlertRecord[] = [];
  const keys: PollutantKey[] = ["pm25", "pm10", "co", "no2", "o3", "so2"];

  for (const key of keys) {
    const value = row[key] as number;
    const t = POLLUTANT_THRESHOLDS[key];
    if (value >= t.dangerLevel) {
      alerts.push({ pollutant: key, threshold: t.dangerLevel, value, alertLevel: "danger", locationName: loc.name, measuredAt: row.measured_at });
    } else if (value >= t.warningLevel) {
      alerts.push({ pollutant: key, threshold: t.warningLevel, value, alertLevel: "warning", locationName: loc.name, measuredAt: row.measured_at });
    }
  }

  return NextResponse.json({ data: alerts });
}
