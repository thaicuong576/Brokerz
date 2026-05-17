"""portfolio recommendation flow

Revision ID: 20260517_0002
Revises: a2d7c9f4e3b1
Create Date: 2026-05-17
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260517_0002"
down_revision: Union[str, None] = "a2d7c9f4e3b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("portfolios", sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index("ix_portfolios_workspace_id", "portfolios", ["workspace_id"])
    op.create_foreign_key(
        "fk_portfolios_workspace_id",
        "portfolios",
        "broker_workspaces",
        ["workspace_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.add_column("portfolio_items", sa.Column("active_thesis", sa.Text(), nullable=True))
    op.add_column("portfolio_items", sa.Column("source_recommendation_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("portfolio_items", sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True))
    op.create_foreign_key(
        "fk_portfolio_items_source_recommendation_id",
        "portfolio_items",
        "ws_recommendations",
        ["source_recommendation_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "portfolio_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("recommendation_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("event_type", sa.String(length=40), nullable=False),
        sa.Column("before_state", sa.Text(), nullable=True),
        sa.Column("after_state", sa.Text(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["recommendation_id"], ["ws_recommendations.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["workspace_id"], ["broker_workspaces.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_portfolio_events_workspace_id", "portfolio_events", ["workspace_id"])
    op.create_index("ix_portfolio_events_recommendation_id", "portfolio_events", ["recommendation_id"])

    op.add_column("ws_recommendations", sa.Column("action_type", sa.String(length=30), server_default="BUY", nullable=False))
    op.add_column("ws_recommendations", sa.Column("applied_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("ws_recommendations", sa.Column("applied_portfolio_event_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("ws_recommendations", sa.Column("parent_recommendation_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_ws_recommendations_applied_portfolio_event_id",
        "ws_recommendations",
        "portfolio_events",
        ["applied_portfolio_event_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_ws_recommendations_parent_recommendation_id",
        "ws_recommendations",
        "ws_recommendations",
        ["parent_recommendation_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.execute("UPDATE ws_recommendations SET action_type = side WHERE action_type IS NULL OR action_type = 'BUY'")
    op.execute("UPDATE ws_recommendations SET status = 'PUBLISHED' WHERE status = 'ACTIVE'")

    op.create_table(
        "dashboard_layouts",
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("layout_json", sa.Text(), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["updated_by"], ["profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["workspace_id"], ["broker_workspaces.id"], ondelete="CASCADE"),
    )


def downgrade() -> None:
    op.drop_table("dashboard_layouts")
    op.execute("UPDATE ws_recommendations SET status = 'ACTIVE' WHERE status IN ('PUBLISHED', 'PUBLISHED_ONLY', 'APPLIED_TO_PORTFOLIO')")
    op.drop_constraint("fk_ws_recommendations_parent_recommendation_id", "ws_recommendations", type_="foreignkey")
    op.drop_constraint("fk_ws_recommendations_applied_portfolio_event_id", "ws_recommendations", type_="foreignkey")
    op.drop_column("ws_recommendations", "parent_recommendation_id")
    op.drop_column("ws_recommendations", "applied_portfolio_event_id")
    op.drop_column("ws_recommendations", "applied_at")
    op.drop_column("ws_recommendations", "action_type")
    op.drop_index("ix_portfolio_events_recommendation_id", table_name="portfolio_events")
    op.drop_index("ix_portfolio_events_workspace_id", table_name="portfolio_events")
    op.drop_table("portfolio_events")
    op.drop_constraint("fk_portfolio_items_source_recommendation_id", "portfolio_items", type_="foreignkey")
    op.drop_column("portfolio_items", "updated_at")
    op.drop_column("portfolio_items", "source_recommendation_id")
    op.drop_column("portfolio_items", "active_thesis")
    op.drop_constraint("fk_portfolios_workspace_id", "portfolios", type_="foreignkey")
    op.drop_index("ix_portfolios_workspace_id", table_name="portfolios")
    op.drop_column("portfolios", "workspace_id")
