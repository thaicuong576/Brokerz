"""improve market views

Revision ID: a2d7c9f4e3b1
Revises: 8b2d0f5c1a77
Create Date: 2026-05-17 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op


revision: str = "a2d7c9f4e3b1"
down_revision: Union[str, None] = "8b2d0f5c1a77"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE OR REPLACE VIEW impact_metrics AS
        WITH caps AS (
            SELECT
                m.symbol,
                s.sector,
                m.price,
                m.ref_price,
                COALESCE(m.change_percent, CASE WHEN m.ref_price > 0 THEN ((m.price - m.ref_price) / m.ref_price) * 100 ELSE 0 END) AS change_percent,
                m.trading_date,
                COALESCE(NULLIF(s.listed_shares, 0), 1) AS listed_shares,
                SUM(m.price * COALESCE(NULLIF(s.listed_shares, 0), 1)) OVER (PARTITION BY m.trading_date) AS total_market_cap,
                idx.point AS index_point
            FROM market_prices m
            LEFT JOIN stocks s ON m.symbol = s.symbol
            LEFT JOIN index_snapshot idx ON idx.symbol = 'VNINDEX' AND idx.trading_date = m.trading_date
            WHERE m.price IS NOT NULL AND m.ref_price IS NOT NULL AND m.ref_price > 0
        )
        SELECT
            symbol,
            sector,
            price,
            ref_price,
            change_percent,
            trading_date,
            COALESCE(index_point, 0) * ((price * listed_shares) / NULLIF(total_market_cap, 0)) * ((price - ref_price) / ref_price) AS impact_value
        FROM caps;
    """)

    op.execute("""
        CREATE OR REPLACE VIEW sector_performance_metrics AS
        WITH ranked AS (
            SELECT
                m.trading_date,
                s.sector,
                m.symbol,
                COALESCE(m.change_percent, CASE WHEN m.ref_price > 0 THEN ((m.price - m.ref_price) / m.ref_price) * 100 ELSE 0 END) AS change_percent,
                ROW_NUMBER() OVER (
                    PARTITION BY m.trading_date, s.sector
                    ORDER BY COALESCE(m.change_percent, CASE WHEN m.ref_price > 0 THEN ((m.price - m.ref_price) / m.ref_price) * 100 ELSE 0 END) DESC
                ) AS rn
            FROM market_prices m
            JOIN stocks s ON m.symbol = s.symbol
            WHERE s.sector IS NOT NULL
              AND m.price IS NOT NULL
              AND m.ref_price IS NOT NULL
        )
        SELECT
            trading_date,
            sector,
            AVG(change_percent) AS avg_change,
            COUNT(symbol) AS total_stocks,
            STRING_AGG(symbol, ', ' ORDER BY change_percent DESC) FILTER (WHERE rn <= 3) AS top_symbols
        FROM ranked
        GROUP BY trading_date, sector;
    """)


def downgrade() -> None:
    op.execute("""
        CREATE OR REPLACE VIEW impact_metrics AS
        SELECT
            m.symbol,
            s.sector,
            m.price,
            m.ref_price,
            m.change_percent,
            m.trading_date,
            ((m.price - m.ref_price) * s.listed_shares) AS impact_value
        FROM market_prices m
        JOIN stocks s ON m.symbol = s.symbol;
    """)

    op.execute("""
        CREATE OR REPLACE VIEW sector_performance_metrics AS
        SELECT
            m.trading_date,
            s.sector,
            AVG(m.change_percent) AS avg_change,
            COUNT(m.symbol) AS total_stocks
        FROM market_prices m
        JOIN stocks s ON m.symbol = s.symbol
        GROUP BY m.trading_date, s.sector;
    """)
