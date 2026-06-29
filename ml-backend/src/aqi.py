"""
aqi.py — Pure AQI calculation functions (no I/O, no external deps).

Uses US EPA piecewise linear interpolation:
  I = (I_hi - I_lo) / (C_hi - C_lo) * (C - C_lo) + I_lo

Input units expected by calculate_aqi():
  pm25   µg/m³   (as returned by Open-Meteo, no conversion needed)
  pm10   µg/m³   (as returned by Open-Meteo, no conversion needed)
  co_ppm   ppm   (Open-Meteo returns µg/m³ — divide by 1145.0)
  no2_ppb  ppb   (Open-Meteo returns µg/m³ — divide by 1.912)
  o3_ppb   ppb   (Open-Meteo returns µg/m³ — divide by 1.96)
  so2_ppb  ppb   (Open-Meteo returns µg/m³ — divide by 2.62)
"""

from typing import Optional

# (C_lo, C_hi, I_lo, I_hi) breakpoints
_BREAKPOINTS: dict[str, list[tuple]] = {
    "pm25": [
        (0.0,   12.0,   0,  50),
        (12.1,  35.4,  51, 100),
        (35.5,  55.4, 101, 150),
        (55.5, 150.4, 151, 200),
        (150.5, 250.4, 201, 300),
        (250.5, 350.4, 301, 400),
        (350.5, 500.4, 401, 500),
    ],
    "pm10": [
        (0,    54,   0,  50),
        (55,  154,  51, 100),
        (155, 254, 101, 150),
        (255, 354, 151, 200),
        (355, 424, 201, 300),
        (425, 504, 301, 400),
        (505, 604, 401, 500),
    ],
    "o3_ppb": [
        (0,   54,   0,  50),
        (55,  70,  51, 100),
        (71,  85, 101, 150),
        (86, 105, 151, 200),
        (106, 200, 201, 300),
    ],
    "co_ppm": [
        (0.0,  4.4,   0,  50),
        (4.5,  9.4,  51, 100),
        (9.5, 12.4, 101, 150),
        (12.5, 15.4, 151, 200),
        (15.5, 30.4, 201, 300),
        (30.5, 40.4, 301, 400),
        (40.5, 50.4, 401, 500),
    ],
    "no2_ppb": [
        (0,    53,   0,  50),
        (54,  100,  51, 100),
        (101, 360, 101, 150),
        (361, 649, 151, 200),
        (650, 1249, 201, 300),
        (1250, 1649, 301, 400),
        (1650, 2049, 401, 500),
    ],
    "so2_ppb": [
        (0,   35,   0,  50),
        (36,  75,  51, 100),
        (76, 185, 101, 150),
        (186, 304, 151, 200),
        (305, 604, 201, 300),
        (605, 804, 301, 400),
        (805, 1004, 401, 500),
    ],
}


def _sub_index(concentration: float, key: str) -> int:
    for (c_lo, c_hi, i_lo, i_hi) in _BREAKPOINTS[key]:
        if c_lo <= concentration <= c_hi:
            return round((i_hi - i_lo) / (c_hi - c_lo) * (concentration - c_lo) + i_lo)
    return 500


def calculate_aqi(
    pm25: float,
    pm10: float,
    co_ppm: float,
    no2_ppb: float,
    o3_ppb: float,
    so2_ppb: float,
) -> tuple[int, str]:
    """
    Returns (overall_aqi, dominant_pollutant_key).
    dominant_pollutant_key is one of: pm25, pm10, co, no2, o3, so2
    """
    sub_indices = {
        "pm25": _sub_index(pm25,    "pm25"),
        "pm10": _sub_index(pm10,    "pm10"),
        "co":   _sub_index(co_ppm,  "co_ppm"),
        "no2":  _sub_index(no2_ppb, "no2_ppb"),
        "o3":   _sub_index(o3_ppb,  "o3_ppb"),
        "so2":  _sub_index(so2_ppb, "so2_ppb"),
    }
    dominant = max(sub_indices, key=lambda k: sub_indices[k])
    return sub_indices[dominant], dominant


def aqi_category(aqi: int) -> str:
    if aqi <= 50:   return "Good"
    if aqi <= 100:  return "Moderate"
    if aqi <= 150:  return "Unhealthy for Sensitive Groups"
    if aqi <= 200:  return "Unhealthy"
    if aqi <= 300:  return "Very Unhealthy"
    return "Hazardous"


# Unit conversions from Open-Meteo µg/m³ to AQI input units
def co_to_ppm(ugm3: Optional[float]) -> float:
    return (ugm3 or 0.0) / 1145.0


def no2_to_ppb(ugm3: Optional[float]) -> float:
    return (ugm3 or 0.0) / 1.912


def o3_to_ppb(ugm3: Optional[float]) -> float:
    return (ugm3 or 0.0) / 1.96


def so2_to_ppb(ugm3: Optional[float]) -> float:
    return (ugm3 or 0.0) / 2.62
