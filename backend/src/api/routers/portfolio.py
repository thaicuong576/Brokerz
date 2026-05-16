from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from uuid import UUID, uuid4

from src.database import get_db
from src.models.schema import BrokerWorkspace, Portfolio, PortfolioItem, Profile, Notification, WorkspaceMembership
from sqlalchemy.orm import joinedload
from src.shared.auth.dependencies import CurrentActor, get_current_actor

router = APIRouter(prefix="/api/v1/portfolio", tags=["Portfolio"])

# --- PYDANTIC MODELS ---
class PortfolioItemSchema(BaseModel):
    symbol: str
    weight: float
    entry_price: Optional[float] = None
    reason: Optional[str] = None


    class Config:
        from_attributes = True

class PortfolioBase(BaseModel):
    name: str
    description: Optional[str] = None
    items: List[PortfolioItemSchema]

class PortfolioResponse(BaseModel):
    id: Optional[UUID] = None
    name: str
    description: Optional[str] = None
    created_by: Optional[UUID] = None
    created_at: Optional[datetime] = None
    items: List[PortfolioItemSchema] = []

    class Config:
        from_attributes = True

# --- RECOMMENDATION MODELS ---
class RecommendationSchema(BaseModel):
    symbol: str
    type: str # BUY / SELL
    reason: Optional[str] = None

class RecommendationResponse(BaseModel):
    id: UUID
    symbol: str
    type: str
    reason: Optional[str] = None
    trading_date: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- ENDPOINTS ---

@router.get("/recommendations")
async def get_recommendations(db: Session = Depends(get_db)):
    """Lấy danh sách khuyến nghị trong ngày kèm giá hiện tại."""
    from src.models.schema import Recommendation, MarketPrice
    from datetime import date
    from sqlalchemy import func
    
    today = date.today()
    
    # Lấy ngày giao dịch gần nhất
    latest_date = db.query(func.max(MarketPrice.trading_date)).scalar()
    
    recs = db.query(Recommendation).filter(Recommendation.trading_date == today).all()
    
    # Lấy giá của các mã trong recs
    symbols = [r.symbol for r in recs]
    prices = {p.symbol: p.price for p in db.query(MarketPrice).filter(MarketPrice.symbol.in_(symbols), MarketPrice.trading_date == latest_date).all()} if symbols else {}
    
    result = []
    for r in recs:
        res = {
            "id": r.id,
            "symbol": r.symbol,
            "type": r.type,
            "reason": r.reason,
            "trading_date": r.trading_date,
            "created_at": r.created_at,
            "current_price": prices.get(r.symbol, 0)
        }
        result.append(res)
    return result

@router.post("/recommendations", response_model=RecommendationResponse)
async def create_recommendation(data: RecommendationSchema, actor: CurrentActor = Depends(get_current_actor), db: Session = Depends(get_db)):
    """Broker tạo khuyến nghị mới."""
    from src.models.schema import Recommendation
    user_id = UUID(actor.id)
    new_rec = Recommendation(
        id=uuid4(),
        symbol=data.symbol.upper(),
        type=data.type.upper(),
        reason=data.reason,
        created_by=user_id
    )
    db.add(new_rec)
    db.commit()
    db.refresh(new_rec)

    # Notify followers
    workspace = db.query(BrokerWorkspace).filter(BrokerWorkspace.owner_profile_id == user_id).first()
    followers = []
    if workspace:
        memberships = (
            db.query(WorkspaceMembership)
            .filter(
                WorkspaceMembership.workspace_id == workspace.id,
                WorkspaceMembership.status == "ACTIVE",
                WorkspaceMembership.profile_id != user_id,
            )
            .all()
        )
        follower_ids = [m.profile_id for m in memberships]
        followers = db.query(Profile).filter(Profile.id.in_(follower_ids)).all() if follower_ids else []
    else:
        followers = db.query(Profile).filter(Profile.linked_broker_id == user_id).all()

    for f in followers:
        notif = Notification(
            user_id=f.id,
            type="RECOMMENDATION",
            title="Khuyến nghị mới",
            message=f"Broker của bạn vừa thêm khuyến nghị {new_rec.type} cho mã {new_rec.symbol}",
            link=new_rec.symbol
        )
        db.add(notif)
    db.commit()

    return new_rec

