"""
ingestion.py
Fetches hourly air quality from Open-Meteo for ALL active locations stored in
Supabase and upserts into aqi_measurements.

Usage:
  python src/ingestion.py        ← run once manually
  Called by main.py every hour.

Adding a new city: INSERT a row into the `locations` table in Supabase —
no code change needed.
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import logging
import requests
from datetime import datetime, timedelta

from config.supabase_config import supabase
from src.aqi import calculate_aqi, aqi_category, co_to_ppm, no2_to_ppb, o3_to_ppb, so2_to_ppb

logging.basicConfig(level=logging.INFO, format="[ingestion] %(levelname)s %(message)s")
log = logging.getLogger(__name__)

OPENMETEO_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"


def fetch_locations() -> list[dict]:
    """Return all active locations from Supabase."""
    result = (
        supabase.table("locations")
        .select("id,name,lat,lng")
        .eq("is_active", True)
        .execute()
    )
    return result.data or []


def ingest_location(location: dict) -> None:
    loc_id = location["id"]
    name   = location["name"]
    lat    = location["lat"]
    lng    = location["lng"]

    params = {
        "latitude":      lat,
        "longitude":     lng,
        "hourly":        "pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,ozone,sulphur_dioxide",
        "timezone":      "auto",
        "past_days":     2,
        "forecast_days": 1,
    }

    try:
        r = requests.get(OPENMETEO_URL, params=params, timeout=20)
        r.raise_for_status()
        data = r.json()
    except Exception as exc:
        log.error(f"{name}: HTTP error — {exc}")
        return

    h           = data.get("hourly", {})
    times       = h.get("time", [])
    pm25s       = h.get("pm2_5", [])
    pm10s       = h.get("pm10", [])
    cos         = h.get("carbon_monoxide", [])
    no2s        = h.get("nitrogen_dioxide", [])
    o3s         = h.get("ozone", [])
    so2s        = h.get("sulphur_dioxide", [])
    utc_off_s   = data.get("utc_offset_seconds", 0)   # positive = east of UTC

    records: list[dict] = []
    for i, ts in enumerate(times):
        pm25 = pm25s[i] if i < len(pm25s) else None
        pm10 = pm10s[i] if i < len(pm10s) else None
        co   = cos[i]   if i < len(cos)   else None
        no2  = no2s[i]  if i < len(no2s)  else None
        o3   = o3s[i]   if i < len(o3s)   else None
        so2  = so2s[i]  if i < len(so2s)  else 0.0

        if any(v is None for v in [pm25, pm10, co, no2, o3]):
            continue

        aqi_val, dominant = calculate_aqi(
            pm25=pm25, pm10=pm10,
            co_ppm=co_to_ppm(co),
            no2_ppb=no2_to_ppb(no2),
            o3_ppb=o3_to_ppb(o3),
            so2_ppb=so2_to_ppb(so2 or 0),
        )
        cat = aqi_category(aqi_val)

        # Open-Meteo returns local time; subtract offset to get UTC
        local_dt = datetime.fromisoformat(ts)
        utc_dt   = local_dt - timedelta(seconds=utc_off_s)

        records.append({
            "location_id":        loc_id,
            "measured_at":        utc_dt.strftime("%Y-%m-%dT%H:%M:%S+00:00"),
            "aqi":                aqi_val,
            "category":           cat,
            "dominant_pollutant": dominant,
            "pm25":               round(pm25, 2),
            "pm10":               round(pm10, 2),
            "co":                 round(co, 2),
            "no2":                round(no2, 2),
            "o3":                 round(o3, 2),
            "so2":                round(so2 or 0, 2),
        })

    if not records:
        log.warning(f"{name}: no valid hourly rows returned from Open-Meteo")
        return

    supabase.table("aqi_measurements").upsert(
        records, on_conflict="location_id,measured_at"
    ).execute()
    log.info(f"{name}: upserted {len(records)} records")


def ingest_all() -> None:
    log.info("Starting ingestion run…")
    locations = fetch_locations()
    if not locations:
        log.warning("No active locations found in Supabase — seed the locations table first")
        return
    log.info(f"Processing {len(locations)} active locations")
    for loc in locations:
        try:
            ingest_location(loc)
        except Exception as exc:
            log.error(f"{loc['name']}: unexpected error — {exc}")
    log.info("Ingestion complete")


if __name__ == "__main__":
    ingest_all()
