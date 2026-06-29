"""
main.py — Hourly scheduler.
Runs ingestion at :05 past the hour, predictions at :15.
Also runs both immediately on startup so tables have data right away.
"""

import schedule
import time
from ingestion import ingest_all
from predict import predict_all


def run_pipeline() -> None:
    ingest_all()
    predict_all()


# Populate data immediately on startup
print("[main] Running initial pipeline...")
run_pipeline()

schedule.every().hour.at(":05").do(ingest_all)
schedule.every().hour.at(":15").do(predict_all)

print("[main] Scheduler running. Press Ctrl+C to stop.")
while True:
    schedule.run_pending()
    time.sleep(30)
