"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatHour } from "@/lib/utils";
import type { PredictionPoint } from "@/types";

interface Props {
  data: PredictionPoint[];
}

function getAqiColorHex(aqi: number) {
  if (aqi <= 50) return "#8ba390";
  if (aqi <= 100) return "#d8a45e";
  if (aqi <= 150) return "#c28e5c";
  if (aqi <= 200) return "#c26d5c";
  if (aqi <= 300) return "#8b6d85";
  return "#5c3a3a";
}

export function ForecastChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-stone-400 font-sans text-sm italic border border-stone-200">
        No predictions available yet.
      </div>
    );
  }

  const chartData = data.map((p) => ({
    time:  formatHour(p.predictedFor),
    AQI:   p.predictedAqi,
    color: getAqiColorHex(p.predictedAqi),
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
        <XAxis 
          dataKey="time" 
          tick={{ fontSize: 12, fill: "#a8a29e", fontFamily: "var(--font-sans)" }} 
          interval={2} 
          tickLine={false}
          axisLine={false}
          dy={10}
        />
        <YAxis 
          domain={[0, "auto"]} 
          tick={{ fontSize: 12, fill: "#a8a29e", fontFamily: "var(--font-sans)" }} 
          width={35} 
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{ fontSize: 14, borderRadius: 0, border: "1px solid #e7e5e4", backgroundColor: "#fcfcfc", fontFamily: "var(--font-sans)", color: "#1c1917", padding: "12px" }}
          formatter={(val: number) => [`AQI ${val}`, "Predicted"]}
          cursor={{ fill: "#f5f5f4" }}
        />
        <Bar dataKey="AQI" radius={0}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
