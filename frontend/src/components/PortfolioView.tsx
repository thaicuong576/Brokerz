"use client";

import type { ComponentType } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  History,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Trash2,
  X,
} from "lucide-react";

import { RecommendationHistoryModal } from "@/components/RecommendationHistoryModal";
import { apiService, type PortfolioResponse, type WsRecommendationResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

type RecTab = "DRAFT" | "PUBLISHED" | "APPLIED_TO_PORTFOLIO" | "CLOSED";

const emptyRec = {
  symbol: "",
  side: "BUY",
  action_type: "BUY",
  thesis: "",
  entry_price: 0,
  target_price: 0,
  cutloss_price: 0,
  risk_note: "",
};

const inputClass =
  "w-full rounded border border-panel-border bg-background px-3 py-2 text-xs text-zinc-100 outline-none transition-colors focus:border-primary disabled:opacity-60";

export function PortfolioView({ isBroker = false, user = null }: { isBroker: boolean; user: any; profile?: any }) {
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [marketData, setMarketData] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<WsRecommendationResponse[]>([]);
  const [recTab, setRecTab] = useState<RecTab>(isBroker ? "DRAFT" : "PUBLISHED");
  const [isLoading, setIsLoading] = useState(true);
  const [newRec, setNewRec] = useState({ ...emptyRec });
  const [editingRecId, setEditingRecId] = useState<string | null>(null);
  const [historyRecId, setHistoryRecId] = useState<string | null>(null);
  const [applyTarget, setApplyTarget] = useState<WsRecommendationResponse | null>(null);
  const [closeTarget, setCloseTarget] = useState<WsRecommendationResponse | null>(null);
  const [reverseTarget, setReverseTarget] = useState<WsRecommendationResponse | null>(null);
  const [applyForm, setApplyForm] = useState({ weight: 0, applied_price: 0, note: "" });
  const [closeForm, setCloseForm] = useState({ reason: "MANUAL", note: "" });
  const [reverseForm, setReverseForm] = useState({ close_price: 0, close_note: "", target_price: 0, cutloss_price: 0, thesis: "", risk_note: "" });

  const loadData = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const [portfolioData, recData, stockData] = await Promise.all([
        apiService.getCurrentPortfolio(),
        apiService.getWsRecommendations(),
        apiService.getLatestStocks().catch(() => []),
      ]);
      setPortfolio(portfolioData);
      setRecommendations(recData || []);
      if (Array.isArray(stockData)) setMarketData(stockData);
    } catch (err) {
      console.error("Không tải được dữ liệu Portfolio", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const holdings = portfolio?.items || [];
  const enrichedHoldings = useMemo(
    () =>
      holdings.map((item) => {
        const current = marketData.find((price) => price.symbol === item.symbol);
        const currentPrice = current?.price || current?.ref_price || item.entry_price || 0;
        const pnl = item.entry_price ? ((currentPrice - item.entry_price) / item.entry_price) * 100 : 0;
        return { ...item, currentPrice, pnl };
      }),
    [holdings, marketData]
  );

  const totalWeight = holdings.reduce((sum, item) => sum + (item.weight || 0), 0);
  const avgPnl =
    enrichedHoldings.length > 0
      ? enrichedHoldings.reduce((sum, item) => sum + item.pnl * ((item.weight || 0) / (totalWeight || 1)), 0)
      : 0;

  const filteredRecommendations = recommendations.filter((rec) => {
    if (recTab === "PUBLISHED") return rec.status === "PUBLISHED" || rec.status === "PUBLISHED_ONLY";
    return rec.status === recTab;
  });

  const submitRecommendation = async () => {
    if (!newRec.symbol) {
      alert("Vui lòng nhập mã cổ phiếu.");
      return;
    }
    try {
      if (editingRecId) {
        const updated = await apiService.updateRecommendationThesis(editingRecId, {
          thesis: newRec.thesis,
          target_price: newRec.target_price || undefined,
          cutloss_price: newRec.cutloss_price || undefined,
          risk_note: newRec.risk_note || undefined,
          note: "Broker cập nhật khuyến nghị",
        });
        setRecommendations((items) => items.map((item) => (item.id === editingRecId ? updated : item)));
        setEditingRecId(null);
      } else {
        const created = await apiService.createWsRecommendation({
          symbol: newRec.symbol,
          side: newRec.side,
          action_type: newRec.action_type,
          thesis: newRec.thesis,
          entry_price: newRec.entry_price || undefined,
          target_price: newRec.target_price || undefined,
          cutloss_price: newRec.cutloss_price || undefined,
          risk_note: newRec.risk_note || undefined,
        });
        setRecommendations((items) => [created, ...items]);
      }
      setNewRec({ ...emptyRec });
    } catch (err) {
      console.error("Không lưu được khuyến nghị", err);
      alert("Không lưu được khuyến nghị.");
    }
  };

  const publishRecommendation = async (rec: WsRecommendationResponse) => {
    try {
      const updated = await apiService.publishRecommendation(rec.id);
      setRecommendations((items) => items.map((item) => (item.id === rec.id ? updated : item)));
      setRecTab("PUBLISHED");
      const shouldApply = confirm("Khuyến nghị đã công bố. Bạn có muốn áp dụng thay đổi này vào danh mục không?");
      if (shouldApply) openApplyModal(updated);
    } catch (err) {
      console.error("Không công bố được khuyến nghị", err);
      alert("Không công bố được khuyến nghị.");
    }
  };

  const openApplyModal = (rec: WsRecommendationResponse) => {
    const existing = holdings.find((item) => item.symbol === rec.symbol);
    setApplyTarget(rec);
    setApplyForm({
      weight: existing?.weight || 0,
      applied_price: rec.entry_price || rec.current_price || existing?.entry_price || 0,
      note: "",
    });
  };

  const applyRecommendation = async () => {
    if (!applyTarget) return;
    try {
      const updated = await apiService.applyRecommendationToPortfolio(applyTarget.id, {
        weight: Number(applyForm.weight),
        applied_price: Number(applyForm.applied_price) || undefined,
        note: applyForm.note || undefined,
      });
      setRecommendations((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      setApplyTarget(null);
      setRecTab("APPLIED_TO_PORTFOLIO");
      await loadData();
    } catch (err) {
      console.error("Không áp dụng được vào danh mục", err);
      alert("Không áp dụng được vào danh mục.");
    }
  };

  const closeRecommendation = async () => {
    if (!closeTarget) return;
    try {
      const updated = await apiService.closeRecommendation(closeTarget.id, closeForm.reason, closeForm.note || undefined);
      setRecommendations((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      setCloseTarget(null);
      setRecTab("CLOSED");
    } catch (err) {
      console.error("Không đóng được khuyến nghị", err);
      alert("Không đóng được khuyến nghị.");
    }
  };

  const reverseRecommendation = async () => {
    if (!reverseTarget) return;
    try {
      const created = await apiService.reverseRecommendation(reverseTarget.id, {
        close_price: Number(reverseForm.close_price) || undefined,
        close_note: reverseForm.close_note || undefined,
        new_entry_price: Number(reverseForm.close_price) || undefined,
        target_price: Number(reverseForm.target_price) || undefined,
        cutloss_price: Number(reverseForm.cutloss_price) || undefined,
        thesis: reverseForm.thesis || undefined,
        risk_note: reverseForm.risk_note || undefined,
      });
      await loadData();
      setRecommendations((items) => [created, ...items.filter((item) => item.id !== created.id)]);
      setReverseTarget(null);
      setRecTab("DRAFT");
    } catch (err) {
      console.error("Không đảo chiều được khuyến nghị", err);
      alert("Không đảo chiều được khuyến nghị.");
    }
  };

  const startEditRec = (rec: WsRecommendationResponse) => {
    setEditingRecId(rec.id);
    setNewRec({
      symbol: rec.symbol,
      side: rec.side,
      action_type: rec.action_type,
      thesis: rec.thesis || "",
      entry_price: rec.entry_price || 0,
      target_price: rec.target_price || 0,
      cutloss_price: rec.cutloss_price || 0,
      risk_note: rec.risk_note || "",
    });
    document.getElementById("rec-form")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(380px,0.9fr)]">
        <section className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <SummaryCard label="Hiệu suất danh mục" value={`${avgPnl >= 0 ? "+" : ""}${avgPnl.toFixed(2)}%`} tone={avgPnl >= 0 ? "up" : "down"} />
            <SummaryCard label="Tổng tỷ trọng" value={`${totalWeight.toFixed(1)}%`} caption={totalWeight > 100 ? "Vượt tỷ trọng" : totalWeight < 100 ? "Còn tiền mặt" : "Đã phân bổ đủ"} />
            <SummaryCard label="Số mã hiện tại" value={`${holdings.length}`} caption={portfolio?.name || "Danh mục workspace"} />
          </div>

          <div className="rounded border border-panel-border bg-panel">
            <div className="flex items-center justify-between gap-3 border-b border-panel-border px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">Danh mục hiện tại</h2>
                <p className="mt-1 text-xs text-zinc-500">Trạng thái sau các khuyến nghị đã được broker áp dụng.</p>
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
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="border-b border-panel-border text-[11px] text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Mã</th>
                    <th className="px-4 py-3 font-medium">Tỷ trọng</th>
                    <th className="px-4 py-3 font-medium">Giá áp dụng</th>
                    <th className="px-4 py-3 font-medium">Giá hiện tại</th>
                    <th className="px-4 py-3 font-medium">Lãi/lỗ</th>
                    <th className="px-4 py-3 font-medium">Luận điểm đang hiệu lực</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-zinc-500">Đang tải danh mục...</td></tr>
                  ) : enrichedHoldings.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-zinc-500">Chưa có mã nào được áp dụng vào danh mục.</td></tr>
                  ) : (
                    enrichedHoldings.map((holding) => (
                      <tr key={holding.symbol} className="border-b border-panel-border/70 hover:bg-background/40">
                        <td className="px-4 py-3 text-sm font-semibold text-zinc-100">{holding.symbol}</td>
                        <td className="px-4 py-3 font-semibold tabular-nums text-zinc-200">{holding.weight}%</td>
                        <td className="px-4 py-3 tabular-nums text-zinc-300">{formatCurrency(holding.entry_price)}</td>
                        <td className="px-4 py-3 tabular-nums text-zinc-200">{formatCurrency(holding.currentPrice)}</td>
                        <td className={cn("px-4 py-3 font-semibold tabular-nums", holding.pnl >= 0 ? "text-market-up" : "text-market-down")}>
                          {holding.pnl >= 0 ? "+" : ""}{holding.pnl.toFixed(2)}%
                        </td>
                        <td className="max-w-[320px] px-4 py-3 text-zinc-400">{holding.active_thesis || holding.reason || "Chưa có luận điểm"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="rounded border border-panel-border bg-panel">
          <div className="border-b border-panel-border px-4 py-3">
            <h2 className="text-sm font-semibold text-zinc-100">Khuyến nghị</h2>
            <p className="mt-1 text-xs text-zinc-500">Khuyến nghị là hành động; danh mục là trạng thái sau khi áp dụng.</p>
          </div>

          <div className="grid grid-cols-2 gap-1 border-b border-panel-border bg-background p-2 md:grid-cols-4">
            {isBroker && <RecommendationTab active={recTab === "DRAFT"} label="Bản nháp" onClick={() => setRecTab("DRAFT")} />}
            <RecommendationTab active={recTab === "PUBLISHED"} label="Đã công bố" onClick={() => setRecTab("PUBLISHED")} />
            <RecommendationTab active={recTab === "APPLIED_TO_PORTFOLIO"} label="Đã áp dụng" onClick={() => setRecTab("APPLIED_TO_PORTFOLIO")} />
            <RecommendationTab active={recTab === "CLOSED"} label="Đã đóng" onClick={() => setRecTab("CLOSED")} />
          </div>

          <div className="max-h-[560px] space-y-3 overflow-y-auto p-4">
            {filteredRecommendations.length === 0 ? (
              <div className="rounded border border-dashed border-panel-border bg-background/60 px-4 py-10 text-center text-xs text-zinc-500">
                Chưa có khuyến nghị trong nhóm này.
              </div>
            ) : (
              filteredRecommendations.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  rec={rec}
                  isBroker={isBroker}
                  onEdit={() => startEditRec(rec)}
                  onPublish={() => publishRecommendation(rec)}
                  onApply={() => openApplyModal(rec)}
                  onClose={() => {
                    setCloseTarget(rec);
                    setCloseForm({ reason: "MANUAL", note: "" });
                  }}
                  onReverse={() => {
                    setReverseTarget(rec);
                    setReverseForm({ close_price: rec.current_price || rec.entry_price || 0, close_note: "", target_price: 0, cutloss_price: 0, thesis: "", risk_note: "" });
                  }}
                  onHistory={() => setHistoryRecId(rec.id)}
                />
              ))
            )}
          </div>

          {isBroker && (
            <div id="rec-form" className="border-t border-panel-border bg-background p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-zinc-100">{editingRecId ? "Cập nhật khuyến nghị" : "Tạo bản nháp khuyến nghị"}</h3>
                {editingRecId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRecId(null);
                      setNewRec({ ...emptyRec });
                    }}
                    className="text-[11px] text-zinc-500 hover:text-market-down"
                  >
                    Hủy
                  </button>
                )}
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <input className={inputClass} value={newRec.symbol} onChange={(event) => setNewRec({ ...newRec, symbol: event.target.value.toUpperCase() })} disabled={!!editingRecId} placeholder="Mã CP" />
                  <div className="grid grid-cols-2 gap-2">
                    <SideButton active={newRec.side === "BUY"} label="Mua" tone="up" onClick={() => setNewRec({ ...newRec, side: "BUY", action_type: "BUY" })} disabled={!!editingRecId} />
                    <SideButton active={newRec.side === "SELL"} label="Bán" tone="down" onClick={() => setNewRec({ ...newRec, side: "SELL", action_type: "SELL" })} disabled={!!editingRecId} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input className={inputClass} type="number" value={newRec.entry_price || ""} onChange={(event) => setNewRec({ ...newRec, entry_price: Number(event.target.value) })} placeholder="Giá khuyến nghị" />
                  <input className={inputClass} type="number" value={newRec.target_price || ""} onChange={(event) => setNewRec({ ...newRec, target_price: Number(event.target.value) })} placeholder="Mục tiêu" />
                  <input className={inputClass} type="number" value={newRec.cutloss_price || ""} onChange={(event) => setNewRec({ ...newRec, cutloss_price: Number(event.target.value) })} placeholder="Cắt lỗ" />
                </div>
                <textarea className={cn(inputClass, "resize-none leading-5")} rows={3} value={newRec.thesis} onChange={(event) => setNewRec({ ...newRec, thesis: event.target.value })} placeholder="Luận điểm đầu tư" />
                <textarea className={cn(inputClass, "resize-none leading-5")} rows={2} value={newRec.risk_note} onChange={(event) => setNewRec({ ...newRec, risk_note: event.target.value })} placeholder="Rủi ro / lưu ý" />
                <button type="button" onClick={submitRecommendation} className="w-full rounded bg-primary py-3 text-xs font-semibold text-primary-foreground hover:bg-primary-hover">
                  {editingRecId ? "Lưu thay đổi" : "Tạo bản nháp"}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      <ApplyModal target={applyTarget} form={applyForm} setForm={setApplyForm} onClose={() => setApplyTarget(null)} onSubmit={applyRecommendation} />
      <CloseModal target={closeTarget} form={closeForm} setForm={setCloseForm} onClose={() => setCloseTarget(null)} onSubmit={closeRecommendation} />
      <ReverseModal target={reverseTarget} form={reverseForm} setForm={setReverseForm} onClose={() => setReverseTarget(null)} onSubmit={reverseRecommendation} />
      <RecommendationHistoryModal isOpen={!!historyRecId} onClose={() => setHistoryRecId(null)} recId={historyRecId} />
    </>
  );
}

function RecommendationCard({
  rec,
  isBroker,
  onEdit,
  onPublish,
  onApply,
  onClose,
  onReverse,
  onHistory,
}: {
  rec: WsRecommendationResponse;
  isBroker: boolean;
  onEdit: () => void;
  onPublish: () => void;
  onApply: () => void;
  onClose: () => void;
  onReverse: () => void;
  onHistory: () => void;
}) {
  const canMutate = isBroker && rec.status !== "CLOSED" && rec.status !== "ARCHIVED";
  const canEdit = canMutate && rec.status !== "CLOSED";
  const canApply = isBroker && ["PUBLISHED", "PUBLISHED_ONLY", "APPLIED_TO_PORTFOLIO"].includes(rec.status);
  return (
    <article className="rounded border border-panel-border bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded border px-2 py-1 text-xs font-semibold", rec.side === "BUY" ? "border-market-up/30 bg-market-up/10 text-market-up" : "border-market-down/30 bg-market-down/10 text-market-down")}>
              {rec.symbol}
            </span>
            <span className="text-[11px] text-zinc-500">{actionLabel(rec.action_type)}</span>
            <span className="rounded border border-panel-border px-2 py-1 text-[10px] font-semibold text-zinc-500">{statusLabel(rec.status)}</span>
          </div>
          <p className="mt-3 text-xs leading-5 text-zinc-300">{rec.thesis || "Chưa có luận điểm."}</p>
          <p className="mt-2 text-[10px] text-zinc-600">Cập nhật lần cuối: {formatDateTime(rec.updated_at)}</p>
        </div>
        <button title="Nhật ký thay đổi" onClick={onHistory} className="rounded border border-panel-border p-1.5 text-zinc-500 hover:text-primary">
          <History className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-panel-border pt-3 text-[11px]">
        <RecMetric label="Giá KN" value={formatCurrency(rec.entry_price)} />
        <RecMetric label="Mục tiêu" value={formatCurrency(rec.target_price)} tone="up" />
        <RecMetric label="Cắt lỗ" value={formatCurrency(rec.cutloss_price)} tone="down" />
      </div>
      {rec.risk_note && <p className="mt-3 rounded border border-market-down/20 bg-market-down/10 px-3 py-2 text-[11px] text-market-down">{rec.risk_note}</p>}
      {isBroker && (
        <div className="mt-3 flex flex-wrap gap-2">
          {canEdit && <ActionButton label={rec.status === "DRAFT" ? "Sửa bản nháp" : "Cập nhật"} icon={Save} onClick={onEdit} />}
          {rec.status === "DRAFT" && <ActionButton label="Công bố" icon={Send} onClick={onPublish} tone="primary" />}
          {canApply && <ActionButton label="Áp dụng vào danh mục" icon={CheckCircle2} onClick={onApply} tone="up" />}
          {canMutate && <ActionButton label="Đóng" icon={Trash2} onClick={onClose} tone="down" />}
          {canMutate && <ActionButton label="Đảo chiều" icon={RotateCcw} onClick={onReverse} />}
        </div>
      )}
    </article>
  );
}

function ApplyModal({ target, form, setForm, onClose, onSubmit }: any) {
  if (!target) return null;
  return (
    <Modal title={`Áp dụng ${target.symbol} vào danh mục`} onClose={onClose}>
      <div className="space-y-3">
        <input className={inputClass} type="number" value={form.weight || ""} onChange={(event) => setForm({ ...form, weight: Number(event.target.value) })} placeholder="Tỷ trọng mới (%)" />
        <input className={inputClass} type="number" value={form.applied_price || ""} onChange={(event) => setForm({ ...form, applied_price: Number(event.target.value) })} placeholder="Giá áp dụng" />
        <textarea className={cn(inputClass, "resize-none")} rows={3} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Ghi chú thay đổi" />
        <p className="text-[11px] text-zinc-500">Tỷ trọng bằng 0 sẽ xóa mã khỏi danh mục hiện tại.</p>
        <button onClick={onSubmit} className="w-full rounded bg-primary py-3 text-xs font-semibold text-primary-foreground">Xác nhận áp dụng</button>
      </div>
    </Modal>
  );
}

function CloseModal({ target, form, setForm, onClose, onSubmit }: any) {
  if (!target) return null;
  return (
    <Modal title={`Đóng khuyến nghị ${target.symbol}`} onClose={onClose}>
      <div className="space-y-3">
        <select className={inputClass} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })}>
          <option value="TARGET_REACHED">Đạt mục tiêu</option>
          <option value="CUTLOSS_HIT">Chạm cắt lỗ</option>
          <option value="NO_LONGER_VALID">Luận điểm không còn phù hợp</option>
          <option value="MANUAL">Đóng thủ công</option>
        </select>
        <textarea className={cn(inputClass, "resize-none")} rows={3} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Ghi chú đóng khuyến nghị" />
        <button onClick={onSubmit} className="w-full rounded bg-market-down py-3 text-xs font-semibold text-white">Đóng khuyến nghị</button>
      </div>
    </Modal>
  );
}

