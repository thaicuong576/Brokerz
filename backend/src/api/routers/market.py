from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text, desc, asc
from src.database import get_db
from src.models.schema import IndexSnapshot, ForeignTrading
from datetime import datetime
from src.api.schemas import (
    IndexOverviewResponse, 
    TopImpactResponse, 
    ForeignTradingResponse,
    SectorPerformanceResponse
)
from src.cache.state import SYSTEM_STATUS
from src.services.sync_manager import sync_manager
import psutil
import os
from src.scheduler import cleanup_old_data
from src.config import SECTOR_MAPPING

router = APIRouter(prefix="/api/v1", tags=["Market Data"])

@router.get("/market/search")
def search_stocks(q: str, db: Session = Depends(get_db)):
    """Tìm kiếm mã cổ phiếu theo ký tự gõ vào."""
    if not q or len(q) < 1:
        return []
    
    # Query unique symbols from stocks table (comprehensive list)
    query = text("""
        SELECT symbol 
        FROM stocks 
        WHERE symbol ILIKE :q 
        ORDER BY symbol ASC 
        LIMIT 10
    """)
    rows = db.execute(query, {"q": f"{q}%"}).fetchall()
    return [row[0] for row in rows]

@router.get("/market/price/{symbol}")
def get_stock_price(symbol: str, db: Session = Depends(get_db)):
    """Lấy giá mới nhất của 1 mã cụ thể."""
    active_date = get_active_session_date(db)
    query = text("""
        SELECT price, ref_price 
        FROM market_prices 
        WHERE symbol = :s AND trading_date = :dt
        LIMIT 1
    """)
    row = db.execute(query, {"s": symbol.upper(), "dt": active_date}).fetchone()
    
    if not row:
        # LIVE FALLBACK: Fetch from SSI if missing in DB
        try:
            print(f"📡 Price missing in DB for {symbol}, fetching LIVE from SSI...")
            data = sync_manager.ssi.get_daily_stock_price(symbol)
            if data:
                price = float(data.get("ClosePrice") or data.get("Close") or data.get("RefPrice") or 0)
                ref = float(data.get("RefPrice") or data.get("PriorClose") or 0)
                
                # SAVE TO DB so it appears in next get_latest_stocks call
                from src.models.schema import MarketPrice
                new_mp = MarketPrice(
                    symbol=symbol.upper(),
                    trading_date=active_date,
                    price=price,
                    ref_price=ref,
                    change_percent=float(data.get("PerPriceChange") or 0),
                    volume=int(float(data.get("TotalTradedVol") or 0))
                )
                db.merge(new_mp)
                db.commit()
                
                return {"symbol": symbol.upper(), "price": price, "ref_price": ref, "is_live": True}
        except Exception as e:
            print(f"❌ Error during live fallback: {e}")
            pass
            
        raise HTTPException(status_code=404, detail="Stock price not found in DB or SSI")
        
    return {"symbol": symbol.upper(), "price": row[0] or row[1], "ref_price": row[1], "is_live": False}

@router.get("/analytics/timeseries")
def get_timeseries(id: str = "VNINDEX", limit: int = 50):
    """
    Returns historical 'Data Rows' for charting.
    Pulls from the 15-minute Historian records in the database.
    """
    from src.database import SessionLocal
    db = SessionLocal()
    try:
        snapshots = db.query(IndexSnapshot)\
            .filter(IndexSnapshot.symbol == id)\
            .order_by(desc(IndexSnapshot.trading_date))\
            .limit(limit)\
            .all()
            
        # Format for Recharts (Frontend)
        return [{
            "date": s.trading_date.isoformat(),
            "value": s.point,
            "volume": s.total_volume,
            "change": s.change_point
        } for s in reversed(snapshots)] # Reversed for chronological order
    finally:
        db.close()

@router.get("/system/status")
def get_system_status():
    return SYSTEM_STATUS

