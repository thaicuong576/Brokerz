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
        "Thi truong chua ket thuc ATC (truoc 15:10). Du lieu co the lech. Ban van muon tiep tuc?"
      );
      if (!confirmed) {
        return;
      }
    }

    try {
      setIsSyncing(true);
      await api.post("/sync-eod");
      mutateSync();
    } catch (err) {
      alert(`Loi khoi dong sync: ${err}`);
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-lg border border-panel-border bg-panel" />;
  }

  if (error || !data) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-panel-border bg-panel text-red-500">
        Failed to load data
      </div>
    );
  }

  const isRunning = syncStatus?.status === "running";
  const isEOD = syncStatus?.type === "EOD" && syncStatus?.status === "completed";
  const isIntraday = syncStatus?.type === "INTRADAY" && syncStatus?.status === "completed";

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-panel-border bg-panel shadow-xl">
      <div className="flex items-start justify-between border-b border-panel-border bg-[#1a1a1a] p-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-200">Khoi ngoai Mua/Ban</h3>
            {isEOD && (
              <span className="rounded border border-market-up/20 bg-market-up/10 px-1.5 py-0.5 text-[10px] font-bold text-market-up">
                EOD CHOT
              </span>
            )}
            {isIntraday && (
              <span className="rounded border border-market-up/20 bg-market-up/10 px-1.5 py-0.5 text-[10px] font-bold italic text-market-up">
                TAM THOI
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-amber-300">
            <Clock3 className="h-3 w-3" />
            <span>Du lieu SSI, do tre uoc tinh khoang 8 phut</span>
          </div>
          {data.top_buy.length > 0 && (
            <span className="font-mono text-[10px] text-zinc-500">Session: {data.top_buy[0].trading_date}</span>
          )}
        </div>

        {isBroker && (
          <button
            onClick={handleSync}
            disabled={isRunning || isSyncing}
            className={`rounded px-3 py-1.5 text-xs font-black tracking-tight shadow-lg transition-all ${
              isRunning
                ? "cursor-not-allowed bg-zinc-800 text-zinc-500"
                : isEOD
                  ? "bg-market-up text-black"
                  : "border border-market-up/30 bg-market-up/20 text-market-up hover:bg-market-up/30"
            }`}
          >
            {isRunning ? "Dang sync..." : isEOD ? "Da chot EOD" : "Chot EOD Sync"}
          </button>
        )}
      </div>

      {isRunning && (
        <div className="bg-[#1a1a1a] px-4 pb-3">
          <div className="mb-1 flex justify-between text-[10px]">
            <span className="text-zinc-400">
              Dang quet {syncStatus.type}: {syncStatus.processed}/{syncStatus.total} ma
            </span>
            <span className="font-mono text-market-up">~{Math.round(syncStatus.eta_seconds / 60)} phut</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-market-up shadow-[0_0_10px_rgba(34,197,94,0.5)] transition-all duration-500"
              style={{ width: `${(syncStatus.processed / syncStatus.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex-1 divide-y divide-panel-border">
        <div className="p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-tight text-market-up">Top Mua</div>
          <div className="space-y-2">
            {data.top_buy.slice(0, 6).map((item) => (
              <div key={item.symbol} className="flex items-center justify-between text-sm">
                <span className="w-12 font-bold text-gray-300">{item.symbol}</span>
                <div className="mx-3 h-1.5 flex-1 overflow-hidden rounded-full bg-[#262626]">
                  <div
                    className="h-full bg-market-up opacity-80"
                    style={{ width: `${Math.min((item.net_val / 1e9 / 600) * 100, 100)}%` }}
                  />
                </div>
                <span className="tabular-nums text-right font-medium text-market-up">
                  {(item.net_val / 1e9).toFixed(2)} Ty
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-tight text-market-down">Top Ban</div>
          <div className="space-y-2">
            {data.top_sell.slice(0, 6).map((item) => (
              <div key={item.symbol} className="flex items-center justify-between text-sm">
                <span className="w-12 font-bold text-gray-300">{item.symbol}</span>
                <div className="mx-3 flex h-1.5 flex-1 justify-end overflow-hidden rounded-full bg-[#262626]">
                  <div
                    className="h-full bg-market-down opacity-80"
                    style={{ width: `${Math.min((Math.abs(item.net_val / 1e9) / 600) * 100, 100)}%` }}
                  />
                </div>
                <span className="tabular-nums text-right font-medium text-market-down">
                  {(item.net_val / 1e9).toFixed(2)} Ty
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
