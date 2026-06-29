import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SensorCalibrationChart } from "@/components/facilities/SensorCalibrationChart";
import { EmissionsChart } from "@/components/facilities/EmissionsChart";
import type { DbFacility, BoundaryReading, EmissionEstimate } from "@/types";
import type { CalibrationPoint } from "@/components/facilities/SensorCalibrationChart";
import type { EmissionPoint } from "@/components/facilities/EmissionsChart";

// ── Metric helpers ────────────────────────────────────────────────────────────

function rmse(actuals: number[], predictions: number[]): number {
  if (actuals.length === 0) return 0;
  const mse = actuals.reduce((s, a, i) => s + (a - predictions[i]) ** 2, 0) / actuals.length;
  return Math.sqrt(mse);
}

function r2(actuals: number[], predictions: number[]): number {
  if (actuals.length === 0) return 0;
  const mean  = actuals.reduce((s, a) => s + a, 0) / actuals.length;
  const ssTot = actuals.reduce((s, a) => s + (a - mean) ** 2, 0);
  const ssRes = actuals.reduce((s, a, i) => s + (a - predictions[i]) ** 2, 0);
  return ssTot === 0 ? 0 : 1 - ssRes / ssTot;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, highlight = false }: {
  label: string; value: string; highlight?: boolean;
}) {
  return (
    <div className={`border p-5 ${highlight ? "border-stone-900 bg-stone-900 text-stone-50" : "border-stone-200 bg-white"}`}>
      <p className={`text-[10px] font-sans uppercase tracking-widest mb-2 ${highlight ? "text-stone-400" : "text-stone-500"}`}>
        {label}
      </p>
      <p className={`text-3xl font-serif leading-none ${highlight ? "text-stone-50" : "text-stone-900"}`}>
        {value}
      </p>
    </div>
  );
}

function DisclaimerBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-stone-300 bg-stone-100 p-5 text-sm font-sans text-stone-600 leading-relaxed">
      {children}
    </div>
  );
}

