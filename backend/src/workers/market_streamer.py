import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path
from src.services.ssi_service import SSIService
from src.services.dnse_service import DNSEService
from src.cache.state import MARKET_DATA
from src.cache import db as cache_db
from src.database import SessionLocal
from src.models.schema import IndexSnapshot
from src.config import SECTOR_MAPPING

logger = logging.getLogger(__name__)
ssi = SSIService()
dnse = DNSEService()

SYMBOL_SECTOR = {
    symbol: sector
    for sector, sector_symbols in SECTOR_MAPPING.items()
    for symbol in sector_symbols
}
LISTED_SHARES_CACHE_PATH = Path(__file__).resolve().parents[2] / "data" / "listed_shares_cache.json"


def _load_listed_shares_cache():
    try:
        with LISTED_SHARES_CACHE_PATH.open("r", encoding="utf-8") as file:
            return json.load(file).get("shares", {})
    except Exception as exc:
        logger.warning("Could not load listed shares cache: %s", exc)
        return {}


LISTED_SHARES_CACHE = _load_listed_shares_cache()


def _to_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _to_int(value, default=0):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _parse_ssi_date(value):
    if not value:
        return datetime.now().date()
    try:
        return datetime.strptime(value, "%d/%m/%Y").date()
    except ValueError:
        return datetime.now().date()


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
                point = _to_float(data.get("IndexValue"))
                trading_date = _parse_ssi_date(data.get("TradingDate") or data.get("tradingdate"))
                total_volume = _to_int(data.get("TotalMatchVol") or data.get("TotalVol") or data.get("TotalTrade"))
                total_value = _to_float(data.get("TotalMatchVal") or data.get("TotalVal") or data.get("TotalValue"))
                # Update Hot Cache & DB
                MARKET_DATA["VNINDEX"] = {
                    "symbol": "VNINDEX",
                    "price": point,
                    "change": _to_float(data.get("Change")),
                    "change_percent": _to_float(data.get("RatioChange")),
                    "trading_date": trading_date.isoformat(),
                    "total_volume": total_volume,
                    "total_value": total_value,
                    "breadth_green": _to_int(data.get("Advances")),
                    "breadth_red": _to_int(data.get("Declines")),
                    "breadth_yellow": _to_int(data.get("NoChanges")),
                    "breadth_ceiling": _to_int(data.get("Ceilings")),
                    "breadth_floor": _to_int(data.get("Floors")),
                    "status": "LIVE",
                    "updated_at": datetime.now().isoformat(),
                }
                
                new_snapshot = IndexSnapshot(
                    symbol="VNINDEX",
                    trading_date=trading_date,
                    point=point,
                    change_point=_to_float(data.get("Change")),
                    change_percent=_to_float(data.get("RatioChange")),
                    total_volume=total_volume,
                    total_value=total_value,
                    breadth_green=_to_int(data.get("Advances")),
                    breadth_red=_to_int(data.get("Declines")),
                    breadth_yellow=_to_int(data.get("NoChanges")),
                    breadth_ceiling=_to_int(data.get("Ceilings")),
                    breadth_floor=_to_int(data.get("Floors")),
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
                    stock_date = _parse_ssi_date(s_data.get("TradingDate") or s_data.get("tradingdate"))
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
                        trading_date=stock_date,
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
    """
    Fast market seed from DNSE.

    DNSE is the right primary source for realtime dashboard metrics: index point,
    liquidity, breadth, stock price/volume, and intraday foreign flow. SSI remains
    the slower EOD enrichment path for full foreign trading history.
    """
    logger.info(f"DNSE initial seed started with {len(symbols)} symbols.")
    data = dnse.fetch_all_data(symbols)
    if not data:
        raise RuntimeError("DNSE returned no market data")

    index_data = data.get("index")
    stocks = data.get("stocks", {})

    if index_data:
        index_payload = {
            "symbol": index_data.symbol,
            "price": _to_float(index_data.point),
            "change": _to_float(index_data.change_point),
            "change_percent": _to_float(index_data.change_percent),
            "total_volume": _to_int(index_data.total_volume),
            "total_value": _to_float(index_data.total_value),
            "breadth_green": _to_int(index_data.breadth.green),
            "breadth_red": _to_int(index_data.breadth.red),
            "breadth_yellow": _to_int(index_data.breadth.yellow),
            "breadth_ceiling": _to_int(index_data.breadth.ceiling),
            "breadth_floor": _to_int(index_data.breadth.floor),
            "status": "LIVE",
            "updated_at": datetime.now().isoformat(),
        }
        MARKET_DATA["VNINDEX"] = index_payload
        cache_db.upsert_index(
            "VNINDEX",
            {
                "point": index_payload["price"],
                "change_point": index_payload["change"],
                "change_percent": index_payload["change_percent"],
                "total_volume": index_payload["total_volume"],
                "total_value": index_payload["total_value"],
                "breadth_green": index_payload["breadth_green"],
                "breadth_red": index_payload["breadth_red"],
                "breadth_yellow": index_payload["breadth_yellow"],
                "breadth_ceiling": index_payload["breadth_ceiling"],
                "breadth_floor": index_payload["breadth_floor"],
            },
        )

    for symbol, payload in stocks.items():
        foreign_buy = _to_float(payload.get("f_buy_val"))
        foreign_sell = _to_float(payload.get("f_sell_val"))
        if abs(foreign_buy) < 1_000_000 and foreign_buy:
            foreign_buy *= 1_000_000_000
        if abs(foreign_sell) < 1_000_000 and foreign_sell:
            foreign_sell *= 1_000_000_000

        cache_db.upsert_stock(
            symbol,
            {
                "price": _to_float(payload.get("price")),
                "ref_price": _to_float(payload.get("ref_price")),
                "change_percent": _to_float(payload.get("change_percent")),
                "volume": _to_int(payload.get("volume")),
                "f_buy_val": foreign_buy,
                "f_sell_val": foreign_sell,
                "shares": _to_int(payload.get("listed_shares") or LISTED_SHARES_CACHE.get(symbol)),
                "sector": SYMBOL_SECTOR.get(symbol),
            },
        )

    cache_db.flush_buffers()
    logger.info(f"DNSE initial seed completed: index={bool(index_data)}, stocks={len(stocks)}.")
    return {"index": bool(index_data), "stocks": len(stocks)}
