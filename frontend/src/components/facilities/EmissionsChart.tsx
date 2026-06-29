"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export interface EmissionPoint {
  index: number;
  actual: number;
  predicted: number;
}

interface Props {
  data: EmissionPoint[];
  pollutant: string;
  unit: string;
}

export function EmissionsChart({ data, pollutant, unit }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-stone-400 font-sans text-sm italic border border-stone-200">
        Run pems_demo.py to generate data.
      </div>
    );
  }

  const chartData = data.map((d, i) => ({
    n:         i + 1,
    Actual:    d.actual,
    Predicted: d.predicted,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
        <XAxis
          dataKey="n"
          tick={{ fontSize: 11, fill: "#a8a29e", fontFamily: "var(--font-sans)" }}
          interval={Math.floor(data.length / 5)}
          tickLine={false}
          axisLine={false}
          dy={10}
          label={{
            value: "Test sample",
            position: "insideBottom",
            offset: -2,
            fontSize: 11,
            fill: "#a8a29e",
            fontFamily: "var(--font-sans)",
          }}
        />
        <YAxis
          domain={["auto", "auto"]}
          tick={{ fontSize: 11, fill: "#a8a29e", fontFamily: "var(--font-sans)" }}
          width={44}
          tickLine={false}
          axisLine={false}
          tickFormatter={v => `${v}`}
        />
        <Tooltip
          contentStyle={{
            fontSize: 13, borderRadius: 0, border: "1px solid #e7e5e4",
            backgroundColor: "#fcfcfc", fontFamily: "var(--font-sans)",
            color: "#1c1917", padding: "10px 14px",
          }}
          formatter={(val: number, name: string) => [`${val.toFixed(3)} ${unit}`, name]}
          labelFormatter={n => `Sample ${n}`}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, fontFamily: "var(--font-sans)", paddingTop: 12 }}
        />
        <Line
          type="monotone"
          dataKey="Actual"
          stroke="#1c1917"
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 3 }}
        />
        <Line
          type="monotone"
          dataKey="Predicted"
          stroke="#8ba390"
          strokeWidth={2}
          strokeDasharray="3 2"
          dot={false}
          activeDot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
