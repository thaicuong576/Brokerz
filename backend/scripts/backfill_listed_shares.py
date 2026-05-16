import json
import sys
from pathlib import Path

from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.config import SECTOR_MAPPING
from src.database import engine


def main():
    cache_path = Path(__file__).resolve().parents[1] / "data" / "listed_shares_cache.json"
    shares = json.loads(cache_path.read_text(encoding="utf-8")).get("shares", {})
    sector_by_symbol = {
        symbol: sector
        for sector, symbols in SECTOR_MAPPING.items()
        for symbol in symbols
    }

    rows = [
        {
            "symbol": symbol,
            "listed_shares": int(value or 0),
            "sector": sector_by_symbol.get(symbol),
        }
        for symbol, value in shares.items()
        if int(value or 0) > 0
    ]

    with engine.begin() as conn:
        conn.execute(
            text("""
                INSERT INTO stocks (symbol, listed_shares, sector, is_active)
                VALUES (:symbol, :listed_shares, :sector, TRUE)
                ON CONFLICT (symbol) DO UPDATE SET
                    listed_shares = GREATEST(COALESCE(stocks.listed_shares, 0), EXCLUDED.listed_shares),
                    sector = COALESCE(stocks.sector, EXCLUDED.sector),
                    is_active = TRUE
            """),
            rows,
        )

    print(f"Backfilled listed_shares for {len(rows)} symbols")


if __name__ == "__main__":
    main()