@router.get("/overview", response_model=IndexOverviewResponse)
def get_overview(db: Session = Depends(get_db)):
    """Lấy thông tin tổng quan điểm số mới nhất."""
    snapshot = (
        db.query(IndexSnapshot)
        .filter(
            IndexSnapshot.symbol == "VNINDEX",
            ((IndexSnapshot.total_volume.isnot(None)) & (IndexSnapshot.total_volume > 0))
            | ((IndexSnapshot.total_value.isnot(None)) & (IndexSnapshot.total_value > 0)),
        )
        .order_by(desc(IndexSnapshot.trading_date))
        .first()
    ) or db.query(IndexSnapshot).order_by(desc(IndexSnapshot.trading_date)).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="No overview data found")
    return snapshot

def get_active_session_date(db: Session):
    """
    Clock-based Session Guard:
    - Trước 09:15: Luôn dùng ngày của phiên đóng cửa gần nhất (Last Closed Session).
    - Sau 09:15: Nếu ngày today() có dữ liệu (turnover > 0), có thể dùng today().
    - Trả về: String 'YYYY-MM-DD'
    """
    now = datetime.now()
    today = now.date().isoformat()
    
    # 1. Tìm ngày gần nhất có dữ liệu giá (Chính)
    latest_price_query = text("SELECT MAX(trading_date) FROM market_prices WHERE trading_date <= :today")
    last_price_date = db.execute(latest_price_query, {"today": today}).scalar()
    
    # 2. Tìm ngày gần nhất có dữ liệu Foreign (Có thể trễ hơn Price)
    latest_ft_query = text("SELECT MAX(trading_date) FROM foreign_trading WHERE trading_date <= :today")
    last_ft_date = db.execute(latest_ft_query, {"today": today}).scalar()

    # Nếu đang trước 09:15 AM -> Dùng phiên đóng cửa hôm trước
    if now.hour < 9 or (now.hour == 9 and now.minute < 15):
        # Lùi lại 1 ngày so với ngày mới nhất có data nếu ngày đó là today
        if last_price_date == today:
             prev_query = text("SELECT MAX(trading_date) FROM market_prices WHERE trading_date < :today")
             return db.execute(prev_query, {"today": today}).scalar() or today
        return last_price_date or today
        
    # Sau 09:15 AM -> Ưu tiên ngày mới nhất có data giá
    return last_price_date or last_ft_date or today

@router.get("/top-impact", response_model=TopImpactResponse)
def get_top_impact(limit: int = 10, db: Session = Depends(get_db)):
    """Lọc top tác động từ market_prices & stocks (impact_metrics view)."""
    active_date = get_active_session_date(db)
    
    positive_query = text("SELECT symbol, sector, price, ref_price, change_percent, impact_value FROM impact_metrics WHERE impact_value > 0.001 AND trading_date = :dt ORDER BY impact_value DESC LIMIT :limit")
    positive_rows = db.execute(positive_query, {"limit": limit, "dt": active_date}).fetchall()
    
    negative_query = text("SELECT symbol, sector, price, ref_price, change_percent, impact_value FROM impact_metrics WHERE impact_value < -0.001 AND trading_date = :dt ORDER BY impact_value ASC LIMIT :limit")
    negative_rows = db.execute(negative_query, {"limit": limit, "dt": active_date}).fetchall()
    
    return {
        "positive": [dict(row._mapping) for row in positive_rows],
        "negative": [dict(row._mapping) for row in negative_rows]
    }

@router.get("/foreign-trading", response_model=ForeignTradingResponse)
def get_foreign_trading(limit: int = 10, db: Session = Depends(get_db)):
    """Lấy top mua/bán ròng của khối ngoại (ngày đầy đủ nhất)."""
    # Use max trading_date from foreign_trading specifically to handle weekends/delays
    from sqlalchemy.sql import func
    active_date = db.query(func.max(ForeignTrading.trading_date)).scalar()
    
    if not active_date:
        return {"top_buy": [], "top_sell": [], "total_net_val": 0.0}

    top_buy = db.query(ForeignTrading).filter(ForeignTrading.trading_date == active_date).order_by(desc(ForeignTrading.net_val)).limit(limit).all()
    top_sell = db.query(ForeignTrading).filter(ForeignTrading.trading_date == active_date).order_by(asc(ForeignTrading.net_val)).limit(limit).all()
    
    b = float(db.execute(text("SELECT SUM(f_buy_val) FROM foreign_trading WHERE trading_date = :d"), {"d": active_date}).scalar() or 0)
    s = float(db.execute(text("SELECT SUM(f_sell_val) FROM foreign_trading WHERE trading_date = :d"), {"d": active_date}).scalar() or 0)
    
    return {
        "top_buy": top_buy,
        "top_sell": top_sell,
        "total_net_val": b - s
    }

