import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.config import SECTOR_MAPPING
from src.workers.market_streamer import initial_seed_data


async def main():
    symbols = sorted({symbol for symbols in SECTOR_MAPPING.values() for symbol in symbols})
    total = 0
    for index in range(0, len(symbols), 80):
        batch = symbols[index:index + 80]
        print(f"batch {index // 80 + 1}: {len(batch)} symbols", flush=True)
        result = await initial_seed_data(batch)
        print(result, flush=True)
        total += result.get("stocks", 0)
    print(f"total_stocks={total}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
