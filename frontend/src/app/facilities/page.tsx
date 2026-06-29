import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/NavBar";
import type { DbFacility } from "@/types";

function FacilityCard({ facility }: { facility: DbFacility }) {
  const isCement    = facility.industry_type === "Cement manufacturing";
  const isGasTurbine = facility.industry_type.includes("gas turbine");

  return (
    <Link href={`/facilities/${facility.slug}`} className="block group">
      <div className="border-t border-stone-200 pt-6 pb-4 group-hover:border-stone-400 transition-colors">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 pr-4">
            <h3 className="text-2xl font-serif text-stone-900 group-hover:underline underline-offset-4 decoration-stone-300 leading-tight mb-1">
              {facility.name}
            </h3>
            <p className="text-xs font-sans text-stone-500 uppercase tracking-widest">
              {facility.county} County
            </p>
          </div>
          {facility.is_demo && (
            <span className="shrink-0 text-[10px] font-sans uppercase tracking-widest border border-stone-300 text-stone-500 px-2 py-1">
              Demo
            </span>
          )}
        </div>

        <p className="text-sm font-sans text-stone-600 mb-4">
          {facility.industry_type}
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] font-sans uppercase tracking-widest text-stone-400 mb-1">
              Module
            </div>
            <div className="text-sm font-sans text-stone-800">
              {isCement    ? "AI Sensor Calibration"      :
               isGasTurbine ? "Predictive Emissions (PEMS)" :
               "Emissions Monitoring"}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-sans uppercase tracking-widest text-stone-400 mb-1">
              PM2.5 Limit
            </div>
            <div className="text-sm font-sans text-stone-800">
              {facility.permit_pm25} µg/m³
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default async function FacilitiesPage() {
  const sb = await createClient();
  const { data } = await sb
    .from("facilities")
    .select("*")
    .eq("is_active", true)
    .order("name");

  const facilities = (data ?? []) as DbFacility[];

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-sage-100">

      <NavBar active="facilities" />

      <main className="max-w-[1400px] mx-auto px-6 py-16 md:px-12 lg:px-24">

        {/* Section header */}
        <header className="mb-16 border-b border-stone-200 pb-12">
          <p className="text-stone-500 font-sans uppercase tracking-[0.2em] text-sm mb-4">
            Proof of Concept
          </p>
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-serif text-stone-900 leading-none tracking-tight mb-6">
            Industrial Compliance
          </h1>
          <p className="text-xl text-stone-600 font-serif italic max-w-2xl">
            Demonstrating two AI approaches for low-cost industrial emissions monitoring
            using only free, public data. No physical sensors required.
          </p>
          <div className="mt-8 p-6 border border-stone-300 bg-stone-100 max-w-3xl">
            <p className="text-sm font-sans text-stone-600 leading-relaxed">
              <strong className="font-semibold text-stone-800">Proof-of-concept scope:</strong>{" "}
              All data on this page is either (a) real ambient measurements from public APIs
              used as a stand-in for reference instruments, (b) mathematically simulated
              sensor readings based on documented error models, or (c) real published research
              data from non-Kenyan sources used to validate the modelling approach.
              No proprietary sensor data has been used. Each facility page clearly states its
              data provenance.
            </p>
          </div>
        </header>

        {/* Facility cards */}
        {facilities.length === 0 ? (
          <p className="text-stone-500 font-sans italic">
            No facilities found. Run the SQL schema file in Supabase first.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-x-16 gap-y-4 max-w-4xl">
            {facilities.map(f => (
              <FacilityCard key={f.slug} facility={f} />
            ))}
          </div>
        )}

        {/* Module summaries */}
        <div className="mt-24 grid md:grid-cols-2 gap-16 border-t border-stone-200 pt-16">
          <div>
            <p className="text-xs font-sans uppercase tracking-widest text-stone-500 mb-3">Module A</p>
            <h2 className="text-3xl font-serif text-stone-900 mb-4">AI Sensor Calibration</h2>
            <p className="text-stone-600 font-sans leading-relaxed">
              Cheap optical PM sensors (PMS5003/PMS7003 class, ~$15) suffer predictable
              biases: humidity over-read, baseline drift, and read noise. A
              RandomForest model trained during a short co-location window with a
              reference instrument can correct these errors, recovering near-reference
              accuracy for continuous fence-line monitoring.
            </p>
          </div>
          <div>
            <p className="text-xs font-sans uppercase tracking-widest text-stone-500 mb-3">Module B</p>
            <h2 className="text-3xl font-serif text-stone-900 mb-4">Predictive PEMS</h2>
            <p className="text-stone-600 font-sans leading-relaxed">
              Certified Emission Monitoring Systems (CEMS) analysers cost upward of
              $50,000. This module demonstrates that an XGBoost model trained on cheap
              process variables (temperature, pressure, humidity) can predict CO and
              NOX concentrations with high accuracy, validated on real published gas
              turbine data from a Turkish plant (UCI repository).
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-stone-200 mt-24 py-12 text-center px-6">
        <p className="font-serif text-stone-500 text-lg italic mb-2">PolluWatch — Global Air Quality Intelligence</p>
        <p className="text-sm font-sans uppercase tracking-widest text-stone-400">Powered by Open-Meteo, UCI ML Repository & Supabase</p>
      </footer>
    </div>
  );
}
