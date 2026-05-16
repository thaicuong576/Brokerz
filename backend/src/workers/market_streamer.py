import asyncio
import logging
from datetime import datetime
from src.services.ssi_service import SSIService
from src.cache.state import MARKET_DATA
from src.database import SessionLocal
from src.models.schema import IndexSnapshot

logger = logging.getLogger(__name__)
ssi = SSIService()


async def market_historian_loop(socket_manager=None):
    """
    The Historian Loop:
    - Runs every 15 minutes.
    - Fetches the latest market data.
    - Persists it to the database to build historical 'Data Rows'.
    - Updates the Hot Cache for instant UI response.
    - Broadcasts the update via WebSocket if manager is provided.
    """
    logger.info("Intelligence Historian STARTED (15-min interval).")

    while True:
        try:
            db = SessionLocal()
            # 1. Fetch VNINDEX
            data = ssi.get_index_summary("VNINDEX")
            if data:
                point = float(data.get("IndexValue", 0))
                # Update Hot Cache & DB
                MARKET_DATA["VNINDEX"] = {
                    "symbol": "VNINDEX",
                    "price": point,
                    "change": data.get("Change", 0),
                    "change_percent": data.get("RatioChange", 0),
                    "status": "LIVE",
                    "updated_at": datetime.now().isoformat(),
                }
                
                new_snapshot = IndexSnapshot(
                    symbol="VNINDEX",
                    trading_date=datetime.now().date(),
                    point=point,
                    change_point=data.get("Change", 0),
                    change_percent=data.get("RatioChange", 0),
                    total_volume=data.get("TotalTrade", 0),
                    total_value=data.get("TotalValue", 0),
                )
                db.merge(new_snapshot)
            
            # 2. Fetch Top 15 Stocks
            bluechips = ["FPT", "VCB", "VIC", "VNM", "MSN", "GAS", "HPG", "SSI", "STB", "TCB", "MWG", "REE", "HDB", "MBB", "VPB"]
            stock_updates = []
            for sym in bluechips:
                s_data = ssi.get_daily_stock_price(sym)
                if s_data:
                    price = float(s_data.get("ClosePrice") or s_data.get("Close") or s_data.get("RefPrice") or 0)
                    ref = float(s_data.get("RefPrice") or s_data.get("PriorClose") or 0)
                    stock_updates.append({
                        "symbol": sym,
                        "price": price,
                        "ref_price": ref,
                        "change_percent": float(s_data.get("PerPriceChange") or 0)
                    })
                    
                    # Update DB for latest stocks
                    from src.models.schema import MarketPrice
                    new_mp = MarketPrice(
                        symbol=sym,
                        trading_date=datetime.now().date(),
                        price=price,
                        ref_price=ref,
                        change_percent=float(s_data.get("PerPriceChange") or 0),
                        volume=int(float(s_data.get("TotalTradedVol") or 0))
                    )
                    db.merge(new_mp)
                await asyncio.sleep(1.1) # Respect SSI rate limit
            
            db.commit()
            db.close()

            # BROADCAST via WebSocket
            if socket_manager:
                await socket_manager.broadcast({
                    "type": "MARKET_SNAPSHOT",
                    "data": {
                        "vnindex": MARKET_DATA.get("VNINDEX"),
                    },
                    "vnindex": MARKET_DATA.get("VNINDEX"),
                    "stocks": stock_updates,
                    "timestamp": datetime.now().isoformat()
                })
            
            logger.info(f"Historian: Updated VNINDEX and {len(stock_updates)} stocks.")

        except Exception as e:
            logger.error(f"Historian Error: {e}")
            if 'db' in locals(): db.close()

        # 15 Minute Interval
        await asyncio.sleep(900)


async def start_streams(socket_manager=None):
    """Starts the market data streaming workers in the background."""
    logger.info("Starting market data streams...")
    asyncio.create_task(market_historian_loop(socket_manager))
    logger.info("Market streamers are running in background.")


async def stop_streams():
    """Stops the market data streaming workers."""
    logger.info("Stopping market data streams...")


async def initial_seed_data(symbols, force_tier2=False):
    """Stub - data seeding now handled by sync_manager"""
    logger.info(f"initial_seed_data called with {len(symbols)} symbols (stub)")
