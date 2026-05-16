import os
from fastapi import FastAPI, Depends, Security, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from src.api.routers import market, report, portfolio, profile, inquiry, notification
from src.modules.identity import router as identity_router
from src.modules.workspace import router as workspace_router
from src.scheduler import start_scheduler
from src.workers.market_streamer import start_streams
from src.cache import db
from typing import List

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from src.api.dependencies import limiter

# --- WEBSOCKET MANAGER ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass

socket_manager = ConnectionManager()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start APScheduler & Intelligence Streams with WebSocket support
    scheduler = start_scheduler()
    await start_streams(socket_manager)
    yield
    # Shutdown: Stop Scheduler & cleanup
    scheduler.shutdown()
    db.stop_flusher()

app = FastAPI(
    title="Brokez Intelligence API",
    description="Backend API phục vụ Brokez Terminal",
    version="2.0.0",
    lifespan=lifespan
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.get("/", tags=["System"])
def root():
    """Trang chủ chào mừng."""
    return {
        "message": "Mirae Asset Automation API is running!",
        "version": "2.0.0",
        "docs": "/docs",
        "health": "/health"
    }

# CORS middleware
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    origins.append(frontend_url)

# CORS middleware - Broadened for local development reliability
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_key_header = APIKeyHeader(name="X-API-KEY", auto_error=False)
def get_api_key(api_key: str = Security(api_key_header)):
    expected_key = os.getenv("API_SECRET_KEY", "mirae-dev-key")
    if not api_key or api_key != expected_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API Key"
        )
    return api_key

app.include_router(market.router, dependencies=[Depends(get_api_key)])
app.include_router(report.router, dependencies=[Depends(get_api_key)])
app.include_router(portfolio.router, dependencies=[Depends(get_api_key)])
app.include_router(profile.router, dependencies=[Depends(get_api_key)])
app.include_router(inquiry.router, dependencies=[Depends(get_api_key)])
app.include_router(notification.router, dependencies=[Depends(get_api_key)])
app.include_router(identity_router.router)
app.include_router(workspace_router.router)

@app.api_route("/health", methods=["GET", "HEAD"], tags=["System"])
def health_check():
    """Endpoint for load balancers and deployment verification."""
    return {"status": "ok"}

@app.websocket("/ws/market")
async def websocket_endpoint(websocket: WebSocket):
    await socket_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text() # Keep connection alive
    except WebSocketDisconnect:
        socket_manager.disconnect(websocket)

# End of file
