# Global state to track background syncing and cached market data
SYSTEM_STATUS = {
    "state": "READY",
    "message": "Hệ thống sẵn sàng",
    "progress": 0,
    "total": 0
}

# The "Hot Cache" - Stores the latest intelligence nodes from SSI
# Format: { "VNINDEX": { "price": 1200, ... }, "SSI": { ... } }
MARKET_DATA = {}
