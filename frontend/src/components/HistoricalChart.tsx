"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { formatHour } from "@/lib/utils";
import type { HistoricalPoint } from "@/types";

interface Props {
  data: HistoricalPoint[];
}

export function HistoricalChart({ data }: Props) {
  const chartData = data.map((d) => ({
    time: formatHour(d.date),
    AQI:  d.aqi,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
        <XAxis
          dataKey="time"
          tick={{ fontSize: 12, fill: "#a8a29e", fontFamily: "var(--font-sans)" }}
          interval="preserveStartEnd"
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
          formatter={(val: number) => [`AQI ${val}`, ""]}
        />
        <ReferenceLine y={100} stroke="#d8a45e" strokeDasharray="4 4" label={{ value: "Moderate", fontSize: 11, fill: "#d8a45e", position: 'insideTopLeft' }} />
        <ReferenceLine y={150} stroke="#c28e5c" strokeDasharray="4 4" label={{ value: "Sensitive", fontSize: 11, fill: "#c28e5c", position: 'insideTopLeft' }} />
        <Line
          type="monotone"
          dataKey="AQI"
          stroke="#1c1917"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#1c1917", stroke: "none" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
