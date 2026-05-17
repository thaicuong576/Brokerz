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

import ReportGenerator from "@/components/report/ReportGenerator";
import { apiService } from "@/lib/api";
import { cn } from "@/lib/utils";

type WidgetId = "vnindex" | "liquidity" | "breadth" | "foreignNet" | "topImpact" | "sectors" | "foreignFlow";
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

type SourceMeta = {
  source?: string;
  source_label?: string;
  trading_date?: string;
  is_eod?: boolean;
};

type Snapshot = {
  vnindex?: (SourceMeta & {
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
    status?: string;
  }) | null;
  foreign?: SourceMeta & {
    total_net_val?: number;
    top_buy?: ForeignRow[];
    top_sell?: ForeignRow[];
  };
  impact?: SourceMeta & {
    positive?: ImpactRow[];
    negative?: ImpactRow[];
  };
  sectors?: SectorRow[];
  sources?: Record<string, string>;
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
  { id: "vnindex", title: "VNINDEX", subtitle: "Chỉ số", icon: Activity, size: "sm" },
  { id: "liquidity", title: "Thanh khoản", subtitle: "GTGD, tỷ VNĐ", icon: BarChart3, size: "sm" },
  { id: "breadth", title: "Độ rộng", subtitle: "Tăng / TC / Giảm", icon: Users, size: "sm" },
  { id: "foreignNet", title: "Khối ngoại", subtitle: "Ròng, tỷ VNĐ", icon: TrendingUp, size: "sm" },
  { id: "topImpact", title: "Top tác động", subtitle: "Điểm VN-Index", icon: LineChart, size: "md" },
  { id: "sectors", title: "Nhóm ngành", subtitle: "Hiệu suất", icon: LayoutGrid, size: "lg" },
  { id: "foreignFlow", title: "Mua/Bán khối ngoại", subtitle: "Theo mã", icon: TrendingUp, size: "md" },
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
      console.error("Không tải được snapshot thị trường", err);
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
        console.error("Không xử lý được dữ liệu realtime", err);
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
    <div className="space-y-3 pb-10">
      <header className="rounded border border-panel-border bg-panel">
        <div className="flex flex-col gap-3 border-b border-panel-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-bold text-zinc-100">Bảng điều khiển thị trường</h1>
              <span className="rounded border border-panel-border bg-zinc-950 px-2 py-0.5 text-[10px] font-bold text-zinc-500">
                MIRAe ASSET SECURITIES (VIETNAM)
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-zinc-500">
              <span>{lastUpdated ? `Cập nhật ${lastUpdated.toLocaleTimeString("vi-VN")}` : "Chưa cập nhật"}</span>
              <span className="hidden text-zinc-700 sm:inline">|</span>
              <span>Khối ngoại: DNSE intraday, SSI EOD sau khi chốt dữ liệu</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={fetchSnapshot}
              className="inline-flex h-8 items-center gap-2 rounded border border-panel-border bg-zinc-950 px-3 text-xs font-bold text-zinc-200 hover:border-primary/50"
            >
              <RefreshCcw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              Làm mới
            </button>
            <button
              onClick={resetLayout}
              className="inline-flex h-8 items-center gap-2 rounded border border-panel-border bg-zinc-950 px-3 text-xs font-bold text-zinc-200 hover:border-primary/50"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Mặc định
            </button>
          </div>
        </div>

        {isBroker && availableWidgets.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 py-2">
            {availableWidgets.map((widget) => (
              <button
                key={widget.id}
                onClick={() => addWidget(widget.id)}
                className="inline-flex items-center gap-1.5 rounded border border-panel-border bg-zinc-950 px-2 py-1 text-[11px] font-semibold text-zinc-400 hover:border-primary/50 hover:text-primary"
              >
                <Plus className="h-3 w-3" />
                {widget.title}
              </button>
            ))}
          </div>
        )}
      </header>

      <ReportGenerator isBroker={isBroker} />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={layout.map((item) => item.instanceId)} strategy={rectSortingStrategy}>
          <section className="grid grid-cols-1 gap-3 lg:grid-cols-4">
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
  const colSpan = definition.size === "lg" ? "lg:col-span-2" : definition.size === "md" ? "lg:col-span-2" : "";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "min-h-[168px] rounded border border-panel-border bg-panel p-3",
        colSpan,
        isDragging && "z-20 border-primary/60 opacity-80"
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab rounded border border-panel-border bg-zinc-950 p-1 text-zinc-600 active:cursor-grabbing"
            aria-label="Kéo để sắp xếp tiện ích"
            title="Kéo để sắp xếp tiện ích"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <div className="rounded bg-zinc-950 p-1.5 text-primary">
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-zinc-100">{definition.title}</h3>
            <p className="text-[10px] text-zinc-600">{definition.subtitle}</p>
          </div>
        </div>

        {canRemove && (
          <button
            onClick={onRemove}
            className="rounded p-1 text-zinc-700 hover:bg-red-500/10 hover:text-red-400"
            aria-label="Ẩn tiện ích"
            title="Ẩn tiện ích"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {loading ? <LoadingState /> : <WidgetBody widgetId={definition.id} snapshot={snapshot} />}
    </div>
  );
}

