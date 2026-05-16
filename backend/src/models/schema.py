from sqlalchemy import Column, String, BigInteger, Float, Date, DateTime, Integer, Boolean, Text
from src.database import Base
from sqlalchemy.sql import func

class Stock(Base):
    __tablename__ = "stocks"
    symbol = Column(String(10), primary_key=True)
    listed_shares = Column(BigInteger, nullable=False, default=0)
    sector = Column(String(50))
    is_active = Column(Boolean, default=True)

class MarketPrice(Base):
    __tablename__ = "market_prices"
    symbol = Column(String(10), primary_key=True)
    trading_date = Column(Date, primary_key=True)
    price = Column(Float, nullable=False, default=0)
    ref_price = Column(Float, nullable=False, default=0)
    change_percent = Column(Float)
    volume = Column(BigInteger, nullable=False, default=0)
    updated_at = Column(DateTime(timezone=True), default=func.now())

class ForeignTrading(Base):
    __tablename__ = "foreign_trading"
    symbol = Column(String(10), primary_key=True)
    trading_date = Column(Date, primary_key=True)
    f_buy_val = Column(Float, nullable=False, default=0)
    f_sell_val = Column(Float, nullable=False, default=0)
    net_val = Column(Float)
    updated_at = Column(DateTime(timezone=True), default=func.now())

class IndexSnapshot(Base):
    __tablename__ = "index_snapshot"
    symbol = Column(String(10), primary_key=True)
    trading_date = Column(Date, primary_key=True)
    point = Column(Float)
    change_point = Column(Float)
    change_percent = Column(Float)
    total_volume = Column(BigInteger)
    total_value = Column(Float)
    breadth_green = Column(Integer)
    breadth_red = Column(Integer)
    breadth_yellow = Column(Integer)
    breadth_ceiling = Column(Integer)
    breadth_floor = Column(Integer)
    updated_at = Column(DateTime(timezone=True), default=func.now())

from sqlalchemy.dialects.postgresql import UUID
import uuid

from sqlalchemy import ForeignKey
from sqlalchemy.orm import relationship

class Profile(Base):
    __tablename__ = "profiles"
    id = Column(UUID(as_uuid=True), primary_key=True)
    email = Column(String, unique=True, nullable=True)
    full_name = Column(String)
    avatar_url = Column(String)
    role = Column(String, default="INVESTOR")
    soul_key = Column(String, unique=True)
    linked_broker_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now())

class BrokerWorkspace(Base):
    __tablename__ = "broker_workspaces"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_profile_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), index=True, nullable=False)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=True)
    description = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now())

    owner = relationship("Profile", foreign_keys=[owner_profile_id])
    memberships = relationship("WorkspaceMembership", backref="workspace", cascade="all, delete-orphan")
    invites = relationship("SoulKeyInvite", backref="workspace", cascade="all, delete-orphan")

class WorkspaceMembership(Base):
    __tablename__ = "workspace_memberships"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("broker_workspaces.id", ondelete="CASCADE"), index=True, nullable=False)
    profile_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), index=True, nullable=False)
    role = Column(String, nullable=False, default="MEMBER") # OWNER, MEMBER
    status = Column(String, nullable=False, default="ACTIVE") # ACTIVE, REVOKED
    joined_at = Column(DateTime(timezone=True), default=func.now())

    profile = relationship("Profile", foreign_keys=[profile_id])

class SoulKeyInvite(Base):
    __tablename__ = "soulkey_invites"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("broker_workspaces.id", ondelete="CASCADE"), index=True, nullable=False)
    code = Column(String, unique=True, nullable=False)
    label = Column(String, nullable=True)
    status = Column(String, nullable=False, default="ACTIVE") # ACTIVE, REVOKED
    max_redemptions = Column(Integer, nullable=True)
    redemption_count = Column(Integer, nullable=False, default=0)
    created_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=func.now())
    revoked_at = Column(DateTime(timezone=True), nullable=True)

    creator = relationship("Profile", foreign_keys=[created_by])

