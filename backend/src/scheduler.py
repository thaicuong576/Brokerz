from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import text
from src.database import engine
from src.workers.market_streamer import initial_seed_data
from src.services.sync_manager import sync_manager
from src.config import SECTOR_MAPPING

# poll_market_data job was removed in favor of manual Sync v2
async def auto_sync_market_data():
    all_symbols = []
    for symbols in SECTOR_MAPPING.values():
        all_symbols.extend(symbols)
    all_symbols = list(set(all_symbols))
    
    print("[Scheduler] Tu dong nap du lieu EOD luc 15:05...")
    await sync_manager.start_eod_sync(all_symbols)

import os
import pandas as pd
import boto3
from datetime import datetime, timedelta
from io import BytesIO

def get_r2_client():
    return boto3.client(
        service_name='s3',
        endpoint_url=os.getenv("R2_ENDPOINT_URL"),
        aws_access_key_id=os.getenv("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("R2_SECRET_ACCESS_KEY"),
        region_name="auto"
    )

def cleanup_old_data():
    if not engine:
        print("[Scheduler] Khong co ket noi Database de don rac!")
        return

    print("[Scheduler] Bat dau qua trinh luu tru R2 va don dep du lieu cu (Qua 30 ngay)...")
    bucket_name = os.getenv("R2_BUCKET_NAME", "mirae-archive")
    thirty_days_ago = (datetime.now() - timedelta(days=30)).date()
    
    tables = ["market_prices", "foreign_trading", "index_snapshot"]
    total_deleted = 0
    
    try:
        # Tùy chọn: dùng AWS/S3 API nếu không có R2_ENDPOINT_URL
        s3 = get_r2_client() if os.getenv("R2_ENDPOINT_URL") else None
        
        for table in tables:
            query = f"SELECT * FROM {table} WHERE trading_date < '{thirty_days_ago.isoformat()}'"
            df = pd.read_sql_query(query, engine)
            
            if not df.empty:
                if s3:
                    # Convert date column to string for parquet compatibility
                    df['trading_date'] = df['trading_date'].astype(str)
                    
                    # Save to parquet in memory
                    out_buffer = BytesIO()
                    df.to_parquet(out_buffer, index=False)
                    out_buffer.seek(0)
                    
                    # Upload to R2
                    object_key = f"archive/{table}/{table}_{thirty_days_ago.isoformat()}_{int(datetime.now().timestamp())}.parquet"
                    s3.upload_fileobj(out_buffer, bucket_name, object_key)
                    print(f"[Archive] Da upload {len(df)} dong cua {table} len R2 ({object_key})")
                else:
                    print(f"[Archive] R2 credentials missing. Skipping cloud backup for {table}.")

                # After successful upload (or skip), delete from database
                with engine.begin() as conn:
                    delete_q = f"DELETE FROM {table} WHERE trading_date < '{thirty_days_ago.isoformat()}'"
                    res = conn.execute(text(delete_q))
                    total_deleted += res.rowcount
            else:
                print(f"[Archive] {table}: Khong co du lieu cu can don.")
                
        print(f"[Scheduler] Da hoan tat, tong xoa {total_deleted} ban ghi cu.")
    except Exception as e:
        print(f"[Scheduler] Loi trong qua trinh Archive/Delete: {e}")

def start_scheduler():
    scheduler = AsyncIOScheduler()
    
    # 1. Tự động nạp EOD lúc 15:05 để Analyst không phải chờ khi bấm nút.
    scheduler.add_job(
        auto_sync_market_data,
        CronTrigger(day_of_week='mon-fri', hour='15', minute='5'),
        id='auto_sync_market_data_job',
        replace_existing=True
    )
    
    # Job cleanup_old_data_job removed - now triggered manually by Admin API
    
    scheduler.start()
    print("[Scheduler] APScheduler da khoi dong (AutoSync: 15:05).")
    return scheduler