@router.get("/sector-performance", response_model=SectorPerformanceResponse)
def get_sector_performance(db: Session = Depends(get_db)):
    """Lấy hiệu suất ngành (Tăng/giảm trung bình)."""
    query = text("SELECT trading_date, sector, avg_change, total_stocks FROM sector_performance_metrics WHERE trading_date = (SELECT MAX(trading_date) FROM sector_performance_metrics) AND sector IS NOT NULL ORDER BY avg_change DESC")
    rows = db.execute(query).fetchall()
    return {"sectors": [dict(row._mapping) for row in rows]}

@router.post("/sync-eod")
async def trigger_sync_eod():
    """Bắt đầu đồng bộ dữ liệu cuối ngày (EOD) cho toàn bộ thị trường."""
    all_symbols = []
    for symbols in SECTOR_MAPPING.values():
        all_symbols.extend(symbols)
    all_symbols = list(set(all_symbols))
    
    result = await sync_manager.start_eod_sync(all_symbols)
    return result

@router.get("/sync-status")
async def get_sync_status():
    """Lấy trạng thái tiến độ đồng bộ SSI hiện tại."""
    return sync_manager.get_status()

@router.post("/system/cleanup")
async def trigger_cleanup():
    """
    [ADMIN ONLY] Kích hoạt dọn dẹp dữ liệu cũ (>30 ngày) và backup lên R2.
    """
    try:
        from src.scheduler import cleanup_old_data
        cleanup_old_data()
        return {"message": "Dọn dẹp và backup R2 hoàn tất thành công."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stocks/latest")
def get_latest_stocks(db: Session = Depends(get_db)):
    """Lấy giá mới nhất của toàn bộ cổ phiếu."""
    active_date = get_active_session_date(db)
    query = text("""
        SELECT symbol, price, ref_price, volume, updated_at 
        FROM market_prices 
        WHERE trading_date = :dt
    """)
    rows = db.execute(query, {"dt": active_date}).fetchall()
    return [dict(row._mapping) for row in rows]

@router.get("/admin/stats")
def get_admin_stats(db: Session = Depends(get_db)):
    """
    [ADMIN ONLY] Lấy thông số runtime của hệ thống.
    """
    import psutil
    import os
    process = psutil.Process(os.getpid())
    ram_mb = process.memory_info().rss / 1024 / 1024
    
    db_path = "mirae_asset.db" # Tên file db mặc định
    db_size_mb = 0
    if os.path.exists(db_path):
        db_size_mb = os.path.getsize(db_path) / 1024 / 1024
        
    return {
        "ram_usage_mb": round(ram_mb, 2),
        "db_size_mb": round(db_size_mb, 2),
        "ingestion_status": SYSTEM_STATUS,
        "server_time": datetime.now().isoformat()
    }

@router.get("/market/snapshot")
def get_market_snapshot(db: Session = Depends(get_db)):
    """
    TỔNG KHO DỮ LIỆU: 
    Gom tất cả VNINDEX, Khối ngoại, Top Impact và Ngành vào 1 lần fetch duy nhất.
    """
    # 1. VNINDEX (Ưu tiên live cache, fallback DB)
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

    def _value_in_billion(value):
        value = _to_float(value)
        return value / 1_000_000_000 if abs(value) >= 1_000_000_000 else value

    def _derive_from_prices(target_date):
        if not target_date:
            return {}
        row = db.execute(text("""
            SELECT
                COALESCE(SUM(volume), 0) AS total_volume,
                COALESCE(SUM(price * volume), 0) AS total_value,
                SUM(CASE WHEN price > ref_price THEN 1 ELSE 0 END) AS breadth_green,
                SUM(CASE WHEN price < ref_price THEN 1 ELSE 0 END) AS breadth_red,
                SUM(CASE WHEN price = ref_price THEN 1 ELSE 0 END) AS breadth_yellow
            FROM market_prices
            WHERE trading_date = :dt
        """), {"dt": target_date}).fetchone()
        return dict(row._mapping) if row else {}

    def _snapshot_dict(s):
        if not s:
            return {}
        derived = _derive_from_prices(s.trading_date) if not s.total_volume or not s.total_value else {}
        return {
            "symbol": s.symbol,
            "price": _to_float(s.point),
            "change": _to_float(s.change_point),
            "change_percent": _to_float(s.change_percent),
            "trading_date": s.trading_date.isoformat(),
            "total_volume": _to_int(s.total_volume or derived.get("total_volume")),
            "total_value": _value_in_billion(s.total_value or derived.get("total_value")),
            "breadth_green": _to_int(s.breadth_green if s.breadth_green is not None else derived.get("breadth_green")),
            "breadth_red": _to_int(s.breadth_red if s.breadth_red is not None else derived.get("breadth_red")),
            "breadth_yellow": _to_int(s.breadth_yellow if s.breadth_yellow is not None else derived.get("breadth_yellow")),
            "breadth_ceiling": _to_int(s.breadth_ceiling),
            "breadth_floor": _to_int(s.breadth_floor),
        }

    from src.cache.state import MARKET_DATA
    vnindex_live = MARKET_DATA.get("VNINDEX")
    
    # Lấy lịch sử 50 điểm cho biểu đồ
    history_snapshots = db.query(IndexSnapshot)\
        .filter(IndexSnapshot.symbol == "VNINDEX")\
        .order_by(desc(IndexSnapshot.trading_date))\
        .limit(50)\
        .all()
        
    vnindex_history = [{
        "date": s.trading_date.isoformat(),
        "value": s.point,
        "volume": s.total_volume,
        "change": s.change_point
    } for s in reversed(history_snapshots)]

    latest_snapshot = history_snapshots[0] if history_snapshots else None
    latest_complete_snapshot = (
        db.query(IndexSnapshot)
        .filter(
            IndexSnapshot.symbol == "VNINDEX",
            ((IndexSnapshot.total_volume.isnot(None)) & (IndexSnapshot.total_volume > 0))
            | ((IndexSnapshot.total_value.isnot(None)) & (IndexSnapshot.total_value > 0)),
        )
        .order_by(desc(IndexSnapshot.trading_date))
        .first()
    )
    display_snapshot = latest_complete_snapshot or latest_snapshot

    if vnindex_live:
        db_payload = _snapshot_dict(display_snapshot)
        vnindex = {
            "symbol": "VNINDEX",
            "price": _to_float(vnindex_live.get("price") or vnindex_live.get("IndexValue") or db_payload.get("price")),
            "change": _to_float(vnindex_live.get("change") or vnindex_live.get("Change") or db_payload.get("change")),
            "change_percent": _to_float(vnindex_live.get("change_percent") or vnindex_live.get("RatioChange") or db_payload.get("change_percent")),
            "trading_date": vnindex_live.get("trading_date") or db_payload.get("trading_date") or datetime.now().date().isoformat(),
            "total_volume": _to_int(vnindex_live.get("total_volume") or db_payload.get("total_volume")),
            "total_value": _value_in_billion(vnindex_live.get("total_value") or db_payload.get("total_value")),
            "breadth_green": _to_int(vnindex_live.get("breadth_green") if vnindex_live.get("breadth_green") is not None else db_payload.get("breadth_green")),
            "breadth_red": _to_int(vnindex_live.get("breadth_red") if vnindex_live.get("breadth_red") is not None else db_payload.get("breadth_red")),
            "breadth_yellow": _to_int(vnindex_live.get("breadth_yellow") if vnindex_live.get("breadth_yellow") is not None else db_payload.get("breadth_yellow")),
            "breadth_ceiling": _to_int(vnindex_live.get("breadth_ceiling") if vnindex_live.get("breadth_ceiling") is not None else db_payload.get("breadth_ceiling")),
            "breadth_floor": _to_int(vnindex_live.get("breadth_floor") if vnindex_live.get("breadth_floor") is not None else db_payload.get("breadth_floor")),
            "status": "LIVE",
            "history": vnindex_history
        }
    elif display_snapshot:
        vnindex = _snapshot_dict(display_snapshot)
        vnindex["status"] = "CLOSED"
        vnindex["history"] = vnindex_history
    else:
        vnindex = None

    # 2. Foreign Trade
    from sqlalchemy.sql import func
    ft_date = (
        db.query(func.max(ForeignTrading.trading_date))
        .filter((ForeignTrading.f_buy_val != 0) | (ForeignTrading.f_sell_val != 0) | (ForeignTrading.net_val != 0))
        .scalar()
    )
    foreign = {"top_buy": [], "top_sell": [], "total_net_val": 0.0}
    if ft_date:
        top_buy = (
            db.query(ForeignTrading)
            .filter(ForeignTrading.trading_date == ft_date, ForeignTrading.net_val > 0)
            .order_by(desc(ForeignTrading.net_val))
            .limit(10)
            .all()
        )
        top_sell = (
            db.query(ForeignTrading)
            .filter(ForeignTrading.trading_date == ft_date, ForeignTrading.net_val < 0)
            .order_by(asc(ForeignTrading.net_val))
            .limit(10)
            .all()
        )
        b = float(db.execute(text("SELECT SUM(f_buy_val) FROM foreign_trading WHERE trading_date = :d"), {"d": ft_date}).scalar() or 0)
        s = float(db.execute(text("SELECT SUM(f_sell_val) FROM foreign_trading WHERE trading_date = :d"), {"d": ft_date}).scalar() or 0)
        foreign = {"top_buy": top_buy, "top_sell": top_sell, "total_net_val": b - s}

    # 3. Top Impact
    active_date = get_active_session_date(db)
    pos_query = text("""
        SELECT symbol, sector, price, ref_price, change_percent, impact_value
        FROM impact_metrics
        WHERE impact_value > 0 AND trading_date = :dt
        ORDER BY impact_value DESC
        LIMIT 10
    """)
    neg_query = text("""
        SELECT symbol, sector, price, ref_price, change_percent, impact_value
        FROM impact_metrics
        WHERE impact_value < 0 AND trading_date = :dt
        ORDER BY impact_value ASC
        LIMIT 10
    """)
    try:
        impact = {
            "positive": [dict(r._mapping) for r in db.execute(pos_query, {"dt": active_date}).fetchall()],
            "negative": [dict(r._mapping) for r in db.execute(neg_query, {"dt": active_date}).fetchall()]
        }
    except Exception:
        impact = {"positive": [], "negative": []}
    if not impact["positive"] and not impact["negative"]:
        fallback_query = text("""
            WITH caps AS (
                SELECT
                    m.symbol,
                    s.sector,
                    m.price,
                    m.ref_price,
                    COALESCE(m.change_percent, CASE WHEN m.ref_price > 0 THEN ((m.price - m.ref_price) / m.ref_price) * 100 ELSE 0 END) AS change_percent,
                    COALESCE(NULLIF(s.listed_shares, 0), 1) AS listed_shares,
                    SUM(m.price * COALESCE(NULLIF(s.listed_shares, 0), 1)) OVER () AS total_market_cap
                FROM market_prices m
                LEFT JOIN stocks s ON m.symbol = s.symbol
                WHERE m.trading_date = :dt
                  AND m.price IS NOT NULL
                  AND m.ref_price IS NOT NULL
                  AND m.ref_price > 0
            )
            SELECT
                symbol,
                sector,
                price,
                ref_price,
                change_percent,
                (:vnindex_point * ((price * listed_shares) / NULLIF(total_market_cap, 0)) * ((price - ref_price) / ref_price)) AS impact_value
            FROM caps
            ORDER BY impact_value DESC
        """)
        fallback_rows = [
            dict(r._mapping)
            for r in db.execute(
                fallback_query,
                {"dt": active_date, "vnindex_point": (vnindex or {}).get("price") or 0},
            ).fetchall()
        ]
        impact = {
            "positive": [r for r in fallback_rows if (r.get("impact_value") or 0) > 0][:10],
            "negative": [r for r in reversed(fallback_rows) if (r.get("impact_value") or 0) < 0][:10],
        }

    # 4. Sector Performance
    sector_query = text("""
        SELECT trading_date, sector, avg_change, total_stocks
        FROM sector_performance_metrics
        WHERE trading_date = (SELECT MAX(trading_date) FROM sector_performance_metrics)
          AND sector IS NOT NULL
        ORDER BY avg_change DESC
    """)
    try:
        sectors = [dict(r._mapping) for r in db.execute(sector_query).fetchall()]
    except Exception:
        sectors = []
    if not sectors:
        reverse_sector = {}
        for sector, symbols in SECTOR_MAPPING.items():
            for symbol in symbols:
                reverse_sector[symbol] = sector

        rows = db.execute(text("""
            SELECT
                m.symbol,
                m.trading_date,
                COALESCE(m.change_percent, CASE WHEN m.ref_price > 0 THEN ((m.price - m.ref_price) / m.ref_price) * 100 ELSE 0 END) AS change_percent
            FROM market_prices m
            WHERE m.trading_date = :dt
              AND m.price IS NOT NULL
              AND m.ref_price IS NOT NULL
        """), {"dt": active_date}).fetchall()

        grouped = {}
        leaders = {}
        for row in rows:
            sector = reverse_sector.get(row.symbol)
            if not sector:
                continue
            change = float(row.change_percent or 0)
            grouped.setdefault(sector, []).append(change)
            leaders.setdefault(sector, []).append((row.symbol, change))

        sectors = sorted(
            [
                {
                    "trading_date": active_date,
                    "sector": sector,
                    "avg_change": sum(values) / len(values),
                    "total_stocks": len(values),
                    "top_symbols": ", ".join(
                        symbol
                        for symbol, _ in sorted(leaders.get(sector, []), key=lambda item: item[1], reverse=True)[:3]
                    ),
                }
                for sector, values in grouped.items()
            ],
            key=lambda item: item["avg_change"],
            reverse=True,
        )

    return {
        "vnindex": vnindex,
        "foreign": foreign,
        "impact": impact,
        "sectors": sectors,
        "server_time": datetime.now().isoformat()
    }

@router.get("/live/vnindex")
def get_live_vnindex():
    """
    Standardized Intelligence Node: VNINDEX
    Returns a unified structure regardless of source (Live SSI or DB Fallback).
    """
    from src.services.sync_manager import sync_manager
    from sqlalchemy import desc
    
    # 1. Attempt Live SSI Data
    data = sync_manager.ssi.get_index_summary("VNINDEX")
    
    if data:
        return {
            "symbol": "VNINDEX",
            "price": data.get("IndexValue", 0),
            "change": data.get("Change", 0),
            "change_percent": data.get("RatioChange", 0),
            "volume": data.get("TotalTrade", 0),
            "value": data.get("TotalValue", 0),
            "status": "LIVE",
            "is_fallback": False
        }
        
    # 2. Fallback to Database Snapshot
    from src.models.schema import IndexSnapshot
    from src.database import SessionLocal
    db = SessionLocal()
    snapshot = db.query(IndexSnapshot).order_by(desc(IndexSnapshot.trading_date)).first()
    db.close()
    
    if snapshot:
        return {
            "symbol": snapshot.symbol,
            "price": snapshot.point,
            "change": snapshot.change_point,
            "change_percent": snapshot.change_percent,
            "volume": snapshot.total_volume,
            "value": snapshot.total_value,
            "status": "CLOSED",
            "is_fallback": True
        }
        
    raise HTTPException(status_code=503, detail="Market data source unavailable")
