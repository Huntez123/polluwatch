"""
calibration_demo.py

Module A — AI-corrected low-cost fence-line sensor (PM2.5 / PM10).
Demo facility: East African Portland Cement Co., Athi River Plant
               Machakos County, Kenya  |  lat -1.431349, lng 36.961717

Data provenance:
  • Reference PM2.5/PM10: Open-Meteo air-quality API (real, public, no key).
  • Humidity/temperature:  Open-Meteo weather API (same).
  • Cheap sensor readings: SYNTHESISED to mirror documented PMS5003/PMS7003
    error behaviour — see _add_sensor_noise() for citations.

Run:  python src/calibration_demo.py
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import logging
import math

import numpy as np
import pandas as pd
import requests
from datetime import datetime, timezone
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error

from config.supabase_config import supabase

logging.basicConfig(level=logging.INFO, format="[calibration] %(levelname)s %(message)s")
log = logging.getLogger(__name__)

FACILITY_SLUG  = "eapcc-athi-river"
LAT, LNG       = -1.431349, 36.961717
MODEL_VERSION  = "rf-calib-v1"
RNG            = np.random.default_rng(42)

AQ_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
WX_URL = "https://api.open-meteo.com/v1/forecast"


# ── Data fetching ──────────────────────────────────────────────────────────────

def _fetch_open_meteo() -> pd.DataFrame | None:
    """Pull 6 days of real reference PM2.5, PM10, humidity, temperature."""
    try:
        aq_r = requests.get(AQ_URL, params={
            "latitude": LAT, "longitude": LNG,
            "hourly": "pm2_5,pm10",
            "past_days": 6, "forecast_days": 0, "timezone": "auto",
        }, timeout=20)
        aq_r.raise_for_status()
        aq = aq_r.json()["hourly"]

        wx_r = requests.get(WX_URL, params={
            "latitude": LAT, "longitude": LNG,
            "hourly": "relative_humidity_2m,temperature_2m",
            "past_days": 6, "forecast_days": 0, "timezone": "auto",
        }, timeout=20)
        wx_r.raise_for_status()
        wx = wx_r.json()["hourly"]

        df = pd.DataFrame({
            "time":     aq["time"],
            "pm25":     aq["pm2_5"],
            "pm10":     aq["pm10"],
            "humidity": wx["relative_humidity_2m"],
            "temp":     wx["temperature_2m"],
        }).dropna().reset_index(drop=True)

        log.info(f"Open-Meteo: {len(df)} real reference rows  [DATA SOURCE: real]")
        return df
    except Exception as exc:
        log.warning(f"Open-Meteo fetch failed ({exc})  [DATA SOURCE: falling back to synthetic]")
        return None


def _synthetic_fallback(n: int = 144) -> pd.DataFrame:
    """
    Physically plausible PM diurnal curve for the Athi River industrial corridor.
    Peaks at ~08:00 and ~19:00, corresponding to cement kiln shift changes
    and evening road traffic on the Mombasa highway.
    Used only when the live Open-Meteo fetch fails.
    """
    log.info(f"Generating synthetic fallback reference ({n} rows)  [DATA SOURCE: synthetic-fallback]")
    hod  = np.arange(n) % 24
    pm25 = np.maximum(2.0,
        18 + 9 * np.sin((hod - 6) * math.pi / 12)
           + 5 * np.sin((hod - 15) * math.pi / 4)
           + RNG.normal(0, 2.5, n))
    pm10  = np.round(pm25 * (2.1 + RNG.normal(0, 0.06, n)), 2)
    hum   = np.clip(55 + 20 * np.sin((hod - 4) * math.pi / 12) + RNG.normal(0, 4, n), 20, 100)
    temp  = np.clip(22  + 8  * np.sin((hod - 6) * math.pi / 12) + RNG.normal(0, 1.5, n), 10, 42)
    now   = datetime.now(timezone.utc)
    times = pd.date_range(end=now, periods=n, freq="h").strftime("%Y-%m-%dT%H:%M")
    return pd.DataFrame({
        "time":     times,
        "pm25":     np.round(pm25, 2),
        "pm10":     pm10,
        "humidity": np.round(hum, 1),
        "temp":     np.round(temp, 1),
    })


# ── Cheap-sensor simulation ────────────────────────────────────────────────────

def _add_sensor_noise(df: pd.DataFrame, ref_col: str) -> pd.Series:
    """
    Simulate PMS5003/PMS7003-class optical particle counter error modes:

    1. Humidity cross-sensitivity (Jayaratne et al. 2018, Atmos. Environ. 175,
       "The influence of humidity on the performance of a low-cost air particle
       mass sensor and the effect of atmospheric fog"):
       Optical sensors over-read in humid air; the effect is negligible below
       ~60 % RH and grows at ~0.6 % per additional % RH above that threshold.
           raw ≈ ref × (1 + max(0, RH − 60) × 0.006)

    2. Baseline drift (Rai et al. 2017, Atmos. Environ. 161,
       "End-user perspective of low-cost sensors for outdoor air pollution
       monitoring"):
       Uncalibrated field units drift +0.4–1.0 µg/m³ per day. We use 0.7.

    3. Read noise + spike artefacts (Zheng et al. 2018, Aerosol Air Qual. Res.,
       "Field evaluation of low-cost PM2.5 sensors in high- and low-concentration
       environments"):
       Gaussian read noise σ ≈ 1.5 µg/m³; ~3 % of readings show large positive
       spikes caused by dust puffs or insects passing the optical window.
    """
    n            = len(df)
    ages         = np.linspace(0, 6, n)            # days since deployment
    rh_excess    = np.maximum(0, df["humidity"].values - 60)
    hum_factor   = 1 + rh_excess * 0.006
    drift        = 0.7 * ages
    noise        = RNG.normal(0, 1.5, n)
    spike_mask   = RNG.random(n) < 0.03
    spikes       = np.where(spike_mask, RNG.uniform(15, 45, n), 0.0)
    raw          = df[ref_col].values * hum_factor + drift + noise + spikes
    return pd.Series(np.maximum(0.0, raw).round(2), name=f"{ref_col}_raw")


# ── Model training + evaluation ────────────────────────────────────────────────

def _calibrate(df: pd.DataFrame, ref_col: str, raw_col: str) -> tuple:
    """
    Chronological 70/30 split mirrors a real deployment:
      first 70 % = co-location calibration window (sensor beside the reference)
      last  30 % = field deployment window (sensor at fence line — test set)

    Features: raw_value, humidity_pct, temperature_c, sensor_age_days.
    """
    n       = len(df)
    ages    = np.linspace(0, 6, n)
    feats   = np.column_stack([df[raw_col].values, df["humidity"].values,
                               df["temp"].values, ages])
    target  = df[ref_col].values
    split   = int(n * 0.70)

    model   = RandomForestRegressor(
        n_estimators=200, max_depth=8, min_samples_leaf=2,
        random_state=42, n_jobs=-1,
    )
    model.fit(feats[:split], target[:split])

    cal_all     = np.maximum(0.0, model.predict(feats)).round(3)
    rmse_raw    = math.sqrt(mean_squared_error(target[split:], df[raw_col].values[split:]))
    rmse_cal    = math.sqrt(mean_squared_error(target[split:], cal_all[split:]))
    pct_improv  = (1 - rmse_cal / rmse_raw) * 100

    split_labels = ["calibration"] * split + ["test"] * (n - split)
    return cal_all, split_labels, rmse_raw, rmse_cal, pct_improv


# ── Supabase upserts ───────────────────────────────────────────────────────────

def _get_facility_id() -> int:
    result = (supabase
              .table("facilities")
              .select("id")
              .eq("slug", FACILITY_SLUG)
              .single()
              .execute())
    return result.data["id"]


def _upsert_raw(fac_id: int, df: pd.DataFrame) -> None:
    n    = len(df)
    ages = np.linspace(0, 6, n)
    rows = []
    for i, r in df.iterrows():
        ts = pd.Timestamp(r["time"]).isoformat()
        for poll, col in [("pm25", "pm25_raw"), ("pm10", "pm10_raw")]:
            rows.append({
                "facility_id":     fac_id,
                "measured_at":     ts,
                "pollutant":       poll,
                "raw_value":       float(r[col]),
                "humidity_pct":    float(r["humidity"]),
                "temperature_c":   float(r["temp"]),
                "sensor_age_days": float(ages[i]),
            })
    supabase.table("boundary_raw_readings").upsert(
        rows, on_conflict="facility_id,measured_at,pollutant"
    ).execute()
    log.info(f"Upserted {len(rows)} raw sensor readings")


def _upsert_calibrated(fac_id: int, df: pd.DataFrame,
                        pollutant: str, ref_col: str,
                        raw_col: str, cal_col: str, split_col: str) -> None:
    rows = [{
        "facility_id":      fac_id,
        "measured_at":      pd.Timestamp(r["time"]).isoformat(),
        "pollutant":        pollutant,
        "reference_value":  float(r[ref_col]),
        "raw_value":        float(r[raw_col]),
        "calibrated_value": float(r[cal_col]),
        "model_version":    MODEL_VERSION,
        "split":            r[split_col],
    } for _, r in df.iterrows()]
    supabase.table("boundary_calibrated_readings").upsert(
        rows, on_conflict="facility_id,measured_at,pollutant,model_version"
    ).execute()
    log.info(f"Upserted {len(rows)} calibrated {pollutant} readings")


# ── Entry point ────────────────────────────────────────────────────────────────

def run() -> None:
    log.info("── Module A: Low-Cost Sensor Calibration ───────────────────")
    log.info(f"Facility: {FACILITY_SLUG}  |  coords: {LAT}, {LNG}")

    df = _fetch_open_meteo()
    if df is None:
        df = _synthetic_fallback()

    # Synthesise what a cheap sensor would have reported
    df["pm25_raw"] = _add_sensor_noise(df, "pm25")
    df["pm10_raw"] = _add_sensor_noise(df, "pm10")

    # Train calibration model and evaluate on test split
    cal25, spl25, r_raw25, r_cal25, pct25 = _calibrate(df, "pm25", "pm25_raw")
    cal10, spl10, r_raw10, r_cal10, pct10 = _calibrate(df, "pm10", "pm10_raw")

    df["pm25_cal"]   = cal25
    df["pm25_split"] = spl25
    df["pm10_cal"]   = cal10
    df["pm10_split"] = spl10

    # ── Print proof-point ──
    print()
    print("╔══════════════════════════════════════════════════════════════╗")
    print("║     MODULE A — LOW-COST SENSOR CALIBRATION RESULTS          ║")
    print("╠══════════════════════════════════════════════════════════════╣")
    print(f"║  PM2.5  raw  RMSE : {r_raw25:6.3f} µg/m³                          ║")
    print(f"║  PM2.5  cal  RMSE : {r_cal25:6.3f} µg/m³  ← {pct25:4.1f}% ERROR REDUCTION  ★ ║")
    print(f"║  PM10   raw  RMSE : {r_raw10:6.3f} µg/m³                          ║")
    print(f"║  PM10   cal  RMSE : {r_cal10:6.3f} µg/m³  ← {pct10:4.1f}% ERROR REDUCTION  ★ ║")
    print("╚══════════════════════════════════════════════════════════════╝")
    print()

    try:
        fac_id = _get_facility_id()
        log.info(f"Supabase facility_id = {fac_id}")
        _upsert_raw(fac_id, df)
        _upsert_calibrated(fac_id, df, "pm25", "pm25", "pm25_raw", "pm25_cal", "pm25_split")
        _upsert_calibrated(fac_id, df, "pm10", "pm10", "pm10_raw", "pm10_cal", "pm10_split")
        log.info("Supabase upsert complete ✓")
    except Exception as exc:
        log.error(f"Supabase upsert failed: {exc}")
        log.info("(The RMSE results above are still valid — only the DB write failed.)")


if __name__ == "__main__":
    run()