function WidgetBody({ widgetId, snapshot }: { widgetId: WidgetId; snapshot: Snapshot | null }) {
  if (!snapshot) return <EmptyState label="Chưa lấy được dữ liệu thị trường" />;

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
      return <SectorWidget data={snapshot.sectors || []} sourceLabel={snapshot.sources?.sectors} />;
    case "foreignFlow":
      return <ForeignFlowWidget data={snapshot.foreign} />;
  }
}

function SourceBadge({ label, tone = "neutral" }: { label?: string; tone?: "neutral" | "live" | "warning" }) {
  if (!label) return null;
  const text = tone === "live" ? "LIVE" : tone === "warning" ? "TEMP" : "SRC";
  return (
    <span
      title={label}
      className={cn(
        "inline-flex w-fit rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold",
        tone === "live" && "border-market-up/25 bg-market-up/10 text-market-up",
        tone === "warning" && "border-market-ref/25 bg-market-ref/10 text-market-ref",
        tone === "neutral" && "border-panel-border bg-zinc-950 text-zinc-500"
      )}
    >
      {text}
    </span>
  );
}

function VnIndexWidget({ data }: { data: Snapshot["vnindex"] }) {
  if (!data) return <EmptyState label="Chưa có dữ liệu VNINDEX" />;
  const isUp = (data.change || 0) >= 0;
  return (
    <div className="space-y-2">
      <SourceBadge label={data.source_label} tone={data.status === "LIVE" ? "live" : "neutral"} />
      <div className={cn("font-mono text-3xl font-bold tabular-nums", isUp ? "text-market-up" : "text-market-down")}>
        {formatNumber(data.price, 2)}
      </div>
      <div className={cn("flex items-center gap-1 font-mono text-xs font-bold tabular-nums", isUp ? "text-market-up" : "text-market-down")}>
        {isUp ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
        {formatSigned(data.change, 2)} ({formatSigned(data.change_percent, 2)}%)
      </div>
      <div className="text-[10px] text-zinc-600">
        {data.trading_date || "Chưa có ngày"} | {data.status === "LIVE" ? "Trực tiếp" : "Đóng cửa"}
      </div>
    </div>
  );
}

function LiquidityWidget({ data }: { data: Snapshot["vnindex"] }) {
  if (!data) return <EmptyState label="Chưa có dữ liệu thanh khoản" />;
  return (
    <div className="space-y-3">
      <SourceBadge label={data.source_label} tone={data.status === "LIVE" ? "live" : "neutral"} />
      <div>
        <div className="text-[10px] font-bold uppercase text-zinc-600">Giá trị giao dịch</div>
        <div className="font-mono text-3xl font-bold tabular-nums text-zinc-100">{formatNumber(data.total_value, 0)}</div>
        <div className="text-[11px] text-zinc-500">Tỷ VNĐ</div>
      </div>
      <div className="rounded border border-panel-border bg-zinc-950 p-2">
        <div className="text-[10px] text-zinc-600">Khối lượng</div>
        <div className="font-mono text-xs font-bold tabular-nums text-zinc-300">{formatNumber(data.total_volume, 0)} CP</div>
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
    <div className="space-y-3">
      <SourceBadge label={data.source_label} tone={data.status === "LIVE" ? "live" : "neutral"} />
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <Metric label="Tăng" value={up} className="text-market-up" />
        <Metric label="TC" value={ref} className="text-market-ref" />
        <Metric label="Giảm" value={down} className="text-market-down" />
      </div>
      <div className="flex h-2 overflow-hidden rounded-full border border-panel-border bg-zinc-950">
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
    <div className="space-y-2">
      <SourceBadge label={data?.source_label} tone={data?.is_eod ? "live" : "warning"} />
      <div className={cn("font-mono text-3xl font-bold tabular-nums", isBuy ? "text-market-up" : "text-market-down")}>
        {formatSigned(net / 1e9, 0)}
      </div>
      <div className="text-[11px] text-zinc-500">Tỷ VNĐ</div>
      <span className={cn("inline-flex rounded px-2 py-1 text-[11px] font-bold", isBuy ? "bg-market-up/10 text-market-up" : "bg-market-down/10 text-market-down")}>
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
    <div className="space-y-2">
      <SourceBadge label={data?.source_label} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ImpactColumn title="Tích cực" rows={positive} maxValue={maxValue} tone="up" />
        <ImpactColumn title="Tiêu cực" rows={negative} maxValue={maxValue} tone="down" />
      </div>
    </div>
  );
}

function SectorWidget({ data, sourceLabel }: { data: SectorRow[]; sourceLabel?: string }) {
  if (!data.length) return <EmptyState label="Chưa có dữ liệu nhóm ngành" />;
  return (
    <div className="space-y-2">
      <SourceBadge label={sourceLabel} />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {data.slice(0, 12).map((sector) => (
          <div key={sector.sector} className={cn("min-h-16 rounded border p-2", heatClass(sector.avg_change))}>
            <div className="line-clamp-2 text-[11px] font-bold leading-tight">{sector.sector}</div>
            <div className="mt-2 font-mono text-lg font-bold tabular-nums">{formatSigned(sector.avg_change, 2)}%</div>
            <div className="text-[10px] opacity-70">{sector.total_stocks || 0} mã</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ForeignFlowWidget({ data }: { data?: Snapshot["foreign"] }) {
  const buys = data?.top_buy || [];
  const sells = data?.top_sell || [];
  if (!buys.length && !sells.length) return <EmptyState label="Chưa có dữ liệu mua/bán khối ngoại" />;
  const maxValue = Math.max(...[...buys, ...sells].map((item) => Math.abs(item.net_val || 0)), 1);
  return (
    <div className="space-y-3">
      <SourceBadge label={data?.source_label} tone={data?.is_eod ? "live" : "warning"} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ForeignColumn title="Mua ròng" rows={buys} maxValue={maxValue} tone="up" />
        <ForeignColumn title="Bán ròng" rows={sells} maxValue={maxValue} tone="down" />
      </div>
    </div>
  );
}

function ImpactColumn({ title, rows, maxValue, tone }: { title: string; rows: ImpactRow[]; maxValue: number; tone: "up" | "down" }) {
  return (
    <div className="space-y-1.5">
      <div className={cn("text-[10px] font-bold uppercase", tone === "up" ? "text-market-up" : "text-market-down")}>{title}</div>
      {rows.slice(0, 6).map((item) => (
        <div key={`${title}-${item.symbol}`} className="relative overflow-hidden rounded border border-panel-border bg-zinc-950 px-2 py-1.5">
          <div
            className={cn("absolute inset-y-0 opacity-20", tone === "up" ? "left-0 bg-market-up" : "right-0 bg-market-down")}
            style={{ width: `${(Math.abs(item.impact_value || 0) / maxValue) * 100}%` }}
          />
          <div className="relative flex items-center justify-between gap-3 text-xs">
            <span className="font-mono font-bold text-zinc-100">{item.symbol}</span>
            <span className={cn("font-mono font-bold tabular-nums", tone === "up" ? "text-market-up" : "text-market-down")}>{formatSigned(item.impact_value, 2)}</span>
          </div>
          <div className="relative font-mono text-[10px] tabular-nums text-zinc-600">{formatSigned(item.change_percent, 2)}%</div>
        </div>
      ))}
    </div>
  );
}

function ForeignColumn({ title, rows, maxValue, tone }: { title: string; rows: ForeignRow[]; maxValue: number; tone: "up" | "down" }) {
  return (
    <div className="space-y-1.5">
      <div className={cn("text-[10px] font-bold uppercase", tone === "up" ? "text-market-up" : "text-market-down")}>{title}</div>
      {rows.slice(0, 6).map((item) => (
        <div key={`${title}-${item.symbol}`} className="flex items-center gap-2 text-xs">
          <span className="w-11 font-mono font-bold text-zinc-200">{item.symbol}</span>
          <div className={cn("h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-950", tone === "down" && "flex justify-end")}>
            <div
              className={cn("h-full", tone === "up" ? "bg-market-up" : "bg-market-down")}
              style={{ width: `${(Math.abs(item.net_val || 0) / maxValue) * 100}%` }}
            />
          </div>
          <span className={cn("w-14 text-right font-mono text-[11px] font-bold tabular-nums", tone === "up" ? "text-market-up" : "text-market-down")}>
            {(item.net_val / 1e9).toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="rounded border border-panel-border bg-zinc-950 p-2">
      <div className={cn("font-mono text-lg font-bold tabular-nums", className)}>{value}</div>
      <div className="text-[9px] uppercase text-zinc-600">{label}</div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-24 items-center justify-center rounded border border-dashed border-panel-border bg-zinc-950/60 px-4 text-center text-xs font-semibold text-zinc-500">
      {label}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-2">
      <div className="h-5 w-1/2 animate-pulse rounded bg-zinc-800" />
      <div className="h-16 animate-pulse rounded bg-zinc-900" />
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
  if (change >= 2) return "border-market-up/20 bg-market-up text-black";
  if (change >= 0.5) return "border-market-up/20 bg-market-up/70 text-zinc-950";
  if (change > 0) return "border-market-up/20 bg-market-up/15 text-market-up";
  if (change === 0) return "border-market-ref/20 bg-market-ref/15 text-market-ref";
  if (change <= -2) return "border-market-down/20 bg-market-down text-white";
  if (change <= -0.5) return "border-market-down/20 bg-market-down/70 text-white";
  return "border-market-down/20 bg-market-down/15 text-market-down";
}
