import sys
from datetime import date
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from src.api.routers import market
from src.database import get_db
from src.models.schema import ForeignTrading, IndexSnapshot, MarketPrice, Stock


TRADING_DATE = date(2026, 5, 16)


@pytest.fixture()
def client(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    for table in [Stock.__table__, MarketPrice.__table__, ForeignTrading.__table__, IndexSnapshot.__table__]:
        table.create(engine)

    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    db.add_all(
        [
            IndexSnapshot(
                symbol="VNINDEX",
                trading_date=TRADING_DATE,
                point=1000.0,
                change_point=5.0,
                change_percent=0.5,
                total_volume=1_000_000,
                total_value=15_000_000_000_000,
                breadth_green=2,
                breadth_red=1,
                breadth_yellow=0,
                breadth_ceiling=0,
                breadth_floor=0,
            ),
            Stock(symbol="ACB", sector="Ngân hàng", listed_shares=1_000),
            Stock(symbol="VCB", sector="Ngân hàng", listed_shares=10_000),
            Stock(symbol="HPG", sector="Tài nguyên Cơ bản", listed_shares=2_000),
            MarketPrice(symbol="ACB", trading_date=TRADING_DATE, price=11.0, ref_price=10.0, change_percent=10.0, volume=100),
            MarketPrice(symbol="VCB", trading_date=TRADING_DATE, price=11.0, ref_price=10.0, change_percent=10.0, volume=100),
            MarketPrice(symbol="HPG", trading_date=TRADING_DATE, price=9.0, ref_price=10.0, change_percent=-10.0, volume=100),
            ForeignTrading(symbol="VCB", trading_date=TRADING_DATE, f_buy_val=10_000_000_000, f_sell_val=1_000_000_000, net_val=9_000_000_000),
            ForeignTrading(symbol="HPG", trading_date=TRADING_DATE, f_buy_val=1_000_000_000, f_sell_val=5_000_000_000, net_val=-4_000_000_000),
        ]
    )
    db.commit()
    db.close()

    app = FastAPI()
    app.include_router(market.router)

    def override_get_db():
        test_db = TestingSessionLocal()
        try:
            yield test_db
        finally:
            test_db.close()

    app.dependency_overrides[get_db] = override_get_db
    monkeypatch.setattr(market.sync_manager, "get_status", lambda: {})

    with TestClient(app) as test_client:
        yield test_client


def test_market_snapshot_uses_source_labels_and_fallbacks(client, monkeypatch):
    monkeypatch.setattr(
        market.sync_manager,
        "get_status",
        lambda: {"status": "completed", "type": "EOD", "date": TRADING_DATE.isoformat()},
    )

    response = client.get("/api/v1/market/snapshot")

    assert response.status_code == 200
    payload = response.json()
    assert payload["vnindex"]["source_label"] == "DB snapshot"
    assert payload["foreign"]["source_label"] == "SSI EOD đã chốt"
    assert payload["foreign"]["is_eod"] is True
    assert payload["impact"]["source_label"] == "DNSE + listed shares"
    assert payload["impact"]["positive"][0]["symbol"] == "VCB"
    assert payload["sources"]["sectors"] == "Mapping ngành - dữ liệu tạm thời"


def test_foreign_trading_marks_intraday_as_temporary(client):
    response = client.get("/api/v1/foreign-trading?limit=10")

    assert response.status_code == 200
    payload = response.json()
    assert payload["source"] == "DNSE_INTRADAY_WITH_SSI_FALLBACK"
    assert payload["source_label"] == "DNSE intraday - dữ liệu tạm thời"
    assert payload["is_eod"] is False
    assert payload["top_buy"][0]["symbol"] == "VCB"
    assert payload["top_sell"][0]["symbol"] == "HPG"


def test_top_impact_fallback_weights_by_listed_shares(client):
    response = client.get("/api/v1/top-impact?limit=2")

    assert response.status_code == 200
    payload = response.json()
    assert payload["source_label"] == "DNSE + listed shares"
    assert [row["symbol"] for row in payload["positive"]] == ["VCB", "ACB"]
    assert payload["positive"][0]["impact_value"] > payload["positive"][1]["impact_value"]


def test_sector_performance_falls_back_when_view_is_missing(client):
    response = client.get("/api/v1/sector-performance")

    assert response.status_code == 200
    payload = response.json()
    assert payload["source"] == "DNSE_SECTOR_FALLBACK"
    assert payload["source_label"] == "Mapping ngành - dữ liệu tạm thời"
    banking = next(row for row in payload["sectors"] if row["sector"] == "Ngân hàng")
    assert banking["total_stocks"] == 2
    assert banking["avg_change"] == 10.0


def test_sync_eod_is_paused_and_does_not_start_job(client, monkeypatch):
    async def fail_if_called(_symbols):
        raise AssertionError("start_eod_sync must not be called while EOD sync is paused")

    monkeypatch.setattr(market.sync_manager, "start_eod_sync", fail_if_called)

    response = client.post("/api/v1/sync-eod")

    assert response.status_code == 200
    assert response.json()["status"] == "paused"
    assert response.json()["started"] is False
