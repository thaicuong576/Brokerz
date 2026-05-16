"use client";

import type { ComponentType } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  GripVertical,
  LayoutGrid,
  LineChart,
  Plus,
  RefreshCcw,
  TrendingUp,
  Users,
  X,
} from "lucide-react";

import { apiService } from "@/lib/api";
import { cn } from "@/lib/utils";

type WidgetId =
  | "vnindex"
  | "liquidity"
  | "breadth"
  | "foreignNet"
  | "topImpact"
  | "sectors"
  | "foreignFlow";

type WidgetSize = "sm" | "md" | "lg";

type WidgetDefinition = {
  id: WidgetId;
  title: string;
  subtitle: string;
  icon: ComponentType<{ className?: string }>;
  size: WidgetSize;
};

type DashboardWidget = {
  instanceId: string;
  widgetId: WidgetId;
};

type Snapshot = {
  vnindex?: {
    symbol?: string;
    price?: number;
    change?: number;
    change_percent?: number;
    total_volume?: number;
    total_value?: number;
    breadth_green?: number;
    breadth_red?: number;
    breadth_yellow?: number;
    breadth_ceiling?: number;
    breadth_floor?: number;
    trading_date?: string;
    status?: string;
  } | null;
  foreign?: {
    total_net_val?: number;
    top_buy?: ForeignRow[];
    top_sell?: ForeignRow[];
  };
  impact?: {
    positive?: ImpactRow[];
    negative?: ImpactRow[];
  };
  sectors?: SectorRow[];
  server_time?: string;
};

type ImpactRow = {
  symbol: string;
  price?: number;
  ref_price?: number;
  change_percent?: number;
  impact_value: number;
};

type SectorRow = {
  sector: string;
  avg_change: number;
  total_stocks?: number;
};

type ForeignRow = {
  symbol: string;
  trading_date?: string;
  net_val: number;
};

const WIDGETS: WidgetDefinition[] = [
  { id: "vnindex", title: "VNINDEX", subtitle: "Chỉ số VN-Index", icon: Activity, size: "sm" },
  { id: "liquidity", title: "Thanh khoản", subtitle: "Giá trị giao dịch, tỷ VNĐ", icon: BarChart3, size: "sm" },
  { id: "breadth", title: "Độ rộng thị trường", subtitle: "Tăng / Tham chiếu / Giảm", icon: Users, size: "sm" },
  { id: "foreignNet", title: "Giao dịch khối ngoại", subtitle: "Giao dịch ròng", icon: TrendingUp, size: "sm" },
  { id: "topImpact", title: "Top tác động VN-Index", subtitle: "", icon: LineChart, size: "md" },
  { id: "sectors", title: "Diễn biến nhóm ngành", subtitle: "", icon: LayoutGrid, size: "lg" },
  { id: "foreignFlow", title: "Khối ngoại Mua/Bán", subtitle: "", icon: TrendingUp, size: "md" },
];

const DEFAULT_LAYOUT: DashboardWidget[] = WIDGETS.map((widget) => ({
  instanceId: widget.id,
  widgetId: widget.id,
}));