@router.delete("/recommendations/{rec_id}")
async def delete_recommendation(rec_id: UUID, actor: CurrentActor = Depends(get_current_actor), db: Session = Depends(get_db)):
    """Xóa khuyến nghị."""
    from src.models.schema import Recommendation
    user_id = UUID(actor.id)
    db.query(Recommendation).filter(Recommendation.id == rec_id, Recommendation.created_by == user_id).delete()
    db.commit()
    return {"status": "success"}

@router.patch("/recommendations/{rec_id}", response_model=RecommendationResponse)
async def update_recommendation(rec_id: UUID, data: RecommendationSchema, actor: CurrentActor = Depends(get_current_actor), db: Session = Depends(get_db)):
    """Cập nhật khuyến nghị."""
    from src.models.schema import Recommendation
    user_id = UUID(actor.id)
    rec = db.query(Recommendation).filter(Recommendation.id == rec_id, Recommendation.created_by == user_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    
    rec.symbol = data.symbol.upper()
    rec.type = data.type.upper()
    rec.reason = data.reason
    db.commit()
    db.refresh(rec)
    return rec

@router.get("/my-strategy", response_model=Optional[PortfolioResponse])
async def get_my_strategy(user_id: UUID, db: Session = Depends(get_db)):
    """Lấy danh mục chiến thuật của chính Broker."""
    try:

        print(f"🔍 FETCHING STRATEGY FOR USER: {user_id}")
        # Sử dụng joinedload để lấy luôn các items, tránh lỗi Lazy Loading
        portfolio = db.query(Portfolio).options(joinedload(Portfolio.items)).filter(Portfolio.created_by == user_id).first()
        
        if portfolio:
            print(f"✅ FOUND PORTFOLIO: {portfolio.id} WITH {len(portfolio.items)} ITEMS")
        else:
            print("❌ NO PORTFOLIO FOUND FOR THIS USER")
        return portfolio
    except Exception as e:
        print(f"💥 FETCH ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Lỗi truy vấn: {str(e)}")

@router.post("/sync-strategy", response_model=PortfolioResponse)
async def sync_strategy(data: PortfolioBase, actor: CurrentActor = Depends(get_current_actor), db: Session = Depends(get_db)):
    user_id = UUID(actor.id)
    """Đồng bộ (Lưu/Cập nhật) danh mục chiến thuật của Broker."""
    print(f"🚀 SYNCING STRATEGY FOR USER: {user_id}")
    print(f"📦 DATA RECEIVED: {len(data.items)} items")
    try:
        # Sử dụng merge để Upsert profile (nếu có rồi thì thôi, chưa có thì tạo)
        from src.models.schema import Profile
        new_profile = Profile(
            id=user_id,
            full_name="Master Broker (Eddie)",
            role="BROKER"
        )
        db.merge(new_profile)
        db.flush()

        # 1. Tìm portfolio hiện tại của user này
        existing_p = db.query(Portfolio).filter(Portfolio.created_by == user_id).first()
        
        if existing_p:
            print(f"🔄 Updating existing portfolio: {existing_p.id}")
            # Xóa các items cũ
            db.query(PortfolioItem).filter(PortfolioItem.portfolio_id == existing_p.id).delete()
            # Cập nhật thông tin chính
            existing_p.name = data.name
            existing_p.description = data.description
            p_id = existing_p.id
        else:
            print("✨ Creating brand new portfolio")
            # Tạo mới nếu chưa có
            new_p = Portfolio(
                id=uuid4(),
                name=data.name,
                description=data.description,
                created_by=user_id,
                is_public=True
            )
            db.add(new_p)
            db.flush()
            p_id = new_p.id

        # 2. Thêm các Items mới
        for item in data.items:
            print(f"   + Adding {item.symbol} at {item.entry_price}")
            db_item = PortfolioItem(
                portfolio_id=p_id,
                symbol=item.symbol,
                weight=item.weight,
                entry_price=item.entry_price,
                reason=item.reason

            )
            db.add(db_item)
        
        db.commit()
        print("🎯 SYNC COMPLETE!")
        # Fetch lại để có đầy đủ items (dùng joinedload)
        return db.query(Portfolio).options(joinedload(Portfolio.items)).filter(Portfolio.id == p_id).first()
    except Exception as e:
        print(f"💥 SYNC ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi đồng bộ: {str(e)}")

@router.get("/{portfolio_id}", response_model=PortfolioResponse)
async def get_portfolio_details(portfolio_id: UUID, db: Session = Depends(get_db)):
    """Lấy chi tiết một danh mục cụ thể."""
    portfolio = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Không tìm thấy danh mục")
    return portfolio
