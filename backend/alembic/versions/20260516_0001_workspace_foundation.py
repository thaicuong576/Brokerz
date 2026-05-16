"""workspace foundation

Revision ID: 20260516_0001
Revises:
Create Date: 2026-05-16
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260516_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(), nullable=True, unique=True),
        sa.Column("full_name", sa.String(), nullable=True),
        sa.Column("avatar_url", sa.String(), nullable=True),
        sa.Column("role", sa.String(), nullable=False, server_default="INVESTOR"),
        sa.Column("soul_key", sa.String(), nullable=True, unique=True),
        sa.Column("linked_broker_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.CheckConstraint("role IN ('BROKER', 'INVESTOR')", name="profiles_role_check"),
    )
    op.create_foreign_key(
        "profiles_linked_broker_id_fkey",
        "profiles",
        "profiles",
        ["linked_broker_id"],
        ["id"],
    )

    op.create_table(
        "broker_workspaces",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("owner_profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("slug", sa.String(), nullable=True, unique=True),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["owner_profile_id"], ["profiles.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_broker_workspaces_owner_profile_id", "broker_workspaces", ["owner_profile_id"])

    op.create_table(
        "workspace_memberships",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="ACTIVE"),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.CheckConstraint("role IN ('OWNER', 'MEMBER')", name="workspace_memberships_role_check"),
        sa.CheckConstraint("status IN ('ACTIVE', 'REVOKED')", name="workspace_memberships_status_check"),
        sa.ForeignKeyConstraint(["workspace_id"], ["broker_workspaces.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["profile_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("workspace_id", "profile_id", name="uq_workspace_membership_profile"),
    )
    op.create_index("ix_workspace_memberships_profile_id", "workspace_memberships", ["profile_id"])
    op.create_index("ix_workspace_memberships_workspace_id", "workspace_memberships", ["workspace_id"])

    op.create_table(
        "soulkey_invites",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(), nullable=False, unique=True),
        sa.Column("label", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="ACTIVE"),
        sa.Column("max_redemptions", sa.Integer(), nullable=True),
        sa.Column("redemption_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("status IN ('ACTIVE', 'REVOKED')", name="soulkey_invites_status_check"),
        sa.ForeignKeyConstraint(["workspace_id"], ["broker_workspaces.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["profiles.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_soulkey_invites_workspace_id", "soulkey_invites", ["workspace_id"])


def downgrade() -> None:
    op.drop_index("ix_soulkey_invites_workspace_id", table_name="soulkey_invites")
    op.drop_table("soulkey_invites")
    op.drop_index("ix_workspace_memberships_workspace_id", table_name="workspace_memberships")
    op.drop_index("ix_workspace_memberships_profile_id", table_name="workspace_memberships")
    op.drop_table("workspace_memberships")
    op.drop_index("ix_broker_workspaces_owner_profile_id", table_name="broker_workspaces")
    op.drop_table("broker_workspaces")
    op.drop_table("profiles")
