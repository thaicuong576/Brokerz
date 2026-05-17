"use client";

import type { ComponentType } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Edit3,
  History,
  Megaphone,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

import {
  apiService,
  type PortfolioResponse,
  type PortfolioUpdateResponse,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type PortfolioItem = PortfolioResponse["items"][number] & {
  currentPrice?: number;
  pnl?: number;
};

type MarketQuote = {
  symbol: string;
  price?: number | null;
  ref_price?: number | null;
};

type PortfolioViewProps = {
  isBroker: boolean;
  user: { id?: string | null } | null;
  profile?: unknown;
};

type ActionKey = NonNullable<PortfolioUpdateResponse["action"]>;

const emptyPositionForm = {
  symbol: "",
  target_weight: 0,
  applied_price: 0,
  thesis: "",
  risk_note: "",
  publish: true,
};

const inputClass =
  "w-full rounded border border-panel-border bg-background px-3 py-2 text-xs text-zinc-100 outline-none transition-colors focus:border-primary disabled:opacity-60";

function quotePrice(quote?: MarketQuote | null) {
  if (!quote) return undefined;
  if (typeof quote.price === "number" && quote.price > 0) return quote.price;
  if (typeof quote.ref_price === "number" && quote.ref_price > 0) return quote.ref_price;
  return undefined;
}

function normalizeQuoteToEntryUnit(price?: number, entryPrice?: number | null) {
  if (!price || !entryPrice) return price;
  if (entryPrice < 1000 && price >= 1000) return price / 1000;
  if (entryPrice >= 1000 && price < 1000) return price * 1000;
  return price;
}

export function PortfolioView({ isBroker = false, user = null }: PortfolioViewProps) {
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [marketData, setMarketData] = useState<MarketQuote[]>([]);
  const [portfolioUpdates, setPortfolioUpdates] = useState<PortfolioUpdateResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [positionForm, setPositionForm] = useState({ ...emptyPositionForm });
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const [portfolioData, updateData, stockData] = await Promise.all([
        apiService.getCurrentPortfolio(),
        apiService.getPortfolioEvents(),
        apiService.getLatestStocks().catch(() => []),
      ]);
      const latestQuotes = Array.isArray(stockData) ? (stockData as MarketQuote[]) : [];
      const missingSymbols = (portfolioData?.items || [])
        .map((item) => item.symbol)
        .filter((symbol) => !quotePrice(latestQuotes.find((quote) => quote.symbol === symbol)));
      const fetchedQuotes = await Promise.all(
        Array.from(new Set(missingSymbols)).map((symbol) =>
          apiService.getStockPrice(symbol).catch(() => null)
        )
      );
      setPortfolio(portfolioData);
      setPortfolioUpdates(updateData || []);
      setMarketData([
        ...latestQuotes,
        ...fetchedQuotes.filter((quote): quote is MarketQuote => Boolean(quote)),
      ]);
    } catch (err) {
      console.error("Không tải được dữ liệu Portfolio", err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const holdings = useMemo(() => portfolio?.items || [], [portfolio?.items]);
  const enrichedHoldings = useMemo(
    () =>
      holdings.map((item) => {
        const current = marketData.find((price) => price.symbol === item.symbol);
        const currentPrice = normalizeQuoteToEntryUnit(quotePrice(current), item.entry_price);
        const pnl = item.entry_price && currentPrice ? ((currentPrice - item.entry_price) / item.entry_price) * 100 : undefined;
        return { ...item, currentPrice, pnl };
      }),
    [holdings, marketData]
  );

  const totalWeight = holdings.reduce((sum, item) => sum + (item.weight || 0), 0);
  const cashWeight = Math.max(0, 100 - totalWeight);
  const investedPnl =
    enrichedHoldings.length > 0
      ? enrichedHoldings.reduce((sum, item) => sum + (item.pnl || 0) * ((item.weight || 0) / (totalWeight || 1)), 0)
      : 0;
  const portfolioPnl = enrichedHoldings.reduce((sum, item) => sum + (item.pnl || 0) * ((item.weight || 0) / 100), 0);
  const latestUpdate = portfolioUpdates[0]?.created_at || portfolio?.latest_event_at || null;

  const resetForm = () => {
    setEditingSymbol(null);
    setPositionForm({ ...emptyPositionForm });
  };

  const startEditPosition = (holding: PortfolioItem) => {
    setEditingSymbol(holding.symbol);
    setPositionForm({
      symbol: holding.symbol,
      target_weight: holding.weight || 0,
      applied_price: holding.currentPrice || holding.entry_price || 0,
      thesis: holding.active_thesis || holding.reason || "",
      risk_note: "",
      publish: true,
    });
    document.getElementById("position-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const submitPositionUpdate = async () => {
    if (!positionForm.symbol.trim()) {
      alert("Vui lòng nhập mã cổ phiếu.");
      return;
    }
    if (Number(positionForm.target_weight) < 0) {
      alert("Tỷ trọng mới phải lớn hơn hoặc bằng 0.");
      return;
    }

    setIsSaving(true);
    try {
      const updatedPortfolio = await apiService.updatePortfolioPosition({
        symbol: positionForm.symbol.trim().toUpperCase(),
        target_weight: Number(positionForm.target_weight),
        applied_price: Number(positionForm.applied_price) || undefined,
        thesis: positionForm.thesis || undefined,
        risk_note: positionForm.risk_note || undefined,
        publish: positionForm.publish,
      });
      setPortfolio(updatedPortfolio);
      resetForm();
      const updateData = await apiService.getPortfolioEvents();
      setPortfolioUpdates(updateData || []);
    } catch (err) {
      console.error("Không cập nhật được danh mục", err);
      alert("Không cập nhật được danh mục. Vui lòng kiểm tra tỷ trọng và thử lại.");
    } finally {
      setIsSaving(false);
    }
  };

  const removePosition = async (holding: PortfolioItem) => {
    const ok = confirm(`Bán hết ${holding.symbol} và đưa tỷ trọng về 0%?`);
    if (!ok) return;

    setIsSaving(true);
    try {
      const updatedPortfolio = await apiService.updatePortfolioPosition({
        symbol: holding.symbol,
        target_weight: 0,
        applied_price: holding.currentPrice || holding.entry_price || undefined,
        thesis: `Bán hết ${holding.symbol} khỏi model portfolio VIP`,
        publish: true,
      });
      setPortfolio(updatedPortfolio);
      const updateData = await apiService.getPortfolioEvents();
      setPortfolioUpdates(updateData || []);
    } catch (err) {
      console.error("Không bán hết được vị thế", err);
      alert("Không bán hết được vị thế này.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <SummaryCard
          label="Hiệu suất danh mục"
          value={`${portfolioPnl >= 0 ? "+" : ""}${portfolioPnl.toFixed(2)}%`}
          caption={`Phần giải ngân: ${investedPnl >= 0 ? "+" : ""}${investedPnl.toFixed(2)}%`}
          tone={portfolioPnl >= 0 ? "up" : "down"}
        />
        <SummaryCard label="Đã giải ngân" value={`${totalWeight.toFixed(1)}%`} caption="Model portfolio VIP" />
        <SummaryCard label="Tiền mặt" value={`${cashWeight.toFixed(1)}%`} caption={totalWeight > 100 ? "Vượt tỷ trọng" : "Còn dư địa"} />
        <SummaryCard label="Số mã" value={`${holdings.length}`} caption={portfolio?.name || "Danh mục workspace"} />
        <SummaryCard label="Cập nhật gần nhất" value={formatShortDate(latestUpdate)} caption={latestUpdate ? formatTime(latestUpdate) : "Chưa có"} />
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(380px,0.85fr)]">
        <section className="rounded border border-panel-border bg-panel">
          <div className="flex items-center justify-between gap-3 border-b border-panel-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Danh mục hiện tại</h2>
              <p className="mt-1 text-xs text-zinc-500">Model portfolio broadcast cho VIP workspace, chỉ gồm các mã còn tỷ trọng.</p>
            </div>
            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-2 rounded border border-panel-border bg-background px-3 py-2 text-xs font-semibold text-zinc-300 hover:border-primary/50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Làm mới
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-xs">
              <thead className="border-b border-panel-border text-[11px] text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Mã</th>
                  <th className="px-4 py-3 font-medium">Vị thế</th>
                  <th className="px-4 py-3 font-medium">Động thái gần nhất</th>
                  <th className="px-4 py-3 font-medium">Tỷ trọng</th>
                  <th className="px-4 py-3 font-medium">Giá vốn KN</th>
                  <th className="px-4 py-3 font-medium">Giá hiện tại</th>
                  <th className="px-4 py-3 font-medium">Lãi/lỗ</th>
                  <th className="px-4 py-3 font-medium">Luận điểm</th>
                  {isBroker && <th className="px-4 py-3 text-right font-medium">Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={isBroker ? 9 : 8} className="px-4 py-10 text-center text-zinc-500">
                      Đang tải model portfolio...
                    </td>
                  </tr>
                ) : enrichedHoldings.length === 0 ? (
                  <tr>
                    <td colSpan={isBroker ? 9 : 8} className="px-4 py-10 text-center text-zinc-500">
                      {isBroker
                        ? "Chưa có mã nào trong model portfolio. Thêm mã đầu tiên để công bố cho VIP workspace."
                        : "Broker chưa công bố danh mục hiện tại."}
                    </td>
                  </tr>
                ) : (
                  enrichedHoldings.map((holding) => {
                    const action = (holding.last_action || "THESIS_UPDATE") as ActionKey;
                    return (
                      <tr key={holding.symbol} className="border-b border-panel-border/70 hover:bg-background/40">
                        <td className="px-4 py-3 text-sm font-semibold text-zinc-100">{holding.symbol}</td>
                        <td className="px-4 py-3">
                          <StatusBadge label="Đang nắm giữ" tone="neutral" icon={ShieldCheck} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <ActionBadge action={action} />
                            <div className="text-[11px] tabular-nums text-zinc-600">
                              {formatWeightMove(holding.previous_weight, holding.current_weight ?? holding.weight)}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold tabular-nums text-zinc-200">{holding.weight}%</td>
                        <td className="px-4 py-3 tabular-nums text-zinc-300">{formatCurrency(holding.entry_price)}</td>
                        <td className="px-4 py-3 tabular-nums text-zinc-200">{formatCurrency(holding.currentPrice)}</td>
                        <td className={cn("px-4 py-3 font-semibold tabular-nums", holding.pnl === undefined ? "text-zinc-500" : holding.pnl >= 0 ? "text-market-up" : "text-market-down")}>
                          {formatPercent(holding.pnl)}
                        </td>
                        <td className="max-w-[300px] px-4 py-3 text-zinc-400">{holding.active_thesis || holding.reason || "Chưa có luận điểm"}</td>
                        {isBroker && (
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <IconButton title="Sửa tỷ trọng" icon={Edit3} onClick={() => startEditPosition(holding)} />
                              <IconButton title="Bán hết" icon={Trash2} onClick={() => removePosition(holding)} tone="down" />
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          {isBroker && (
            <div id="position-form" className="rounded border border-panel-border bg-panel">
              <div className="flex items-center justify-between border-b border-panel-border px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-100">{editingSymbol ? `Cập nhật ${editingSymbol}` : "Cập nhật danh mục"}</h2>
                  <p className="mt-1 text-xs text-zinc-500">Thêm, tăng, giảm hoặc bán hết một mã trong model portfolio VIP.</p>
                </div>
                {editingSymbol && (
                  <button onClick={resetForm} className="rounded border border-panel-border p-2 text-zinc-500 hover:text-zinc-100" title="Hủy sửa">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="space-y-3 p-4">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className={inputClass}
                    value={positionForm.symbol}
                    onChange={(event) => setPositionForm({ ...positionForm, symbol: event.target.value.toUpperCase() })}
                    disabled={!!editingSymbol}
                    placeholder="Mã CP"
                  />
                  <input
                    className={inputClass}
                    type="number"
                    min={0}
                    max={100}
                    value={positionForm.target_weight || ""}
                    onChange={(event) => setPositionForm({ ...positionForm, target_weight: Number(event.target.value) })}
                    placeholder="Tỷ trọng mới (%)"
                  />
                </div>
                <input
                  className={inputClass}
                  type="number"
                  value={positionForm.applied_price || ""}
                  onChange={(event) => setPositionForm({ ...positionForm, applied_price: Number(event.target.value) })}
                  placeholder="Giá áp dụng"
                />
                <textarea
                  className={cn(inputClass, "resize-none leading-5")}
                  rows={3}
                  value={positionForm.thesis}
                  onChange={(event) => setPositionForm({ ...positionForm, thesis: event.target.value })}
                  placeholder="Luận điểm gửi VIP"
                />
                <textarea
                  className={cn(inputClass, "resize-none leading-5")}
                  rows={2}
                  value={positionForm.risk_note}
                  onChange={(event) => setPositionForm({ ...positionForm, risk_note: event.target.value })}
                  placeholder="Rủi ro / lưu ý"
                />
                <label className="flex items-center gap-2 rounded border border-panel-border bg-background px-3 py-2 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={positionForm.publish}
                    onChange={(event) => setPositionForm({ ...positionForm, publish: event.target.checked })}
                    className="h-4 w-4 accent-primary"
                  />
                  Công bố cho VIP workspace
                </label>
                <button
                  type="button"
                  onClick={submitPositionUpdate}
                  disabled={isSaving}
                  className="inline-flex w-full items-center justify-center gap-2 rounded bg-primary py-3 text-xs font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
                >
                  {editingSymbol ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {isSaving ? "Đang lưu..." : positionForm.publish ? "Cập nhật & công bố" : "Lưu cập nhật"}
                </button>
              </div>
            </div>
          )}

          <div className="rounded border border-panel-border bg-panel">
            <div className="border-b border-panel-border px-4 py-3">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-zinc-100">Lịch sử cập nhật</h2>
              </div>
              <p className="mt-1 text-xs text-zinc-500">Feed vận hành của model portfolio VIP.</p>
            </div>

            <div className="max-h-[560px] space-y-3 overflow-y-auto p-4">
              {portfolioUpdates.length === 0 ? (
                <div className="rounded border border-dashed border-panel-border bg-background/60 px-4 py-10 text-center text-xs text-zinc-500">
                  Chưa có cập nhật nào.
                </div>
              ) : (
                portfolioUpdates.map((update) => (
                  <PortfolioUpdateCard key={update.id} update={update} />
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function PortfolioUpdateCard({ update }: { update: PortfolioUpdateResponse }) {
  return (
    <article className="rounded border border-panel-border bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-zinc-100">{update.symbol}</span>
            <span className="text-zinc-600">·</span>
            <ActionBadge action={update.action} />
            {update.recommendation_id && <StatusBadge label="Đã công bố" tone="blue" icon={Megaphone} />}
          </div>
          <div className="mt-2 text-xs font-semibold tabular-nums text-zinc-300">
            {actionMeta(update.action).label} {formatWeightMove(update.previous_weight, update.current_weight)}
          </div>
          {update.note && <p className="mt-2 text-xs leading-5 text-zinc-400">{update.note}</p>}
        </div>
        <div className="shrink-0 text-right text-[11px] text-zinc-600">
          <div>{formatShortDate(update.created_at)}</div>
          <div>{formatTime(update.created_at)}</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-panel-border pt-3 text-[11px]">
        <RecMetric label="Giá áp dụng" value={formatCurrency(update.applied_price)} />
        <RecMetric label="Trạng thái" value={update.current_weight === 0 ? "Đã rời danh mục" : "Còn trong danh mục"} tone={update.current_weight === 0 ? "down" : "up"} />
      </div>
    </article>
  );
}

function SummaryCard({ label, value, caption, tone }: { label: string; value: string; caption?: string; tone?: "up" | "down" }) {
  return (
    <div className="rounded border border-panel-border bg-panel p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={cn("mt-2 text-xl font-semibold tabular-nums text-zinc-100", tone === "up" && "text-market-up", tone === "down" && "text-market-down")}>{value}</div>
      {caption && <div className="mt-1 truncate text-[11px] text-zinc-500">{caption}</div>}
    </div>
  );
}

function RecMetric({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div>
      <div className="text-zinc-600">{label}</div>
      <div className={cn("mt-1 font-semibold tabular-nums text-zinc-300", tone === "up" && "text-market-up", tone === "down" && "text-market-down")}>{value}</div>
    </div>
  );
}

function IconButton({ title, icon: Icon, onClick, tone }: { title: string; icon: ComponentType<{ className?: string }>; onClick: () => void; tone?: "down" }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded border border-panel-border text-zinc-500 hover:text-zinc-100",
        tone === "down" && "hover:border-market-down/40 hover:text-market-down"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function ActionBadge({ action }: { action: ActionKey }) {
  const meta = actionMeta(action);
  return <StatusBadge label={meta.label} tone={meta.tone} icon={meta.icon} />;
}

function StatusBadge({
  label,
  tone,
  icon: Icon,
}: {
  label: string;
  tone: "up" | "down" | "neutral" | "blue";
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-semibold",
        tone === "up" && "border-market-up/30 bg-market-up/10 text-market-up",
        tone === "down" && "border-market-down/30 bg-market-down/10 text-market-down",
        tone === "neutral" && "border-panel-border bg-muted/40 text-zinc-300",
        tone === "blue" && "border-primary/30 bg-primary/10 text-primary"
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </span>
  );
}

function actionMeta(action: ActionKey): {
  label: string;
  tone: "up" | "down" | "neutral" | "blue";
  icon: ComponentType<{ className?: string }>;
} {
  const map: Record<ActionKey, { label: string; tone: "up" | "down" | "neutral" | "blue"; icon: ComponentType<{ className?: string }> }> = {
    BUY_NEW: { label: "Mua mới", tone: "up", icon: Plus },
    INCREASE: { label: "Tăng tỷ trọng", tone: "up", icon: Activity },
    DECREASE: { label: "Giảm tỷ trọng", tone: "down", icon: Activity },
    SELL_ALL: { label: "Bán hết", tone: "down", icon: Trash2 },
    THESIS_UPDATE: { label: "Cập nhật luận điểm", tone: "blue", icon: Edit3 },
  };
  return map[action] || map.THESIS_UPDATE;
}

function formatWeightMove(previous?: number | null, current?: number | null) {
  if (previous === undefined || previous === null || current === undefined || current === null) return "--";
  return `${formatWeight(previous)} -> ${formatWeight(current)}`;
}

function formatWeight(value: number) {
  return `${Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
}

function formatCurrency(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return "--";
  return value.toLocaleString("vi-VN", { maximumFractionDigits: 3 });
}

function formatPercent(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return "--";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatShortDate(value?: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function formatTime(value?: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}
