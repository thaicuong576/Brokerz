"use client";

import { useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import useSWR from "swr";
import api from "@/lib/api";

const fetcher = (url: string) => api.get(url).then((res) => res.data);

export interface JudgmentData {
  pe_ratio: number;
  technical_score: number;
  technical_rating: string;
  liquidity_comment: string;
  expert_comment: string;
}

interface ExpertJudgmentFormProps {
  onSubmit: (data: JudgmentData) => void;
  isGenerating: boolean;
}

const LIQUIDITY_OPTIONS = [
  "Thanh khoản bùng nổ, dòng tiền vào mạnh",
  "Thanh khoản duy trì ở mức trung bình",
  "Thanh khoản sụt giảm, bên mua thận trọng",
  "Tùy chỉnh...",
];

export default function ExpertJudgmentForm({ onSubmit, isGenerating }: ExpertJudgmentFormProps) {
  const { data: systemStatus } = useSWR("/system/status", fetcher, { refreshInterval: 3000 });
  const isSyncing = systemStatus?.state === "SYNCING";
  const syncMessage = systemStatus?.message || "Đang đồng bộ dữ liệu tĩnh...";

  const [isCustomLiquidity, setIsCustomLiquidity] = useState(false);
  const [formData, setFormData] = useState<JudgmentData>({
    pe_ratio: 14.5,
    technical_score: 5,
    technical_rating: "Tích cực",
    liquidity_comment: LIQUIDITY_OPTIONS[1],
    expert_comment: "Thị trường phân hóa, khối ngoại bán ròng và cần thêm tín hiệu xác nhận từ dòng tiền.",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleLiquidityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "Tùy chỉnh...") {
      setIsCustomLiquidity(true);
      setFormData({ ...formData, liquidity_comment: "" });
      return;
    }
    setIsCustomLiquidity(false);
    setFormData({ ...formData, liquidity_comment: value });
  };

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col gap-5 rounded-lg border border-zinc-800 bg-panel p-5 shadow-md">
      <div>
        <h3 className="text-lg font-bold text-zinc-100">Điều chỉnh của broker</h3>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Bổ sung góc nhìn thủ công trước khi AI soạn bản nháp.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-xs font-bold text-zinc-400">
          P/E VN-Index
          <input
            type="number"
            step="0.1"
            value={formData.pe_ratio}
            onChange={(e) => setFormData({ ...formData, pe_ratio: parseFloat(e.target.value) || 0 })}
            className="rounded border border-zinc-800 bg-zinc-900 p-2 text-sm text-zinc-200 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-blue-600"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-bold text-zinc-400">
          Điểm kỹ thuật (-7 đến +7)
          <input
            type="number"
            min="-7"
            max="7"
            value={formData.technical_score}
            onChange={(e) => {
              const score = parseInt(e.target.value, 10) || 0;
              let rating = "Trung tính";
              if (score >= 4) rating = "Tích cực";
              else if (score <= -4) rating = "Tiêu cực";
              setFormData({ ...formData, technical_score: score, technical_rating: rating });
            }}
            className="rounded border border-zinc-800 bg-zinc-900 p-2 text-sm text-zinc-200 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-blue-600"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-xs font-bold text-zinc-400">
          Trạng thái kỹ thuật
          <select
            value={formData.technical_rating}
            onChange={(e) => setFormData({ ...formData, technical_rating: e.target.value })}
            className="rounded border border-zinc-800 bg-zinc-900 p-2 text-sm text-zinc-200 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-blue-600"
          >
            <option>Tiêu cực</option>
            <option>Trung tính</option>
            <option>Tích cực</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-bold text-zinc-400">
          Nhận xét thanh khoản
          {!isCustomLiquidity ? (
            <select
              value={formData.liquidity_comment}
              onChange={handleLiquidityChange}
              className="rounded border border-zinc-800 bg-zinc-900 p-2 text-sm text-zinc-200 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-blue-600"
            >
              {LIQUIDITY_OPTIONS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          ) : (
            <div className="flex overflow-hidden rounded border border-zinc-800 bg-zinc-900 focus-within:ring-2 focus-within:ring-blue-600">
              <input
                type="text"
                autoFocus
                placeholder="Nhập nhận xét thanh khoản..."
                value={formData.liquidity_comment}
                onChange={(e) => setFormData({ ...formData, liquidity_comment: e.target.value })}
                className="w-full bg-transparent p-2 text-sm text-zinc-200 outline-none"
              />
              <button
                type="button"
                onClick={() => setIsCustomLiquidity(false)}
                className="bg-zinc-800 px-2 text-[10px] font-bold uppercase text-zinc-400 hover:bg-zinc-700"
              >
                Hủy
              </button>
            </div>
          )}
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-xs font-bold text-zinc-400">
        Nhận xét của broker
        <textarea
          rows={4}
          value={formData.expert_comment}
          onChange={(e) => setFormData({ ...formData, expert_comment: e.target.value })}
          className="resize-none rounded border border-zinc-800 bg-zinc-900 p-2 text-sm text-zinc-200 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-blue-600"
        />
      </label>

      <button
        type="submit"
        disabled={isGenerating || isSyncing}
        className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded bg-orange-500 px-4 py-3 font-bold text-white shadow-lg transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isGenerating || isSyncing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wand2 className="h-5 w-5" />}
        {isGenerating ? "Đang tạo bản nháp..." : isSyncing ? syncMessage : "Tạo bản nháp daily brief"}
      </button>
    </form>
  );
}