export function Dashboard({ isBroker = false }: { isBroker?: boolean }) {
  const [layout, setLayout] = useState<DashboardWidget[]>(DEFAULT_LAYOUT);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const activeIds = useMemo(() => new Set(layout.map((item) => item.widgetId)), [layout]);
  const availableWidgets = WIDGETS.filter((widget) => !activeIds.has(widget.id));

  const fetchSnapshot = async () => {
    setLoading(true);
    try {
      const data = await apiService.getMarketSnapshot();
      setSnapshot(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Market snapshot failed", err);
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSnapshot();

    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:50005/api/v1";
    const wsUrl = apiBase.replace(/^http/, "ws").replace(/\/api\/v1\/?$/, "/ws/market");
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "MARKET_SNAPSHOT") {
          setSnapshot((prev) => ({
            ...prev,
            ...message.data,
            vnindex: {
              ...(prev?.vnindex || {}),
              ...(message.data?.vnindex || message.vnindex || {}),
            },
          }));
          setLastUpdated(new Date());
        }
      } catch (err) {
        console.error("Market websocket message failed", err);
      }
    };

    return () => ws.close();
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setLayout((items) => {
      const oldIndex = items.findIndex((item) => item.instanceId === active.id);
      const newIndex = items.findIndex((item) => item.instanceId === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const addWidget = (widgetId: WidgetId) => {
    setLayout((items) => [...items, { instanceId: widgetId, widgetId }]);
  };

  const removeWidget = (instanceId: string) => {
    setLayout((items) => items.filter((item) => item.instanceId !== instanceId));
  };

  const resetLayout = () => setLayout(DEFAULT_LAYOUT);

  return (
    <div className="space-y-6 pb-16">
      <header className="rounded-lg border border-zinc-800 bg-panel p-5 shadow-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">
              Mirae Asset Securities (Vietnam)
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-100">
              Dashboard thị trường
            </h1>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-zinc-500">
              <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1">
                {lastUpdated ? `Cập nhập lúc ${lastUpdated.toLocaleTimeString("vi-VN")}` : "Chưa có lần cập nhập nào"}
              </span>
              <span className="rounded-full border border-amber-900/40 bg-amber-950/30 px-2.5 py-1 text-amber-300">
                Lưu ý: Dữ liệu Khối ngoại Mua/Bán mất 7~8 phút để cập nhập
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={fetchSnapshot}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-bold text-zinc-200 hover:border-primary/50"
            >
              <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
              Làm mới
            </button>
            <button
              onClick={resetLayout}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-bold text-zinc-200 hover:border-primary/50"
            >
              <LayoutGrid className="h-4 w-4" />
              Mặc định
            </button>
          </div>
        </div>

        {isBroker && availableWidgets.length > 0 && (
          <div className="mt-5 border-t border-zinc-800 pt-4">
            <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
              Thu vien widget
            </div>
            <div className="flex flex-wrap gap-2">
              {availableWidgets.map((widget) => (
                <button
                  key={widget.id}
                  onClick={() => addWidget(widget.id)}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-300 hover:border-primary/50 hover:text-primary"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {widget.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={layout.map((item) => item.instanceId)} strategy={rectSortingStrategy}>
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            {layout.map((item) => {
              const definition = WIDGETS.find((widget) => widget.id === item.widgetId);
              if (!definition) return null;
              return (
                <SortableDashboardCard
                  key={item.instanceId}
                  item={item}
                  definition={definition}
                  snapshot={snapshot}
                  loading={loading}
                  canRemove={isBroker && layout.length > 1}
                  onRemove={() => removeWidget(item.instanceId)}
                />
              );
            })}
          </section>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableDashboardCard({
  item,
  definition,
  snapshot,
  loading,
  canRemove,
  onRemove,
}: {
  item: DashboardWidget;
  definition: WidgetDefinition;
  snapshot: Snapshot | null;
  loading: boolean;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.instanceId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = definition.icon;
  const colSpan = definition.size === "lg" ? "lg:col-span-2 xl:col-span-2" : definition.size === "md" ? "lg:col-span-2" : "";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border border-zinc-800 bg-panel p-4 shadow-md",
        "min-h-[190px]",
        colSpan,
        isDragging && "z-20 border-primary/60 opacity-80 shadow-xl"
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab rounded-md border border-zinc-800 bg-zinc-950 p-1.5 text-zinc-500 active:cursor-grabbing"
            aria-label="Keo de sap xep widget"
            title="Keo de sap xep widget"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="rounded-md bg-zinc-900 p-2 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-100">{definition.title}</h3>
            <p className="text-[11px] text-zinc-500">{definition.subtitle}</p>
          </div>
        </div>

        {canRemove && (
          <button
            onClick={onRemove}
            className="rounded-md p-1.5 text-zinc-600 hover:bg-red-500/10 hover:text-red-400"
            aria-label="An widget"
            title="An widget"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {loading ? <LoadingState /> : <WidgetBody widgetId={definition.id} snapshot={snapshot} />}
    </div>
  );
}

function WidgetBody({ widgetId, snapshot }: { widgetId: WidgetId; snapshot: Snapshot | null }) {
  if (!snapshot) return <EmptyState label="Chưa lấy được Snapshot thị trường" />;

  switch (widgetId) {
    case "vnindex":
      return <VnIndexWidget data={snapshot.vnindex} />;
    case "liquidity":
      return <LiquidityWidget data={snapshot.vnindex} />;
    case "breadth":
      return <BreadthWidget data={snapshot.vnindex} />;
    case "foreignNet":
      return <ForeignNetWidget data={snapshot.foreign} />;
    case "topImpact":
      return <TopImpactWidget data={snapshot.impact} />;
    case "sectors":
      return <SectorWidget data={snapshot.sectors || []} />;
    case "foreignFlow":
      return <ForeignFlowWidget data={snapshot.foreign} />;
  }
}

function VnIndexWidget({ data }: { data: Snapshot["vnindex"] }) {
  if (!data) return <EmptyState label="Chưa có dữ liệu VNINDEX" />;
  const isUp = (data.change || 0) >= 0;
  return (
    <div className="space-y-3">
      <div className={cn("text-4xl font-black tracking-tight", isUp ? "text-market-up" : "text-market-down")}>
        {formatNumber(data.price, 2)}
      </div>
      <div className={cn("flex items-center gap-1 text-sm font-bold", isUp ? "text-market-up" : "text-market-down")}>
        {isUp ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
        {formatSigned(data.change, 2)} ({formatSigned(data.change_percent, 2)}%)
      </div>
      <div className="text-[11px] text-zinc-500">{data.trading_date || "N/A"} | {data.status || "UNKNOWN"}</div>
    </div>
  );
}

function LiquidityWidget({ data }: { data: Snapshot["vnindex"] }) {
  if (!data) return <EmptyState label="Chưa có dữ liệu thanh khoản" />;
  return (
    <div className="space-y-4">
      <div>
        <div className="text-[11px] font-bold uppercase text-zinc-500">Giá trị giao dịch</div>
        <div className="text-3xl font-black text-zinc-100">{formatNumber(data.total_value, 0)}</div>
        <div className="text-xs text-zinc-500">Tỷ VNĐ</div>
      </div>
      <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
        <div className="text-[11px] text-zinc-500">Khối lượng</div>
        <div className="text-sm font-bold text-zinc-200">{formatNumber(data.total_volume, 0)} CP</div>
      </div>
    </div>
  );
}

function BreadthWidget({ data }: { data: Snapshot["vnindex"] }) {
  if (!data) return <EmptyState label="Chưa có dữ liệu độ rộng" />;
  const up = (data.breadth_ceiling || 0) + (data.breadth_green || 0);
  const ref = data.breadth_yellow || 0;
  const down = (data.breadth_floor || 0) + (data.breadth_red || 0);
  const total = Math.max(up + ref + down, 1);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
        <Metric label="Tăng" value={up} className="text-market-up" />
        <Metric label="Tham chiếu" value={ref} className="text-market-ref" />
        <Metric label="Giảm" value={down} className="text-market-down" />
      </div>
      <div className="flex h-3 overflow-hidden rounded-full border border-zinc-800 bg-zinc-950">
        <div className="bg-market-up" style={{ width: `${(up / total) * 100}%` }} />
        <div className="bg-market-ref" style={{ width: `${(ref / total) * 100}%` }} />
        <div className="bg-market-down" style={{ width: `${(down / total) * 100}%` }} />
      </div>
    </div>
  );
}

function ForeignNetWidget({ data }: { data?: Snapshot["foreign"] }) {
  const net = data?.total_net_val || 0;
  const isBuy = net >= 0;
  return (
    <div className="space-y-3">
      <div className={cn("text-3xl font-black", isBuy ? "text-market-up" : "text-market-down")}>
        {formatSigned(net / 1e9, 0)}
      </div>
      <div className="text-xs font-bold text-zinc-500">Tỷ VNĐ</div>
      <span className={cn("inline-flex rounded-md px-2 py-1 text-xs font-black", isBuy ? "bg-market-up/10 text-market-up" : "bg-market-down/10 text-market-down")}>
        {isBuy ? "Mua ròng" : "Bán ròng"}
      </span>
    </div>
  );
}

function TopImpactWidget({ data }: { data?: Snapshot["impact"] }) {
  const positive = data?.positive || [];
  const negative = data?.negative || [];
  if (!positive.length && !negative.length) return <EmptyState label="Chưa có dữ liệu top tác động" />;
  const maxValue = Math.max(...[...positive, ...negative].map((item) => Math.abs(item.impact_value || 0)), 0.01);
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <ImpactColumn title="Top tích cực" rows={positive} maxValue={maxValue} tone="up" />
      <ImpactColumn title="Top tiêu cực" rows={negative} maxValue={maxValue} tone="down" />
    </div>
  );
}

function SectorWidget({ data }: { data: SectorRow[] }) {
  if (!data.length) return <EmptyState label="Chưa có dữ liệu nhóm ngành" />;
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
      {data.slice(0, 12).map((sector) => (
        <div key={sector.sector} className={cn("min-h-20 rounded-md p-3", heatClass(sector.avg_change))}>
          <div className="text-xs font-bold leading-tight">{sector.sector}</div>
          <div className="mt-3 text-xl font-black">{formatSigned(sector.avg_change, 2)}%</div>
          <div className="text-[10px] opacity-70">{sector.total_stocks || 0} mã</div>
        </div>
      ))}
    </div>
  );
}

function ForeignFlowWidget({ data }: { data?: Snapshot["foreign"] }) {
  const buys = data?.top_buy || [];
  const sells = data?.top_sell || [];
  if (!buys.length && !sells.length) return <EmptyState label="Chưa có dữ liệu mua/bán khối ngoại" />;
  const maxValue = Math.max(...[...buys, ...sells].map((item) => Math.abs(item.net_val || 0)), 1);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ForeignColumn title="Top Mua" rows={buys} maxValue={maxValue} tone="up" />
        <ForeignColumn title="Top Bán" rows={sells} maxValue={maxValue} tone="down" />
      </div>
    </div>
  );
}

function ImpactColumn({ title, rows, maxValue, tone }: { title: string; rows: ImpactRow[]; maxValue: number; tone: "up" | "down" }) {
  return (
    <div className="space-y-2">
      <div className={cn("text-[11px] font-black uppercase", tone === "up" ? "text-market-up" : "text-market-down")}>{title}</div>
      {rows.slice(0, 6).map((item) => (
        <div key={`${title}-${item.symbol}`} className="relative overflow-hidden rounded-md bg-zinc-950 px-3 py-2">
          <div
            className={cn("absolute inset-y-0 opacity-20", tone === "up" ? "left-0 bg-market-up" : "right-0 bg-market-down")}
            style={{ width: `${(Math.abs(item.impact_value || 0) / maxValue) * 100}%` }}
          />
          <div className="relative flex items-center justify-between gap-3 text-sm">
            <span className="font-black text-zinc-100">{item.symbol}</span>
            <span className={cn("font-bold", tone === "up" ? "text-market-up" : "text-market-down")}>{formatSigned(item.impact_value, 2)}</span>
          </div>
          <div className="relative text-[10px] text-zinc-500">{formatSigned(item.change_percent, 2)}%</div>
        </div>
      ))}
    </div>
  );
}

function ForeignColumn({ title, rows, maxValue, tone }: { title: string; rows: ForeignRow[]; maxValue: number; tone: "up" | "down" }) {
  return (
    <div className="space-y-2">
      <div className={cn("text-[11px] font-black uppercase", tone === "up" ? "text-market-up" : "text-market-down")}>{title}</div>
      {rows.slice(0, 6).map((item) => (
        <div key={`${title}-${item.symbol}`} className="flex items-center gap-3 text-sm">
          <span className="w-12 font-black text-zinc-200">{item.symbol}</span>
          <div className={cn("h-2 flex-1 overflow-hidden rounded-full bg-zinc-900", tone === "down" && "flex justify-end")}>
            <div
              className={cn("h-full", tone === "up" ? "bg-market-up" : "bg-market-down")}
              style={{ width: `${(Math.abs(item.net_val || 0) / maxValue) * 100}%` }}
            />
          </div>
          <span className={cn("w-16 text-right text-xs font-bold", tone === "up" ? "text-market-up" : "text-market-down")}>
            {(item.net_val / 1e9).toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950 p-2">
      <div className={cn("text-lg font-black", className)}>{value}</div>
      <div className="text-[10px] uppercase text-zinc-500">{label}</div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-28 items-center justify-center rounded-md border border-dashed border-zinc-800 bg-zinc-950/60 px-4 text-center text-xs font-semibold text-zinc-500">
      {label}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3">
      <div className="h-7 w-1/2 animate-pulse rounded bg-zinc-800" />
      <div className="h-20 animate-pulse rounded bg-zinc-900" />
    </div>
  );
}

function formatNumber(value?: number | null, digits = 0) {
  if (value === undefined || value === null || Number.isNaN(value)) return "--";
  return value.toLocaleString("vi-VN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function formatSigned(value?: number | null, digits = 2) {
  if (value === undefined || value === null || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("vi-VN", { maximumFractionDigits: digits, minimumFractionDigits: digits })}`;
}

function heatClass(change: number) {
  if (change >= 2) return "bg-market-up text-black";
  if (change >= 0.5) return "bg-market-up/70 text-zinc-950";
  if (change > 0) return "border border-market-up/20 bg-market-up/20 text-market-up";
  if (change === 0) return "border border-market-ref/20 bg-market-ref/20 text-market-ref";
  if (change <= -2) return "bg-market-down text-white";
  if (change <= -0.5) return "bg-market-down/70 text-white";
  return "border border-market-down/20 bg-market-down/20 text-market-down";
}