function ComplianceBanner({ label, value, limit, unit, limitSource }: {
  label: string; value: number | null; limit: number; unit: string; limitSource: string;
}) {
  if (value === null) return null;
  const compliant = value <= limit;
  return (
    <div className={`border p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4
      ${compliant ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}>
      <div>
        <p className="text-xs font-sans uppercase tracking-widest text-stone-500 mb-1">
          Compliance — {label}
        </p>
        <p className={`text-2xl font-serif ${compliant ? "text-green-800" : "text-red-800"}`}>
          {compliant ? "Within Limit" : "Exceedance Detected"}
        </p>
        <p className="text-sm font-sans text-stone-600 mt-1">{limitSource}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-4xl font-serif leading-none ${compliant ? "text-green-700" : "text-red-700"}`}>
          {value.toFixed(2)}
        </p>
        <p className="text-xs font-sans text-stone-500 mt-1 uppercase tracking-widest">{unit}</p>
        <p className="text-xs font-sans text-stone-500">Limit: {limit} {unit}</p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function FacilityPage({ params }: Props) {
  const { slug } = await params;
  const sb = await createClient();

  const { data: fac } = await sb
    .from("facilities")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!fac) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-900">
        <div className="text-center">
          <h1 className="text-4xl font-serif mb-4">Facility Not Found</h1>
          <p className="text-stone-500 font-sans mb-6">No facility with slug "{slug}" exists.</p>
          <Link href="/facilities" className="text-stone-900 underline font-sans text-sm">← Back to Facilities</Link>
        </div>
      </div>
    );
  }

  const facility = fac as DbFacility;
  const isCement    = facility.industry_type === "Cement manufacturing";
  const isGasTurbine = facility.industry_type.includes("gas turbine");

  // ── Fetch calibration data (cement plant) ──
  let calibRows: BoundaryReading[] = [];
  if (isCement) {
    const { data } = await sb
      .from("boundary_calibrated_readings")
      .select("*")
      .eq("facility_id", facility.id)
      .eq("pollutant", "pm25")
      .order("measured_at", { ascending: true });
    calibRows = (data ?? []) as BoundaryReading[];
  }

  // ── Fetch emissions data (gas turbine) ──
  let coRows: EmissionEstimate[]  = [];
  let noxRows: EmissionEstimate[] = [];
  if (isGasTurbine) {
    const [coRes, noxRes] = await Promise.all([
      sb.from("emission_estimates").select("*")
        .eq("facility_id", facility.id).eq("pollutant", "CO")
        .order("sample_index", { ascending: true }),
      sb.from("emission_estimates").select("*")
        .eq("facility_id", facility.id).eq("pollutant", "NOX")
        .order("sample_index", { ascending: true }),
    ]);
    coRows  = (coRes.data  ?? []) as EmissionEstimate[];
    noxRows = (noxRes.data ?? []) as EmissionEstimate[];
  }

  // ── Compute calibration metrics (test split only) ──
  const testRows    = calibRows.filter(r => r.split === "test");
  const rawVsRef    = rmse(testRows.map(r => r.reference_value), testRows.map(r => r.raw_value));
  const calVsRef    = rmse(testRows.map(r => r.reference_value), testRows.map(r => r.calibrated_value));
  const pctImprove  = rawVsRef > 0 ? ((1 - calVsRef / rawVsRef) * 100) : 0;

  // Latest calibrated PM2.5 for compliance check
  const latestCalib = calibRows.length > 0 ? calibRows[calibRows.length - 1].calibrated_value : null;

  // ── Compute emissions metrics ──
  const coActuals   = coRows.filter(r => r.actual_value != null).map(r => r.actual_value as number);
  const coPreds     = coRows.filter(r => r.actual_value != null).map(r => r.predicted_value);
  const noxActuals  = noxRows.filter(r => r.actual_value != null).map(r => r.actual_value as number);
  const noxPreds    = noxRows.filter(r => r.actual_value != null).map(r => r.predicted_value);

  const r2CO   = r2(coActuals, coPreds);
  const rmseCI  = rmse(coActuals, coPreds);
  const r2NOX  = r2(noxActuals, noxPreds);
  const rmseNOX = rmse(noxActuals, noxPreds);

  const latestCO  = coRows.length  > 0 ? coRows[coRows.length - 1].predicted_value   : null;
  const latestNOX = noxRows.length > 0 ? noxRows[noxRows.length - 1].predicted_value : null;

  // ── Chart data ──
  const calibChartData: CalibrationPoint[] = calibRows.map(r => ({
    time:       r.measured_at,
    reference:  r.reference_value,
    raw:        r.raw_value,
    calibrated: r.calibrated_value,
    split:      r.split,
  }));

  const coChartData: EmissionPoint[] = coRows.map(r => ({
    index:     r.sample_index,
    actual:    r.actual_value ?? 0,
    predicted: r.predicted_value,
  }));

  const noxChartData: EmissionPoint[] = noxRows.map(r => ({
    index:     r.sample_index,
    actual:    r.actual_value ?? 0,
    predicted: r.predicted_value,
  }));

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-sage-100">

      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-6 md:px-12 lg:px-20 bg-stone-900 text-stone-50">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-sage-500 rounded-full" />
          <Link href="/"><span className="font-serif text-xl font-bold tracking-tight text-stone-50">PolluWatch.</span></Link>
        </div>
        <div className="flex gap-8 text-xs font-medium uppercase tracking-widest text-stone-400">
          <Link href="/" className="hover:text-stone-50 transition-colors">Overview</Link>
          <Link href="/explore" className="hover:text-stone-50 transition-colors">Air Quality</Link>
          <Link href="/facilities" className="text-stone-50 border-b border-sage-500 pb-0.5">Facilities</Link>
        </div>
      </nav>

      {/* Header */}
      <header className="px-6 py-16 md:px-12 lg:px-24 border-b border-stone-200">
        <div className="max-w-5xl mx-auto">
          <p className="text-stone-400 font-sans uppercase tracking-widest text-sm mb-2">
            <Link href="/facilities" className="hover:text-stone-600 transition-colors">Facilities</Link>
            {" / "}Industrial Compliance — Proof of Concept
          </p>
          <h1 className="text-5xl md:text-6xl font-serif text-stone-900 leading-tight tracking-tight mb-4">
            {facility.name}
          </h1>
          <div className="flex flex-wrap gap-4 mt-4">
            <span className="text-xs font-sans border border-stone-300 px-3 py-1.5 text-stone-600 uppercase tracking-widest">
              {facility.industry_type}
            </span>
            {facility.county && (
              <span className="text-xs font-sans border border-stone-300 px-3 py-1.5 text-stone-600 uppercase tracking-widest">
                {facility.county} County
              </span>
            )}
            {facility.is_demo && (
              <span className="text-xs font-sans border border-stone-400 bg-stone-200 px-3 py-1.5 text-stone-700 uppercase tracking-widest">
                Demo / Proof of Concept
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="px-6 py-16 md:px-12 lg:px-24 max-w-5xl mx-auto space-y-20">

        {/* ── MODULE A: CEMENT PLANT ─────────────────────────────────────── */}
        {isCement && (
          <>
            <DisclaimerBox>
              <strong className="text-stone-800">Data provenance:</strong> Reference PM2.5/PM10
              values are real hourly measurements from the{" "}
              <strong>Open-Meteo air-quality API</strong> for coordinates lat −1.431349,
              lng 36.961717 (Athi River). These serve as the "reference instrument" in
              this demo. Cheap-sensor readings are <em>mathematically simulated</em> on
              top of this real data using documented PMS5003/PMS7003 error models
              (humidity cross-sensitivity, drift, noise). The AI correction model is a
              RandomForest trained on a chronological 70/30 split.
            </DisclaimerBox>

            <section>
              <h2 className="text-3xl font-serif mb-3 text-stone-800 border-b border-stone-200 pb-4">
                Module A — AI Sensor Calibration: PM2.5
              </h2>
              <p className="text-stone-500 font-sans text-sm mb-8">
                Test-set metrics (last 30 % of 6-day window). Lower RMSE = less error.
                {calibRows.length === 0 && (
                  <span className="ml-2 italic text-stone-400">
                    No data yet — run <code className="bg-stone-100 px-1">python src/calibration_demo.py</code>
                  </span>
                )}
              </p>
              <div className="grid grid-cols-3 gap-4 mb-10">
                <StatCard
                  label="Raw RMSE (uncalibrated)"
                  value={testRows.length > 0 ? `${rawVsRef.toFixed(3)} µg/m³` : "—"}
                />
                <StatCard
                  label="Calibrated RMSE (AI)"
                  value={testRows.length > 0 ? `${calVsRef.toFixed(3)} µg/m³` : "—"}
                />
                <StatCard
                  label="Error Reduction"
                  value={testRows.length > 0 ? `${pctImprove.toFixed(1)}%` : "—"}
                  highlight={testRows.length > 0}
                />
              </div>
              <div className="h-[420px] w-full">
                <SensorCalibrationChart data={calibChartData} pollutant="PM2.5" unit="µg/m³" />
              </div>
              <p className="text-xs font-sans text-stone-400 mt-4 leading-relaxed">
                <strong>Chart legend:</strong>{" "}
                <span style={{ color: "#1c1917" }}>■</span> Reference instrument &nbsp;
                <span style={{ color: "#c28e5c" }}>– –</span> Raw sensor (biased) &nbsp;
                <span style={{ color: "#8ba390" }}>■</span> AI-calibrated output.
                Dashed vertical line marks the calibration → test period boundary.
              </p>
            </section>

            <ComplianceBanner
              label="PM2.5 (AI-calibrated, latest reading)"
              value={latestCalib}
              limit={facility.permit_pm25}
              unit="µg/m³"
              limitSource={`NEMA permit limit for this facility: ${facility.permit_pm25} µg/m³`}
            />
          </>
        )}

        {/* ── MODULE B: GAS TURBINE ─────────────────────────────────────── */}
        {isGasTurbine && (
          <>
            <DisclaimerBox>
              <strong className="text-stone-800">Data provenance:</strong> This model is
              trained and validated on the{" "}
              <strong>UCI "Gas Turbine CO and NOx Emission Data Set"</strong> — real
              hourly measurements from an actual gas turbine plant in{" "}
              <strong>Turkey (2011–2015)</strong>, published by Kaya et al. (2019).
              No public Kenyan equivalent dataset exists. KenGen is used as the
              <em> example deployment target only</em>. Actual deployment at a KenGen
              facility would require KenGen's own operational historian data.
              <br /><br />
              <em>
                "Trained and validated on real published gas turbine data (Turkey, UCI
                repository) to prove the method; no equivalent public Kenyan dataset exists
                yet — next step is partnering with a local plant for their own data."
              </em>
            </DisclaimerBox>

            <section>
              <h2 className="text-3xl font-serif mb-3 text-stone-800 border-b border-stone-200 pb-4">
                Module B — Predictive PEMS: Carbon Monoxide (CO)
              </h2>
              <p className="text-stone-500 font-sans text-sm mb-8">
                XGBRegressor trained on 3 years, evaluated on 2-year test set.
                {coRows.length === 0 && (
                  <span className="ml-2 italic text-stone-400">
                    No data yet — run <code className="bg-stone-100 px-1">python src/pems_demo.py</code>
                  </span>
                )}
              </p>
              <div className="grid grid-cols-2 gap-4 mb-10">
                <StatCard
                  label="R² (CO)"
                  value={coRows.length > 0 ? r2CO.toFixed(4) : "—"}
                  highlight={coRows.length > 0}
                />
                <StatCard
                  label="RMSE (CO)"
                  value={coRows.length > 0 ? `${rmseCI.toFixed(4)} mg/Nm³` : "—"}
                />
              </div>
              <div className="h-[380px] w-full">
                <EmissionsChart data={coChartData} pollutant="CO" unit="mg/Nm³" />
              </div>
            </section>

            <section>
              <h2 className="text-3xl font-serif mb-3 text-stone-800 border-b border-stone-200 pb-4">
                Module B — Predictive PEMS: Nitrogen Oxides (NOX)
              </h2>
              <div className="grid grid-cols-2 gap-4 mb-10">
                <StatCard
                  label="R² (NOX)"
                  value={noxRows.length > 0 ? r2NOX.toFixed(4) : "—"}
                  highlight={noxRows.length > 0}
                />
                <StatCard
                  label="RMSE (NOX)"
                  value={noxRows.length > 0 ? `${rmseNOX.toFixed(4)} mg/Nm³` : "—"}
                />
              </div>
              <div className="h-[380px] w-full">
                <EmissionsChart data={noxChartData} pollutant="NOX" unit="mg/Nm³" />
              </div>
            </section>

            {/* Compliance: compare against example EU IED limits for gas turbines */}
            <div className="space-y-4">
              <ComplianceBanner
                label="CO (latest predicted, example limit)"
                value={latestCO}
                limit={100}
                unit="mg/Nm³"
                limitSource="Compared against EU IED 2010/75 example limit for new gas turbines (100 mg/Nm³); Kenya-specific regulations pending."
              />
              <ComplianceBanner
                label="NOX (latest predicted, example limit)"
                value={latestNOX}
                limit={50}
                unit="mg/Nm³"
                limitSource="Compared against EU IED 2010/75 example limit for new gas turbines (50 mg/Nm³); Kenya-specific regulations pending."
              />
            </div>
          </>
        )}

        {/* Fallback for unknown facility type */}
        {!isCement && !isGasTurbine && (
          <p className="text-stone-500 font-sans italic">
            No visualisation module is configured for industry type "{facility.industry_type}".
          </p>
        )}
      </main>

      <footer className="border-t border-stone-200 mt-24 py-12 text-center px-6">
        <p className="font-serif text-stone-500 text-lg italic mb-2">PolluWatch — Industrial Compliance Module</p>
        <p className="text-sm font-sans uppercase tracking-widest text-stone-400">
          Data: Open-Meteo (real) · UCI ML Repository (real, Turkey) · Simulated sensor errors
        </p>
      </footer>
    </div>
  );
}