class DailyBrief(Base):
    __tablename__ = "daily_briefs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("broker_workspaces.id", ondelete="CASCADE"), index=True, nullable=False)
    broker_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), index=True, nullable=False)
    title = Column(String, nullable=False)
    content_markdown = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="DRAFT")  # DRAFT, PUBLISHED, ARCHIVED
    market_date = Column(Date, nullable=False)
    published_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    workspace = relationship("BrokerWorkspace", foreign_keys=[workspace_id])
    broker = relationship("Profile", foreign_keys=[broker_id])

class Portfolio(Base):
    __tablename__ = "portfolios"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(String)
    is_public = Column(Boolean, default=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id"))
    created_at = Column(DateTime(timezone=True), default=func.now())

    items = relationship("PortfolioItem", backref="portfolio", cascade="all, delete-orphan")

class PortfolioItem(Base):
    __tablename__ = "portfolio_items"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id = Column(UUID(as_uuid=True), ForeignKey("portfolios.id", ondelete="CASCADE"), index=True)
    symbol = Column(String(10), nullable=False)
    weight = Column(Float, nullable=False)
    entry_price = Column(Float)
    reason = Column(String)
    created_at = Column(DateTime(timezone=True), default=func.now())

class Inquiry(Base):
    __tablename__ = "inquiries"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    status = Column(String, default="OPEN")
    created_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), index=True)
    assigned_broker = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), index=True)
    is_private = Column(Boolean, default=True)
    image_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now())

    messages = relationship("InquiryMessage", backref="inquiry", cascade="all, delete-orphan")

class InquiryMessage(Base):
    __tablename__ = "inquiry_messages"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inquiry_id = Column(UUID(as_uuid=True), ForeignKey("inquiries.id", ondelete="CASCADE"), index=True)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id"))
    content = Column(String, nullable=False)
    image_url = Column(String, nullable=True)
    is_ai_generated = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=func.now())

class WsRecommendation(Base):
    """Workspace-scoped recommendation with full lifecycle."""
    __tablename__ = "ws_recommendations"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("broker_workspaces.id", ondelete="CASCADE"), index=True, nullable=False)
    broker_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), index=True, nullable=False)
    symbol = Column(String(10), nullable=False)
    side = Column(String(4), nullable=False)  # BUY or SELL
    status = Column(String(20), nullable=False, default="DRAFT")  # DRAFT, ACTIVE, CLOSED, ARCHIVED
    entry_price = Column(Float, nullable=True)
    target_price = Column(Float, nullable=True)
    cutloss_price = Column(Float, nullable=True)
    thesis = Column(String, nullable=True)
    risk_note = Column(String, nullable=True)
    closed_reason = Column(String, nullable=True)  # TARGET_REACHED, CUTLOSS_HIT, MANUAL
    published_at = Column(DateTime(timezone=True), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    broker = relationship("Profile", foreign_keys=[broker_id])
    workspace = relationship("BrokerWorkspace", foreign_keys=[workspace_id])
    events = relationship("RecommendationEvent", backref="recommendation", cascade="all, delete-orphan", order_by="RecommendationEvent.created_at")

class RecommendationEvent(Base):
    """Immutable audit trail for recommendation lifecycle changes."""
    __tablename__ = "recommendation_events"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recommendation_id = Column(UUID(as_uuid=True), ForeignKey("ws_recommendations.id", ondelete="CASCADE"), index=True, nullable=False)
    event_type = Column(String(30), nullable=False)  # CREATED, PUBLISHED, THESIS_UPDATED, TARGET_UPDATED, CUTLOSS_UPDATED, CLOSED, ARCHIVED
    actor_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    before_state = Column(String, nullable=True)  # JSON snapshot
    after_state = Column(String, nullable=True)   # JSON snapshot
    note = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now())

    actor = relationship("Profile", foreign_keys=[actor_id])

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), index=True)
    type = Column(String, nullable=False) # RECOMMENDATION, INQUIRY_REPLY
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    link = Column(String, nullable=True) # ID of the related object
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=func.now())
