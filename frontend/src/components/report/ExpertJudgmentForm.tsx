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

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit(formData);
  };

  const handleLiquidityChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    if (value === "Tùy chỉnh...") {
      setIsCustomLiquidity(true);
      setFormData({ ...formData, liquidity_comment: "" });
      return;
    }
    setIsCustomLiquidity(false);
    setFormData({ ...formData, liquidity_comment: value });
  };

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col gap-4 rounded border border-panel-border bg-panel p-3">
      <div>
        <h3 className="text-sm font-bold text-zinc-100">Điều chỉnh của broker</h3>
        <p className="mt-1 text-[11px] text-zinc-500">Bổ sung góc nhìn thủ công trước khi AI soạn bản nháp.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="P/E VN-Index">
          <input
            type="number"
            step="0.1"
            value={formData.pe_ratio}
            onChange={(event) => setFormData({ ...formData, pe_ratio: parseFloat(event.target.value) || 0 })}
            className="terminal-input"
          />
        </Field>

        <Field label="Điểm kỹ thuật (-7 đến +7)">
          <input
            type="number"
            min="-7"
            max="7"
            value={formData.technical_score}
            onChange={(event) => {
              const score = parseInt(event.target.value, 10) || 0;
              let rating = "Trung tính";
              if (score >= 4) rating = "Tích cực";
              else if (score <= -4) rating = "Tiêu cực";
              setFormData({ ...formData, technical_score: score, technical_rating: rating });
            }}
            className="terminal-input"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Trạng thái kỹ thuật">
          <select
            value={formData.technical_rating}
            onChange={(event) => setFormData({ ...formData, technical_rating: event.target.value })}
            className="terminal-input"
          >
            <option>Tiêu cực</option>
            <option>Trung tính</option>
            <option>Tích cực</option>
          </select>
        </Field>

        <Field label="Nhận xét thanh khoản">
          {!isCustomLiquidity ? (
            <select value={formData.liquidity_comment} onChange={handleLiquidityChange} className="terminal-input">
              {LIQUIDITY_OPTIONS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          ) : (
            <div className="flex overflow-hidden rounded border border-panel-border bg-background focus-within:border-primary">
              <input
                type="text"
                autoFocus
                placeholder="Nhập nhận xét thanh khoản..."
                value={formData.liquidity_comment}
                onChange={(event) => setFormData({ ...formData, liquidity_comment: event.target.value })}
                className="w-full bg-transparent p-2 text-xs text-zinc-200 outline-none"
              />
              <button
                type="button"
                onClick={() => setIsCustomLiquidity(false)}
                className="bg-muted px-2 text-[10px] font-bold text-zinc-400 hover:text-zinc-100"
              >
                Hủy
              </button>
            </div>
          )}
        </Field>
      </div>

      <Field label="Nhận xét của broker">
        <textarea
          rows={4}
          value={formData.expert_comment}
          onChange={(event) => setFormData({ ...formData, expert_comment: event.target.value })}
          className="terminal-input resize-none leading-5"
        />
      </Field>

      <button
        type="submit"
        disabled={isGenerating || isSyncing}
        className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded bg-primary px-4 py-3 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isGenerating || isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
        {isGenerating ? "Đang tạo bản nháp..." : isSyncing ? syncMessage : "Tạo bản nháp nhận định"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-bold text-zinc-400">
      {label}
      {children}
    </label>
  );
}
