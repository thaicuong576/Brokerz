"""add daily briefs

Revision ID: 8b2d0f5c1a77
Revises: 68e47f0713d5
Create Date: 2026-05-17 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "8b2d0f5c1a77"
down_revision: Union[str, None] = "68e47f0713d5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "daily_briefs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("workspace_id", sa.UUID(), nullable=False),
        sa.Column("broker_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("content_markdown", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("market_date", sa.Date(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["broker_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workspace_id"], ["broker_workspaces.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_daily_briefs_workspace_id"), "daily_briefs", ["workspace_id"], unique=False)
    op.create_index(op.f("ix_daily_briefs_broker_id"), "daily_briefs", ["broker_id"], unique=False)
    op.create_index("ix_daily_briefs_workspace_status_published", "daily_briefs", ["workspace_id", "status", "published_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_daily_briefs_workspace_status_published", table_name="daily_briefs")
    op.drop_index(op.f("ix_daily_briefs_broker_id"), table_name="daily_briefs")
    op.drop_index(op.f("ix_daily_briefs_workspace_id"), table_name="daily_briefs")
    op.drop_table("daily_briefs")
