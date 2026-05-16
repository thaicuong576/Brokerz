"use client";

import { useState } from "react";
import { Clock3 } from "lucide-react";

import api from "@/lib/api";
import { useForeignTrading, useSyncStatus } from "@/hooks/useMarketData";

export default function ForeignActivityPanel({ isBroker = false }: { isBroker?: boolean }) {
  const { data, isLoading, error } = useForeignTrading();
  const { data: syncStatus, mutate: mutateSync } = useSyncStatus();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    const now = new Date();
    const isEarly = now.getHours() < 15 || (now.getHours() === 15 && now.getMinutes() < 10);

    if (isEarly) {
      const confirmed = confirm(
        "Thị trường chưa kết thúc phiên ATC. Dữ liệu khối ngoại có thể chưa đầy đủ. Bạn vẫn muốn đồng bộ?"
      );
      if (!confirmed) return;
    }

    try {
      setIsSyncing(true);
      await api.post("/sync-eod");
      mutateSync();
    } catch (err) {
      alert(`Không khởi động được đồng bộ: ${err}`);
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) return <div className="h-48 animate-pulse rounded-lg border border-panel-border bg-panel" />;

  if (error || !data) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-panel-border bg-panel text-market-down">
        Không tải được dữ liệu khối ngoại
      </div>
    );
  }

  const isRunning = syncStatus?.status === "running";
  const isEOD = syncStatus?.type === "EOD" && syncStatus?.status === "completed";
  const isIntraday = syncStatus?.type === "INTRADAY" && syncStatus?.status === "completed";

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-panel-border bg-panel shadow-md">
      <div className="flex items-start justify-between border-b border-panel-border bg-[#1a1a1a] p-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-zinc-200">Khối ngoại mua/bán</h3>
            {isEOD && (
              <span className="rounded border border-market-up/20 bg-market-up/10 px-1.5 py-0.5 text-[10px] font-bold text-market-up">
                Đã chốt EOD
              </span>
            )}
            {isIntraday && (
              <span className="rounded border border-market-ref/20 bg-market-ref/10 px-1.5 py-0.5 text-[10px] font-bold text-market-ref">
                Tạm thời
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-amber-300">
            <Clock3 className="h-3 w-3" />
            <span>DNSE cập nhật nhanh, SSI bổ sung dữ liệu EOD sau khoảng 7-8 phút</span>
          </div>
          {data.top_buy.length > 0 && (
            <span className="text-[10px] text-zinc-500">Phiên: {data.top_buy[0].trading_date}</span>
          )}
        </div>

        {isBroker && (
          <button
            onClick={handleSync}
            disabled={isRunning || isSyncing}
            className={`rounded px-3 py-1.5 text-xs font-bold shadow transition-all ${
              isRunning
                ? "cursor-not-allowed bg-zinc-800 text-zinc-500"
                : isEOD
                  ? "bg-market-up text-black"
                  : "border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
            }`}
          >
            {isRunning ? "Đang đồng bộ..." : isEOD ? "Đã chốt EOD" : "Đồng bộ EOD"}
          </button>
        )}
      </div>

      {isRunning && (
        <div className="bg-[#1a1a1a] px-4 pb-3">
          <div className="mb-1 flex justify-between text-[10px]">
            <span className="text-zinc-400">
              Đang quét {syncStatus.type}: {syncStatus.processed}/{syncStatus.total} mã
            </span>
            <span className="text-market-up">~{Math.round(syncStatus.eta_seconds / 60)} phút</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-market-up transition-all duration-500"
              style={{ width: `${(syncStatus.processed / syncStatus.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex-1 divide-y divide-panel-border">
        <div className="p-3">
          <div className="mb-2 text-xs font-semibold uppercase text-market-up">Mua ròng</div>
          <div className="space-y-2">
            {data.top_buy.slice(0, 6).map((item) => (
              <div key={item.symbol} className="flex items-center justify-between text-sm">
                <span className="w-12 font-bold text-zinc-300">{item.symbol}</span>
                <div className="mx-3 h-1.5 flex-1 overflow-hidden rounded-full bg-[#262626]">
                  <div
                    className="h-full bg-market-up opacity-80"
                    style={{ width: `${Math.min((item.net_val / 1e9 / 600) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-right font-medium tabular-nums text-market-up">
                  {(item.net_val / 1e9).toFixed(2)} tỷ
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3">
          <div className="mb-2 text-xs font-semibold uppercase text-market-down">Bán ròng</div>
          <div className="space-y-2">
            {data.top_sell.slice(0, 6).map((item) => (
              <div key={item.symbol} className="flex items-center justify-between text-sm">
                <span className="w-12 font-bold text-zinc-300">{item.symbol}</span>
                <div className="mx-3 flex h-1.5 flex-1 justify-end overflow-hidden rounded-full bg-[#262626]">
                  <div
                    className="h-full bg-market-down opacity-80"
                    style={{ width: `${Math.min((Math.abs(item.net_val / 1e9) / 600) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-right font-medium tabular-nums text-market-down">
                  {(item.net_val / 1e9).toFixed(2)} tỷ
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
