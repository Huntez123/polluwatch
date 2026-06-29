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
  ReferenceLine,
} from "recharts";

export interface CalibrationPoint {
  time: string;
  reference: number;
  raw: number;
  calibrated: number;
  split: string;
}

interface Props {
  data: CalibrationPoint[];
  pollutant?: string;
  unit?: string;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-KE", {
    weekday: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "Africa/Nairobi",
  });
}

export function SensorCalibrationChart({ data, pollutant = "PM2.5", unit = "µg/m³" }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-stone-400 font-sans text-sm italic border border-stone-200">
        Run calibration_demo.py to generate data.
      </div>
    );
  }

  // Find where the test split begins so we can mark it
  const splitIdx = data.findIndex(d => d.split === "test");
  const splitTime = splitIdx >= 0 ? data[splitIdx].time : null;

  const chartData = data.map(d => ({
    time:       fmt(d.time),
    Reference:  d.reference,
    Raw:        d.raw,
    Calibrated: d.calibrated,
    split:      d.split,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
        <XAxis
          dataKey="time"
          tick={{ fontSize: 11, fill: "#a8a29e", fontFamily: "var(--font-sans)" }}
          interval={Math.floor(data.length / 6)}
          tickLine={false}
          axisLine={false}
          dy={10}
        />
        <YAxis
          domain={["auto", "auto"]}
          tick={{ fontSize: 11, fill: "#a8a29e", fontFamily: "var(--font-sans)" }}
          width={40}
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
          formatter={(val: number, name: string) => [`${val.toFixed(2)} ${unit}`, name]}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, fontFamily: "var(--font-sans)", paddingTop: 12 }}
        />
        {/* Mark calibration → test boundary */}
        {splitTime && (
          <ReferenceLine
            x={fmt(splitTime)}
            stroke="#a8a29e"
            strokeDasharray="4 4"
            label={{
              value: "▶ Test period",
              fontSize: 10,
              fill: "#78716c",
              position: "insideTopRight",
            }}
          />
        )}
        {/* Reference instrument (ground truth) */}
        <Line
          type="monotone"
          dataKey="Reference"
          stroke="#1c1917"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3 }}
        />
        {/* Cheap sensor (uncalibrated) — shows bias */}
        <Line
          type="monotone"
          dataKey="Raw"
          stroke="#c28e5c"
          strokeWidth={1.5}
          strokeDasharray="4 2"
          dot={false}
          activeDot={{ r: 3 }}
        />
        {/* AI-calibrated output */}
        <Line
          type="monotone"
          dataKey="Calibrated"
          stroke="#8ba390"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
