"use client";

import { Activity, ArrowDownRight, ArrowUpRight, BarChart2, Globe, TrendingUp } from "lucide-react";
import { useForeignTrading, useMarketOverview, usePollingControl, isMarketOpen } from "@/hooks/useMarketData";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorCard } from "@/components/ui/error-card";

export default function MarketMetricsRow() {
  const overview = useMarketOverview();
  const foreign = useForeignTrading();
  const { isLive, toggleLive } = usePollingControl();

  if (overview.error || foreign.error) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="col-span-full h-32">
          <ErrorCard message="Không tải được dữ liệu thị trường" onRetry={() => { overview.mutate(); foreign.mutate(); }} />
        </div>
      </div>
    );
  }

  if (overview.isLoading || foreign.isLoading || !overview.data || !foreign.data) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, index) => (
          <Skeleton key={index} className="h-[120px] w-full border border-panel-border" />
        ))}
      </div>
    );
  }

  const data = overview.data;
  const isUp = (data.change_point ?? 0) >= 0;
  const marketOpen = isMarketOpen();
  const foreignNet = foreign.data.total_net_val;
  const isForeignBuy = foreignNet >= 0;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      <div className="flex flex-col justify-center rounded-lg border border-panel-border bg-panel p-5 shadow-md">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-400">
            <Activity className="h-4 w-4 text-zinc-500" />
            {data.symbol}
          </h2>
          <button
            onClick={toggleLive}
            title={isLive ? "Tắt chế độ trực tiếp" : "Bật chế độ trực tiếp"}
            className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold transition-all ${
              isLive
                ? "border-primary/20 bg-primary/10 text-primary"
                : marketOpen
                  ? "border-market-up/20 bg-market-up/10 text-market-up"
                  : "border-zinc-700 bg-zinc-800 text-zinc-500"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isLive || marketOpen ? "animate-pulse bg-current" : "bg-zinc-600"}`} />
            {isLive ? "Trực tiếp" : marketOpen ? "Tự động" : "Ngoài giờ"}
          </button>
        </div>
        <div className="flex items-end justify-between">
          <span className={`text-3xl font-bold tabular-nums ${isUp ? "text-market-up" : "text-market-down"}`}>
            {data.point?.toFixed(2)}
          </span>
          <div className={`flex items-center text-sm font-semibold ${isUp ? "text-market-up" : "text-market-down"}`}>
            {isUp ? <ArrowUpRight className="mr-0.5 h-4 w-4" /> : <ArrowDownRight className="mr-0.5 h-4 w-4" />}
            {isUp ? "+" : ""}{data.change_point?.toFixed(2)} ({isUp ? "+" : ""}{data.change_percent?.toFixed(2)}%)
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-center rounded-lg border border-panel-border bg-panel p-5 shadow-md">
        <div className="mb-2 flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-400">Thanh khoản (Tỷ VNĐ)</h2>
        </div>
        <div className="flex items-end justify-between">
          <span className="text-2xl font-bold text-zinc-200">
            {(data.total_value ?? 0).toLocaleString("vi-VN", { maximumFractionDigits: 0 })}
          </span>
          <span className="text-sm font-medium text-zinc-500">GTGD</span>
        </div>
        <div className="mt-1 flex justify-between text-xs text-zinc-500">
          <span>Khối lượng:</span>
          <span className="font-medium text-zinc-300">{(data.total_volume ?? 0).toLocaleString("vi-VN")} CP</span>
        </div>
      </div>

      <div className="flex flex-col justify-center rounded-lg border border-panel-border bg-panel p-5 shadow-md">
        <div className="mb-2 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-400">Độ rộng thị trường</h2>
        </div>
        <div className="mb-1 flex justify-between text-xs font-semibold">
          <span className="text-market-up">{(data.breadth_ceiling || 0) + (data.breadth_green || 0)}</span>
          <span className="text-market-ref">{data.breadth_yellow}</span>
          <span className="text-market-down">{(data.breadth_floor || 0) + (data.breadth_red || 0)}</span>
        </div>
        <div className="mb-1 flex h-2 w-full overflow-hidden rounded-full border border-panel-border">
          <div style={{ flex: (data.breadth_ceiling || 0) + (data.breadth_green || 0) }} className="bg-market-up" />
          <div style={{ flex: data.breadth_yellow || 0 }} className="bg-market-ref" />
          <div style={{ flex: (data.breadth_floor || 0) + (data.breadth_red || 1) }} className="bg-market-down" />
        </div>
      </div>

      <div className="flex flex-col justify-center rounded-lg border border-panel-border bg-panel p-5 shadow-md">
        <div className="mb-2 flex items-center gap-2">
          <Globe className="h-4 w-4 text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-400">Giao dịch khối ngoại</h2>
        </div>
        <div className="flex items-end justify-between">
          <span className={`text-2xl font-bold ${isForeignBuy ? "text-market-up" : "text-market-down"}`}>
            {isForeignBuy ? "+" : ""}{(foreignNet / 1_000_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 0 })}
          </span>
          <span className="text-sm font-medium text-zinc-500">Tỷ VNĐ</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${isForeignBuy ? "bg-market-up/20 text-market-up" : "bg-market-down/20 text-market-down"}`}>
            {isForeignBuy ? "Mua ròng" : "Bán ròng"}
          </span>
        </div>
      </div>
    </div>
  );
}
