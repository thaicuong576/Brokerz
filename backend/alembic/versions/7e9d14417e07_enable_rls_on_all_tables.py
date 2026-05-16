"""Enable RLS on all tables

Revision ID: 7e9d14417e07
Revises: fcdf6622e73a
Create Date: 2026-05-16 18:27:57.660024
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '7e9d14417e07'
down_revision: Union[str, None] = 'fcdf6622e73a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Bật RLS cho tất cả các bảng
    tables = [
        "profiles",
        "broker_workspaces",
        "workspace_memberships",
        "stocks",
        "market_prices",
        "portfolios",
        "portfolio_items",
        "recommendations",
        "inquiries",
        "inquiry_messages",
        "notifications"
    ]
    for table in tables:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")


def downgrade() -> None:
    tables = [
        "profiles",
        "broker_workspaces",
        "workspace_memberships",
        "stocks",
        "market_prices",
        "portfolios",
        "portfolio_items",
        "recommendations",
        "inquiries",
        "inquiry_messages",
        "notifications"
    ]
    for table in tables:
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")