function ReverseModal({ target, form, setForm, onClose, onSubmit }: any) {
  if (!target) return null;
  const newSide = target.side === "BUY" ? "BÁN" : "MUA";
  return (
    <Modal title={`Đảo chiều ${target.symbol} sang ${newSide}`} onClose={onClose}>
      <div className="space-y-3">
        <input className={inputClass} type="number" value={form.close_price || ""} onChange={(event) => setForm({ ...form, close_price: Number(event.target.value) })} placeholder="Giá đóng khuyến nghị cũ" />
        <textarea className={cn(inputClass, "resize-none")} rows={2} value={form.close_note} onChange={(event) => setForm({ ...form, close_note: event.target.value })} placeholder="Lý do đảo chiều" />
        <div className="grid grid-cols-2 gap-2">
          <input className={inputClass} type="number" value={form.target_price || ""} onChange={(event) => setForm({ ...form, target_price: Number(event.target.value) })} placeholder="Mục tiêu mới" />
          <input className={inputClass} type="number" value={form.cutloss_price || ""} onChange={(event) => setForm({ ...form, cutloss_price: Number(event.target.value) })} placeholder="Cắt lỗ mới" />
        </div>
        <textarea className={cn(inputClass, "resize-none")} rows={3} value={form.thesis} onChange={(event) => setForm({ ...form, thesis: event.target.value })} placeholder="Luận điểm mới" />
        <textarea className={cn(inputClass, "resize-none")} rows={2} value={form.risk_note} onChange={(event) => setForm({ ...form, risk_note: event.target.value })} placeholder="Rủi ro mới" />
        <button onClick={onSubmit} className="w-full rounded bg-primary py-3 text-xs font-semibold text-primary-foreground">Đóng cũ và tạo bản nháp mới</button>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded border border-panel-border bg-panel p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
          <button onClick={onClose} className="rounded border border-panel-border p-2 text-zinc-500 hover:text-zinc-100"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, caption, tone }: { label: string; value: string; caption?: string; tone?: "up" | "down" }) {
  return (
    <div className="rounded border border-panel-border bg-panel p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={cn("mt-2 text-2xl font-semibold tabular-nums text-zinc-100", tone === "up" && "text-market-up", tone === "down" && "text-market-down")}>{value}</div>
      {caption && <div className="mt-1 text-[11px] text-zinc-500">{caption}</div>}
    </div>
  );
}

function RecommendationTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn("rounded px-3 py-2 text-xs font-semibold transition-colors", active ? "bg-primary text-primary-foreground" : "text-zinc-500 hover:bg-muted hover:text-zinc-100")}>{label}</button>;
}

function SideButton({ active, label, tone, onClick, disabled }: { active: boolean; label: string; tone: "up" | "down"; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cn("rounded border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50", active ? tone === "up" ? "border-market-up/40 bg-market-up/10 text-market-up" : "border-market-down/40 bg-market-down/10 text-market-down" : "border-panel-border text-zinc-500 hover:text-zinc-100")}>{label}</button>
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

function ActionButton({ label, icon: Icon, onClick, tone }: { label: string; icon: ComponentType<{ className?: string }>; onClick: () => void; tone?: "primary" | "up" | "down" }) {
  return (
    <button type="button" onClick={onClick} className={cn("inline-flex items-center gap-1.5 rounded border border-panel-border px-2 py-1.5 text-[11px] font-semibold text-zinc-400 hover:text-zinc-100", tone === "primary" && "border-primary/30 bg-primary/10 text-primary", tone === "up" && "border-market-up/30 bg-market-up/10 text-market-up", tone === "down" && "border-market-down/30 bg-market-down/10 text-market-down")}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function actionLabel(action: string) {
  const map: Record<string, string> = { BUY: "Mua", SELL: "Bán", HOLD: "Nắm giữ", CLOSE: "Đóng", REVERSE: "Đảo chiều" };
  return map[action] || action;
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    DRAFT: "Bản nháp",
    PUBLISHED: "Đã công bố",
    PUBLISHED_ONLY: "Chỉ công bố",
    APPLIED_TO_PORTFOLIO: "Đã áp dụng",
    CLOSED: "Đã đóng",
    ARCHIVED: "Đã lưu trữ",
  };
  return map[status] || status;
}

function formatCurrency(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return "--";
  return value.toLocaleString("vi-VN", { maximumFractionDigits: 0 });
}

function formatDateTime(value?: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}
