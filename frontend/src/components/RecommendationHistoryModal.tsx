"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Edit3, FileText, History, Send, X, XCircle } from "lucide-react";
import { apiService, RecommendationEventResponse, WsRecommendationResponse } from "@/lib/api";

interface RecommendationHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  recId: string | null;
}

const eventLabels: Record<string, string> = {
  CREATED: "Tạo bản nháp",
  PUBLISHED: "Công bố",
  THESIS_UPDATED: "Cập nhật luận điểm",
  TARGET_UPDATED: "Cập nhật giá mục tiêu",
  CUTLOSS_UPDATED: "Cập nhật giá cắt lỗ",
  APPLIED_TO_PORTFOLIO: "Áp dụng vào danh mục",
  CLOSED: "Đóng khuyến nghị",
  ARCHIVED: "Lưu trữ",
};

function eventIcon(eventType: string) {
  switch (eventType) {
    case "CREATED":
      return FileText;
    case "PUBLISHED":
      return Send;
    case "THESIS_UPDATED":
    case "TARGET_UPDATED":
    case "CUTLOSS_UPDATED":
      return Edit3;
    case "APPLIED_TO_PORTFOLIO":
      return CheckCircle2;
    case "CLOSED":
    case "ARCHIVED":
      return XCircle;
    default:
      return Clock;
  }
}

function parseState(value?: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function formatNumber(value?: number | null) {
  if (value === undefined || value === null) return "--";
  return value.toLocaleString("vi-VN");
}

function actionLabel(action?: string | null) {
  switch (action) {
    case "BUY":
      return "Mua";
    case "SELL":
      return "Bán";
    case "HOLD":
      return "Nắm giữ";
    case "CLOSE":
      return "Đóng";
    case "REVERSE":
      return "Đảo chiều";
    default:
      return action || "--";
  }
}

export function RecommendationHistoryModal({ isOpen, onClose, recId }: RecommendationHistoryModalProps) {
  const [history, setHistory] = useState<RecommendationEventResponse[]>([]);
  const [rec, setRec] = useState<WsRecommendationResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !recId) return;

    setLoading(true);
    Promise.all([apiService.getWsRecommendation(recId), apiService.getRecommendationHistory(recId)])
      .then(([recData, historyData]) => {
        setRec(recData);
        setHistory(historyData);
      })
      .catch((error) => console.error("Không thể tải nhật ký thay đổi", error))
      .finally(() => setLoading(false));
  }, [isOpen, recId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <button aria-label="Đóng" onClick={onClose} className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm" />

      <div className="relative flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-panel-border bg-panel shadow-2xl">
        <div className="flex items-center justify-between border-b border-panel-border px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-500">
              <History className="h-4 w-4" />
              Nhật ký thay đổi
            </div>
            <h3 className="mt-1 text-xl font-semibold text-zinc-900">
              {rec?.symbol || "--"} · {actionLabel(rec?.action_type || rec?.side)}
            </h3>
          </div>
          <button onClick={onClose} className="rounded border border-panel-border p-2 text-zinc-500 hover:text-zinc-900">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="flex h-36 items-center justify-center text-sm text-zinc-500">Đang tải nhật ký...</div>
          ) : history.length === 0 ? (
            <div className="rounded border border-dashed border-panel-border py-10 text-center text-sm text-zinc-500">
              Chưa có thay đổi nào được ghi nhận.
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((event) => {
                const Icon = eventIcon(event.event_type);
                const afterState = parseState(event.after_state);
                return (
                  <div key={event.id} className="rounded border border-panel-border bg-white p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded bg-zinc-100 text-primary">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-zinc-900">
                            {eventLabels[event.event_type] || event.event_type}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {event.created_at ? new Date(event.created_at).toLocaleString("vi-VN") : "--"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {event.note && <div className="mt-3 rounded bg-zinc-50 px-3 py-2 text-sm text-zinc-700">{event.note}</div>}

                    {afterState && !Array.isArray(afterState) && (
                      <div className="mt-3 grid gap-2 text-xs text-zinc-600 sm:grid-cols-3">
                        {"status" in afterState && (
                          <div>
                            Trạng thái: <span className="font-semibold text-zinc-900">{afterState.status}</span>
                          </div>
                        )}
                        {"target_price" in afterState && (
                          <div>
                            Mục tiêu: <span className="font-semibold text-emerald-700">{formatNumber(afterState.target_price)}</span>
                          </div>
                        )}
                        {"cutloss_price" in afterState && (
                          <div>
                            Cắt lỗ: <span className="font-semibold text-red-700">{formatNumber(afterState.cutloss_price)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
