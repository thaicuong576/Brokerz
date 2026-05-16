"""add_market_views

Revision ID: 487f8223b0b8
Revises: 7e9d14417e07
Create Date: 2026-05-16 19:16:02.161488
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '487f8223b0b8'
down_revision: Union[str, None] = '7e9d14417e07'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. View impact_metrics
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

    # 2. View sector_performance_metrics
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


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS sector_performance_metrics;")
    op.execute("DROP VIEW IF EXISTS impact_metrics;")
