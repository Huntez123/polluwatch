import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/NavBar";
import type { DbFacility } from "@/types";

// ── Metric helpers ─────────────────────────────────────────────────────────────

function computeRMSE(actuals: number[], preds: number[]) {
  if (!actuals.length) return 0;
  return Math.sqrt(actuals.reduce((s, a, i) => s + (a - preds[i]) ** 2, 0) / actuals.length);
}

function computeR2(actuals: number[], preds: number[]) {
  if (!actuals.length) return 0;
  const mean = actuals.reduce((s, a) => s + a, 0) / actuals.length;
  const ssTot = actuals.reduce((s, a) => s + (a - mean) ** 2, 0);
  const ssRes = actuals.reduce((s, a, i) => s + (a - preds[i]) ** 2, 0);
  return ssTot === 0 ? 0 : 1 - ssRes / ssTot;
}

function aqiColorClass(aqi: number) {
  if (aqi <= 50)  return "text-aqi-good";
  if (aqi <= 100) return "text-aqi-moderate";
  if (aqi <= 150) return "text-aqi-sensitive";
  if (aqi <= 200) return "text-aqi-unhealthy";
  if (aqi <= 300) return "text-aqi-very";
  return "text-aqi-hazardous";
}

// ── Data fetching ──────────────────────────────────────────────────────────────

