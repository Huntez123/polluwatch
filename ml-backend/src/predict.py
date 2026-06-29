"""
predict.py
For each active city:
  1. Pull the last 48 rows from aqi_measurements
  2. Build lag + rolling features
  3. Train XGBRegressor on the window
  4. Iteratively predict the next 24 hourly AQI values
  5. Upsert into aqi_predictions

Run manually: python src/predict.py
Run on schedule: called by main.py every hour (after ingestion).
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import numpy as np
import pandas as pd
from datetime import timedelta
from xgboost import XGBRegressor
from config.supabase_config import supabase
from src.aqi import aqi_category

MODEL_VERSION = "xgb-v1"

FEATURE_COLS = [
    "aqi_lag1", "aqi_lag2", "aqi_lag3", "aqi_lag6",
    "pm25_lag1", "pm10_lag1", "no2_lag1", "o3_lag1",
    "rolling_mean_3h", "rolling_mean_6h",
    "hour_of_day", "day_of_week",
]


def _fetch_history(location_id: int, hours: int = 48) -> pd.DataFrame:
    result = (
        supabase.table("aqi_measurements")
        .select("measured_at,aqi,pm25,pm10,no2,o3,co,so2")
        .eq("location_id", location_id)
        .order("measured_at", desc=True)
        .limit(hours)
        .execute()
    )
    if not result.data:
        return pd.DataFrame()
    df = pd.DataFrame(result.data)
    df["measured_at"] = pd.to_datetime(df["measured_at"], utc=True)
    return df.sort_values("measured_at").reset_index(drop=True)


def _build_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["aqi_lag1"] = df["aqi"].shift(1)
    df["aqi_lag2"] = df["aqi"].shift(2)
    df["aqi_lag3"] = df["aqi"].shift(3)
    df["aqi_lag6"] = df["aqi"].shift(6)
    df["pm25_lag1"] = df["pm25"].shift(1)
    df["pm10_lag1"] = df["pm10"].shift(1)
    df["no2_lag1"]  = df["no2"].shift(1)
    df["o3_lag1"]   = df["o3"].shift(1)
    df["rolling_mean_3h"] = df["aqi"].rolling(3).mean()
    df["rolling_mean_6h"] = df["aqi"].rolling(6).mean()
    df["hour_of_day"]  = df["measured_at"].dt.hour
    df["day_of_week"]  = df["measured_at"].dt.dayofweek
    return df.dropna(subset=FEATURE_COLS).reset_index(drop=True)


def _train(df_feat: pd.DataFrame) -> XGBRegressor:
    X = df_feat[FEATURE_COLS].values
    y = df_feat["aqi"].values
    model = XGBRegressor(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        subsample=0.8,
        random_state=42,
        verbosity=0,
    )
    model.fit(X, y)
    return model


def _generate_predictions(model: XGBRegressor, df_raw: pd.DataFrame) -> list[dict]:
    history_aqi  = list(df_raw["aqi"].values[-6:])
    last_pm25    = float(df_raw["pm25"].iloc[-1])
    last_pm10    = float(df_raw["pm10"].iloc[-1])
    last_no2     = float(df_raw["no2"].iloc[-1])
    last_o3      = float(df_raw["o3"].iloc[-1])
    last_ts      = df_raw["measured_at"].iloc[-1]

    preds = []
    for h in range(1, 25):
        future_ts = last_ts + timedelta(hours=h)
        lag6 = history_aqi[-6] if len(history_aqi) >= 6 else history_aqi[0]
        feat = np.array([[
            history_aqi[-1],
            history_aqi[-2] if len(history_aqi) >= 2 else history_aqi[-1],
            history_aqi[-3] if len(history_aqi) >= 3 else history_aqi[-1],
            lag6,
            last_pm25,
            last_pm10,
            last_no2,
            last_o3,
            float(np.mean(history_aqi[-3:])),
            float(np.mean(history_aqi[-6:])),
            future_ts.hour,
            future_ts.dayofweek,
        ]])
        pred = int(max(0, min(500, round(float(model.predict(feat)[0])))))
        history_aqi.append(pred)

        preds.append({
            "predicted_for": future_ts.isoformat(),
            "predicted_aqi": pred,
            "category":      aqi_category(pred),
            "model_version": MODEL_VERSION,
        })
    return preds


def _upsert_predictions(location_id: int, preds: list[dict]) -> None:
    payload = [{"location_id": location_id, **p} for p in preds]
    supabase.table("aqi_predictions").upsert(
        payload,
        on_conflict="location_id,predicted_for,model_version",
    ).execute()


def predict_all() -> None:
    locs = (
        supabase.table("locations")
        .select("id,name")
        .eq("is_active", True)
        .execute()
    )
    for loc in locs.data:
        try:
            print(f"[predict] Running for {loc['name']}...")
            df_raw = _fetch_history(loc["id"], hours=48)
            if len(df_raw) < 10:
                print(f"[predict] Not enough data for {loc['name']}, skipping")
                continue
            df_feat = _build_features(df_raw)
            model   = _train(df_feat)
            preds   = _generate_predictions(model, df_raw)
            _upsert_predictions(loc["id"], preds)
            print(f"[predict] {loc['name']}: wrote {len(preds)} predictions")
        except Exception as exc:
            print(f"[predict] ERROR {loc['name']}: {exc}")


if __name__ == "__main__":
    predict_all()
