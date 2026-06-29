// TypeScript AQI calculation — mirrors ml-backend/src/aqi.py exactly

type Breakpoint = [number, number, number, number]; // [cLo, cHi, iLo, iHi]

const BP: Record<string, Breakpoint[]> = {
  pm25: [
    [0.0,   12.0,   0,  50], [12.1,  35.4,  51, 100],
    [35.5,  55.4, 101, 150], [55.5, 150.4, 151, 200],
    [150.5, 250.4, 201, 300], [250.5, 500.4, 301, 500],
  ],
  pm10: [
    [0,  54,   0,  50], [55,  154,  51, 100],
    [155, 254, 101, 150], [255, 354, 151, 200],
    [355, 424, 201, 300], [425, 604, 301, 500],
  ],
  o3: [
    [0, 54, 0, 50], [55, 70, 51, 100],
    [71, 85, 101, 150], [86, 105, 151, 200], [106, 200, 201, 300],
  ],
  co: [
    [0.0, 4.4, 0, 50], [4.5, 9.4, 51, 100],
    [9.5, 12.4, 101, 150], [12.5, 15.4, 151, 200],
    [15.5, 30.4, 201, 300], [30.5, 50.4, 301, 500],
  ],
  no2: [
    [0, 53, 0, 50], [54, 100, 51, 100],
    [101, 360, 101, 150], [361, 649, 151, 200],
    [650, 1249, 201, 300], [1250, 2049, 301, 500],
  ],
  so2: [
    [0, 35, 0, 50], [36, 75, 51, 100],
    [76, 185, 101, 150], [186, 304, 151, 200],
    [305, 604, 201, 300], [605, 1004, 301, 500],
  ],
};

function subIndex(c: number, key: string): number {
  for (const [cLo, cHi, iLo, iHi] of BP[key]) {
    if (c >= cLo && c <= cHi)
      return Math.round(((iHi - iLo) / (cHi - cLo)) * (c - cLo) + iLo);
  }
  return 500;
}

export interface PollutantRaw {
  pm25: number; pm10: number;
  co: number; no2: number; o3: number; so2: number; // all in µg/m³
}

export function calculateAQI(v: PollutantRaw): { aqi: number; dominant: string } {
  const sub: Record<string, number> = {
    pm25: subIndex(v.pm25,          "pm25"),
    pm10: subIndex(v.pm10,          "pm10"),
    co:   subIndex(v.co  / 1145.0,  "co"),
    no2:  subIndex(v.no2 / 1.912,   "no2"),
    o3:   subIndex(v.o3  / 1.96,    "o3"),
    so2:  subIndex(v.so2 / 2.62,    "so2"),
  };
  const dominant = Object.entries(sub).sort((a, b) => b[1] - a[1])[0][0];
  return { aqi: sub[dominant], dominant };
}