async function getCalibMetrics(sb: Awaited<ReturnType<typeof createClient>>, facilityId: number) {
  const [latestRes, testRes] = await Promise.all([
    sb.from("boundary_calibrated_readings")
      .select("calibrated_value, reference_value, raw_value, measured_at")
      .eq("facility_id", facilityId).eq("pollutant", "pm25")
      .order("measured_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("boundary_calibrated_readings")
      .select("reference_value, raw_value, calibrated_value")
      .eq("facility_id", facilityId).eq("pollutant", "pm25").eq("split", "test"),
  ]);
  if (!latestRes.data) return null;
  const rows = testRes.data ?? [];
  const rmseRaw = computeRMSE(rows.map(r => r.reference_value), rows.map(r => r.raw_value));
  const rmseCal = computeRMSE(rows.map(r => r.reference_value), rows.map(r => r.calibrated_value));
  const pctImprove = rmseRaw > 0 ? (1 - rmseCal / rmseRaw) * 100 : 0;
  return {
    latestPM25:  latestRes.data.calibrated_value as number,
    latestRef:   latestRes.data.reference_value  as number,
    measuredAt:  latestRes.data.measured_at       as string,
    rmseRaw, rmseCal, pctImprove,
    rowCount: rows.length,
  };
}

async function getEmissionsMetrics(sb: Awaited<ReturnType<typeof createClient>>, facilityId: number) {
  const [latestCO, latestNOX, coSample, noxSample] = await Promise.all([
    sb.from("emission_estimates")
      .select("predicted_value, actual_value")
      .eq("facility_id", facilityId).eq("pollutant", "CO")
      .order("sample_index", { ascending: false }).limit(1).maybeSingle(),
    sb.from("emission_estimates")
      .select("predicted_value, actual_value")
      .eq("facility_id", facilityId).eq("pollutant", "NOX")
      .order("sample_index", { ascending: false }).limit(1).maybeSingle(),
    sb.from("emission_estimates")
      .select("actual_value, predicted_value")
      .eq("facility_id", facilityId).eq("pollutant", "CO").limit(200),
    sb.from("emission_estimates")
      .select("actual_value, predicted_value")
      .eq("facility_id", facilityId).eq("pollutant", "NOX").limit(200),
  ]);
  if (!latestCO.data) return null;
  const coRows  = (coSample.data  ?? []).filter(r => r.actual_value != null);
  const noxRows = (noxSample.data ?? []).filter(r => r.actual_value != null);
  return {
    latestCO:  latestCO.data.predicted_value  as number,
    latestNOX: latestNOX.data?.predicted_value as number | null,
    r2CO:   computeR2(coRows.map(r => r.actual_value!),  coRows.map(r => r.predicted_value)),
    r2NOX:  computeR2(noxRows.map(r => r.actual_value!), noxRows.map(r => r.predicted_value)),
    rmseNOX: computeRMSE(noxRows.map(r => r.actual_value!), noxRows.map(r => r.predicted_value)),
  };
}

const KENYA_CITY_NAMES = ["Eldoret", "Kisumu", "Mombasa", "Nairobi", "Nakuru"];

async function getKenyaCities(sb: Awaited<ReturnType<typeof createClient>>) {
  try {
    const { data: locs } = await sb.from("locations").select("id,name").eq("is_active", true).in("name", KENYA_CITY_NAMES).order("name");
    if (!locs?.length) return [];
    return Promise.all(locs.map(async loc => {
      const { data } = await sb.from("aqi_measurements")
        .select("aqi,category,pm25,measured_at")
        .eq("location_id", loc.id)
        .order("measured_at", { ascending: false }).limit(1).maybeSingle();
      return { name: loc.name as string, aqi: data?.aqi as number | null, pm25: data?.pm25 as number | null, category: data?.category as string | null };
    }));
  } catch { return []; }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function CompliancePill({ value, limit, unit }: { value: number; limit: number; unit: string }) {
  const ok = value <= limit;
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 border text-xs font-sans font-semibold uppercase tracking-wider mt-4
      ${ok ? "border-green-400 bg-green-50 text-green-800" : "border-red-400 bg-red-50 text-red-800"}`}>
      <span className={`w-2 h-2 rounded-full ${ok ? "bg-green-500" : "bg-red-500"}`} />
      {ok ? "Within Limit" : "Exceedance"}
      <span className="font-normal opacity-70 ml-1">{value.toFixed(2)} / {limit} {unit}</span>
    </div>
  );
}

function PendingPill() {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-stone-300 bg-stone-100 text-xs font-sans text-stone-500 uppercase tracking-wider mt-4">
      <span className="w-2 h-2 rounded-full bg-stone-400 animate-pulse" />
      Awaiting data
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const sb = await createClient();

  const { data: facs } = await sb.from("facilities").select("*").eq("is_active", true);
  const eapcc  = (facs ?? []).find((f: DbFacility) => f.slug === "eapcc-athi-river")  as DbFacility | undefined;
  const kengen = (facs ?? []).find((f: DbFacility) => f.slug === "kengen-gas-turbine-demo") as DbFacility | undefined;

  const [calibMetrics, emissMetrics, kenyaCities] = await Promise.all([
    eapcc  ? getCalibMetrics(sb, eapcc.id)    : Promise.resolve(null),
    kengen ? getEmissionsMetrics(sb, kengen.id) : Promise.resolve(null),
    getKenyaCities(sb),
  ]);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans">

      <NavBar active="overview" />

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <div className="bg-stone-900 text-stone-50 px-6 pt-16 pb-20 md:px-12 lg:px-20">
        <div className="max-w-5xl mx-auto">
          <p className="text-sage-500 font-sans text-xs uppercase tracking-[0.25em] mb-5">
            Kenya · Industrial Environmental Intelligence
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-serif leading-[0.95] tracking-tight mb-6 text-stone-50">
            AI-Powered<br />Emissions Monitoring
          </h1>
          <p className="text-stone-400 text-xl font-serif italic max-w-2xl mb-10">
            No $50,000 analysers. No permanent sensors on site. Just public data and machine learning — proving the approach is ready for Kenyan industry.
          </p>
          <div className="flex flex-wrap gap-4">
            <span className="border border-stone-700 text-stone-300 text-xs font-sans px-4 py-2 uppercase tracking-widest">
              2 Demo Facilities
            </span>
            <span className="border border-stone-700 text-stone-300 text-xs font-sans px-4 py-2 uppercase tracking-widest">
              Real Public Data
            </span>
            <span className="border border-stone-700 text-stone-300 text-xs font-sans px-4 py-2 uppercase tracking-widest">
              Open-Meteo · UCI ML Repository
            </span>
          </div>
        </div>
      </div>

      {/* ── Facility Status Cards ───────────────────────────────────── */}
      <section className="px-6 md:px-12 lg:px-20 py-16 max-w-7xl mx-auto">
        <div className="flex items-baseline justify-between mb-10">
          <h2 className="text-3xl font-serif text-stone-900">Live Facility Status</h2>
          <Link href="/facilities" className="text-xs font-sans uppercase tracking-widest text-stone-500 hover:text-stone-900 underline underline-offset-4 transition-colors">
            All Facilities →
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-8">

          {/* ── MODULE A: EAPCC ─────────────────────────────────────── */}
          <div className="border border-stone-200 bg-white p-8 flex flex-col">
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-sage-500 font-semibold mb-1">
                  Module A · Sensor Calibration
                </p>
                <h3 className="text-xl font-serif text-stone-900 leading-snug">
                  East African Portland Cement Co.<br />
                  <span className="font-sans text-base font-normal text-stone-500">Athi River Plant · Machakos County</span>
                </h3>
              </div>
              <span className="shrink-0 border border-stone-200 text-[10px] font-sans uppercase tracking-widest text-stone-400 px-2 py-1">Demo</span>
            </div>

            {calibMetrics ? (
              <>
                <div className="flex items-end gap-5 mb-1">
                  <span className="text-7xl font-serif text-stone-900 leading-none">
                    {calibMetrics.latestPM25.toFixed(1)}
                  </span>
                  <div className="pb-1 text-stone-500">
                    <p className="text-sm font-sans font-medium">µg/m³ PM2.5</p>
                    <p className="text-xs font-sans">AI-calibrated</p>
                  </div>
                </div>
                <CompliancePill value={calibMetrics.latestPM25} limit={eapcc!.permit_pm25} unit="µg/m³" />
                <div className="mt-6 pt-6 border-t border-stone-100 grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-[10px] font-sans uppercase tracking-widest text-stone-400 mb-1">Error Reduced</p>
                    <p className="text-2xl font-serif text-stone-900">{calibMetrics.pctImprove.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-sans uppercase tracking-widest text-stone-400 mb-1">Raw RMSE</p>
                    <p className="text-2xl font-serif text-stone-900">{calibMetrics.rmseRaw.toFixed(2)}</p>
                    <p className="text-[10px] text-stone-400">µg/m³</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-sans uppercase tracking-widest text-stone-400 mb-1">Cal. RMSE</p>
                    <p className="text-2xl font-serif text-stone-900">{calibMetrics.rmseCal.toFixed(2)}</p>
                    <p className="text-[10px] text-stone-400">µg/m³</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col justify-center py-8">
                <PendingPill />
                <p className="text-sm font-sans text-stone-400 mt-4 italic">
                  Run <code className="bg-stone-100 text-stone-700 px-1.5 py-0.5 text-xs">python src/calibration_demo.py</code> to activate
                </p>
              </div>
            )}

            <Link
              href="/facilities/eapcc-athi-river"
              className="mt-6 pt-4 border-t border-stone-100 text-xs font-sans uppercase tracking-widest text-stone-500 hover:text-stone-900 transition-colors flex items-center justify-between group"
            >
              View Full Analysis
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>

          {/* ── MODULE B: KENGEN ────────────────────────────────────── */}
          <div className="border border-stone-200 bg-white p-8 flex flex-col">
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-ochre-500 font-semibold mb-1">
                  Module B · Predictive PEMS
                </p>
                <h3 className="text-xl font-serif text-stone-900 leading-snug">
                  KenGen Gas Turbine Unit — Demo<br />
                  <span className="font-sans text-base font-normal text-stone-500">Power Generation · Nairobi</span>
                </h3>
              </div>
              <span className="shrink-0 border border-stone-200 text-[10px] font-sans uppercase tracking-widest text-stone-400 px-2 py-1">Demo</span>
            </div>

            {emissMetrics ? (
              <>
                <div className="flex items-end gap-5 mb-1">
                  <span className="text-7xl font-serif text-stone-900 leading-none">
                    {emissMetrics.latestCO.toFixed(3)}
                  </span>
                  <div className="pb-1 text-stone-500">
                    <p className="text-sm font-sans font-medium">mg/Nm³ CO</p>
                    <p className="text-xs font-sans">AI-predicted</p>
                  </div>
                </div>
                <CompliancePill value={emissMetrics.latestCO} limit={100} unit="mg/Nm³" />
                <div className="mt-6 pt-6 border-t border-stone-100 grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-[10px] font-sans uppercase tracking-widest text-stone-400 mb-1">CO R²</p>
                    <p className="text-2xl font-serif text-stone-900">{emissMetrics.r2CO.toFixed(3)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-sans uppercase tracking-widest text-stone-400 mb-1">NOX R²</p>
                    <p className="text-2xl font-serif text-stone-900">{emissMetrics.r2NOX.toFixed(3)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-sans uppercase tracking-widest text-stone-400 mb-1">NOX RMSE</p>
                    <p className="text-2xl font-serif text-stone-900">{emissMetrics.rmseNOX.toFixed(2)}</p>
                    <p className="text-[10px] text-stone-400">mg/Nm³</p>
                  </div>
                </div>
                <p className="mt-4 text-xs font-sans text-stone-400 italic">
                  Trained on UCI Gas Turbine dataset (Turkey, 2011–2015). KenGen is the example deployment target; training data is real but foreign.
                </p>
              </>
            ) : (
              <div className="flex-1 flex flex-col justify-center py-8">
                <PendingPill />
                <p className="text-sm font-sans text-stone-400 mt-4 italic">
                  Run <code className="bg-stone-100 text-stone-700 px-1.5 py-0.5 text-xs">python src/pems_demo.py</code> to activate
                </p>
              </div>
            )}

            <Link
              href="/facilities/kengen-gas-turbine-demo"
              className="mt-6 pt-4 border-t border-stone-100 text-xs font-sans uppercase tracking-widest text-stone-500 hover:text-stone-900 transition-colors flex items-center justify-between group"
            >
              View Full Analysis
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────────── */}
      <section className="px-6 md:px-12 lg:px-20 py-16 border-t border-stone-200">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-serif text-stone-900 mb-2">How It Works</h2>
          <p className="text-stone-500 font-sans mb-12">
            Two modules. Two problems. One goal: affordable industrial compliance for Kenya.
          </p>

          {/* Module A row */}
          <div className="grid md:grid-cols-2 gap-px bg-stone-200 mb-px">
            {/* Plain language */}
            <div className="bg-white p-8">
              <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-sage-500 font-semibold mb-3">Module A — For Everyone</p>
              <h3 className="text-2xl font-serif text-stone-900 mb-4">Teaching a $15 Sensor to Behave Like a $5,000 One</h3>
              <p className="text-stone-600 font-sans leading-relaxed">
                Cheap optical air sensors read PM2.5 levels along factory fence lines, but they over-read when the air is humid, drift over time, and have random spikes. Instead of replacing them with expensive lab-grade monitors, we run the cheap sensor alongside a reference instrument for just 5 days. Our AI learns the difference and corrects it permanently — cutting measurement error by over <strong>80 %</strong> in this demo.
              </p>
              <div className="mt-6 flex gap-3 flex-wrap">
                <span className="bg-sage-100 text-sage-800 text-xs font-sans px-3 py-1">Humidity cross-sensitivity</span>
                <span className="bg-sage-100 text-sage-800 text-xs font-sans px-3 py-1">Baseline drift correction</span>
                <span className="bg-sage-100 text-sage-800 text-xs font-sans px-3 py-1">Spike removal</span>
              </div>
            </div>
            {/* Technical */}
            <div className="bg-stone-900 text-stone-100 p-6 sm:p-8 font-mono text-xs sm:text-sm leading-relaxed overflow-x-auto">
              <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-sans mb-4">Module A — Technical Specification</p>
              <div className="space-y-3 text-stone-300">
                <p><span className="text-stone-500">Algorithm    </span>RandomForestRegressor (200 trees, max_depth=8)</p>
                <p><span className="text-stone-500">Features     </span>[raw_pm25, relative_humidity, temperature_C, sensor_age_days]</p>
                <p><span className="text-stone-500">Split        </span>Chronological 70 % co-location / 30 % field-test</p>
                <p><span className="text-stone-500">Reference    </span>Open-Meteo Air Quality API (real, public, no key)</p>
                <p><span className="text-stone-500">Sensor model </span>PMS5003/PMS7003 error simulation (Jayaratne 2018, Rai 2017)</p>
                <p><span className="text-stone-500">Facility     </span>EAPCC Athi River, Machakos, lat −1.431349 lng 36.962</p>
                {calibMetrics && (
                  <>
                    <div className="border-t border-stone-700 pt-3 mt-3">
                      <p><span className="text-stone-500">RMSE raw     </span><span className="text-ochre-500">{calibMetrics.rmseRaw.toFixed(3)} µg/m³</span></p>
                      <p><span className="text-stone-500">RMSE cal.    </span><span className="text-sage-500">{calibMetrics.rmseCal.toFixed(3)} µg/m³</span></p>
                      <p><span className="text-stone-500">Reduction    </span><span className="text-sage-500 font-bold">{calibMetrics.pctImprove.toFixed(1)} %  ★</span></p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Module B row */}
          <div className="grid md:grid-cols-2 gap-px bg-stone-200">
            {/* Plain language */}
            <div className="bg-white p-8">
              <p className="text-[10px] font-sans uppercase tracking-[0.2em] text-ochre-500 font-semibold mb-3">Module B — For Everyone</p>
              <h3 className="text-2xl font-serif text-stone-900 mb-4">Predicting Factory Emissions Without a $50,000 Analyser</h3>
              <p className="text-stone-600 font-sans leading-relaxed">
                A certified gas analyser on every stack costs $50,000+ and needs constant maintenance. Our AI predicts CO and NOX emissions just from things the factory already measures: inlet air temperature, pressure, and humidity. Validated on 5 years of real gas turbine data (7,384 hourly readings from an actual plant), the model achieves R² above 0.98 — meaning it explains over 98 % of the variance in real emissions.
              </p>
              <div className="mt-6 flex gap-3 flex-wrap">
                <span className="bg-stone-100 text-stone-700 text-xs font-sans px-3 py-1">No stack analyser needed</span>
                <span className="bg-stone-100 text-stone-700 text-xs font-sans px-3 py-1">9 process variables</span>
                <span className="bg-stone-100 text-stone-700 text-xs font-sans px-3 py-1">Real published data</span>
              </div>
            </div>
            {/* Technical */}
            <div className="bg-stone-900 text-stone-100 p-6 sm:p-8 font-mono text-xs sm:text-sm leading-relaxed overflow-x-auto">
              <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-sans mb-4">Module B — Technical Specification</p>
              <div className="space-y-3 text-stone-300">
                <p><span className="text-stone-500">Algorithm    </span>XGBRegressor (300 trees, lr=0.05, max_depth=6)</p>
                <p><span className="text-stone-500">Features     </span>[AT, AP, AH, AFDP, GTEP, TIT, TAT, TEY, CDP]</p>
                <p><span className="text-stone-500">Targets      </span>CO (mg/Nm³), NOX (mg/Nm³)</p>
                <p><span className="text-stone-500">Split        </span>Chronological 60 % train (≈3 yr) / 40 % test (≈2 yr)</p>
                <p><span className="text-stone-500">Dataset      </span>UCI Gas Turbine dataset id=551 (Turkey, 2011–2015)</p>
                <p><span className="text-stone-500">Facility     </span>KenGen Gas Turbine — example deployment target only</p>
                {emissMetrics && (
                  <div className="border-t border-stone-700 pt-3 mt-3">
                    <p><span className="text-stone-500">CO  R²       </span><span className="text-sage-500 font-bold">{emissMetrics.r2CO.toFixed(4)}  ★</span></p>
                    <p><span className="text-stone-500">NOX R²       </span><span className="text-sage-500 font-bold">{emissMetrics.r2NOX.toFixed(4)}  ★</span></p>
                    <p><span className="text-stone-500">NOX RMSE     </span>{emissMetrics.rmseNOX.toFixed(4)} mg/Nm³</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Ambient Air Quality Strip ─────────────────────────────────── */}
      <section className="px-6 md:px-12 lg:px-20 py-16 border-t border-stone-200 bg-stone-100">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-baseline justify-between mb-8">
            <div>
              <h2 className="text-3xl font-serif text-stone-900">Ambient Air Quality</h2>
              <p className="text-stone-500 font-sans text-sm mt-1">Live readings from 5 Kenyan cities — updated hourly</p>
            </div>
            <Link href="/explore" className="text-xs font-sans uppercase tracking-widest text-stone-500 hover:text-stone-900 underline underline-offset-4 transition-colors">
              Explore All →
            </Link>
          </div>

          {kenyaCities.length === 0 ? (
            <p className="text-stone-400 font-sans text-sm italic">
              No city data yet — run <code className="bg-white px-1">python src/ingestion.py</code>
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {kenyaCities.map(city => (
                <Link key={city.name} href={`/cities/${city.name}`} className="group">
                  <div className="bg-white border border-stone-200 p-5 hover:border-stone-400 transition-colors">
                    <p className="text-xs font-sans uppercase tracking-widest text-stone-500 mb-3 group-hover:text-stone-700 transition-colors">
                      {city.name}
                    </p>
                    {city.aqi != null ? (
                      <>
                        <p className={`text-4xl font-serif leading-none ${aqiColorClass(city.aqi)}`}>
                          {city.aqi}
                        </p>
                        <p className="text-[10px] font-sans text-stone-400 mt-1 uppercase tracking-widest">AQI</p>
                        <p className="text-xs font-sans text-stone-500 mt-2">
                          PM2.5: {city.pm25?.toFixed(1)} µg/m³
                        </p>
                        <p className="text-[10px] font-sans text-stone-400 mt-1">{city.category}</p>
                      </>
                    ) : (
                      <p className="text-sm font-sans text-stone-400 italic mt-2">Awaiting reading…</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="bg-stone-900 text-stone-400 px-6 md:px-12 lg:px-20 py-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2.5 h-2.5 bg-sage-500 rounded-full" />
              <span className="font-serif text-stone-50 text-lg font-bold">PolluWatch.</span>
            </div>
            <p className="text-sm font-sans text-stone-500">AI-Powered Industrial Environmental Intelligence for Kenya</p>
          </div>
          <div className="flex flex-col items-start md:items-end gap-2">
            <p className="text-xs font-sans uppercase tracking-widest">Data Sources</p>
            <p className="text-xs text-stone-500">Open-Meteo API · UCI ML Repository · Supabase</p>
            <p className="text-xs text-stone-600 italic">All industrial facility data is proof-of-concept. No proprietary data used.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
