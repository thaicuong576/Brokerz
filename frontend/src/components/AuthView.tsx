"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BarChart3, Briefcase, Lock, Mail, ShieldCheck, Wallet } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export function AuthView({ onAuthSuccess }: { onAuthSuccess: (role: string) => void }) {
  const [mode, setMode] = useState<"broker" | "investor">("broker");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      onAuthSuccess(mode);
    } catch (err: any) {
      setError(err.message || "Không đăng nhập được. Vui lòng kiểm tra lại thông tin.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6">
      <motion.div
        layout
        className="z-10 grid w-full max-w-[960px] grid-cols-1 overflow-hidden rounded-lg border border-panel-border bg-panel shadow-2xl md:grid-cols-2"
      >
        <div className="flex flex-col justify-between border-b border-panel-border bg-zinc-950/40 p-8 md:border-b-0 md:border-r md:p-10">
          <div>
            <div className="mb-10 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded bg-primary">
                <BarChart3 className="h-6 w-6 text-zinc-950" />
              </div>
              <h1 className="text-2xl font-bold text-zinc-100">Brokerz</h1>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                className="space-y-4"
              >
                <h2 className="text-4xl font-bold leading-tight text-zinc-100">
                  {mode === "broker" ? (
                    <>Không gian quản lý khách hàng VIP</>
                  ) : (
                    <>Cổng theo dõi nhận định của broker</>
                  )}
                </h2>
                <p className="max-w-sm text-sm leading-6 text-zinc-400">
                  {mode === "broker"
                    ? "Tổng hợp dữ liệu thị trường, nhận định hằng ngày, danh mục khuyến nghị và hỏi đáp trong một hệ thống có kiểm soát."
                    : "Theo dõi nhận định, danh mục và cập nhật mới nhất từ broker sau khi được cấp quyền bằng SoulKey."}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-10 rounded border border-panel-border bg-zinc-900/60 p-4 text-xs leading-5 text-zinc-400">
            AI chỉ hỗ trợ soạn bản nháp. Broker luôn là người duyệt và công bố nội dung cuối cùng.
          </div>
        </div>

        <div className="p-8 md:p-10">
          <div className="mb-8 flex rounded border border-panel-border bg-zinc-950 p-1">
            <button
              onClick={() => setMode("broker")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded px-3 py-3 text-xs font-bold transition-colors",
                mode === "broker" ? "bg-primary text-zinc-950" : "text-zinc-400 hover:text-zinc-100"
              )}
            >
              <Briefcase className="h-4 w-4" />
              Broker
            </button>
            <button
              onClick={() => setMode("investor")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded px-3 py-3 text-xs font-bold transition-colors",
                mode === "investor" ? "bg-primary text-zinc-950" : "text-zinc-400 hover:text-zinc-100"
              )}
            >
              <Wallet className="h-4 w-4" />
              Nhà đầu tư
            </button>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="mb-6 flex w-full items-center justify-center gap-3 rounded border border-panel-border bg-zinc-900 px-4 py-3 text-sm font-semibold text-zinc-200 transition-colors hover:border-primary/40"
          >
            Đăng nhập bằng Google
          </button>

          <div className="mb-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-panel-border" />
            <span className="text-[10px] font-bold uppercase text-zinc-500">hoặc dùng email</span>
            <div className="h-px flex-1 bg-panel-border" />
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <label className="block space-y-2">
              <span className="ml-1 text-[10px] font-bold uppercase text-zinc-500">Email</span>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@brokerz.vn"
                  className="w-full rounded border border-panel-border bg-zinc-950 py-3 pl-11 pr-4 text-sm text-zinc-100 outline-none transition-colors focus:border-primary"
                />
              </div>
            </label>

            <label className="block space-y-2">
              <span className="ml-1 text-[10px] font-bold uppercase text-zinc-500">Mật khẩu</span>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded border border-panel-border bg-zinc-950 py-3 pl-11 pr-4 text-sm text-zinc-100 outline-none transition-colors focus:border-primary"
                />
              </div>
            </label>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 rounded border border-market-down/20 bg-market-down/10 p-3 text-xs font-bold text-market-down"
              >
                <ShieldCheck className="h-4 w-4" />
                {error}
              </motion.div>
            )}

            <button
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded bg-primary py-4 text-xs font-bold uppercase text-zinc-950 transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-950/20 border-t-zinc-950" />
              ) : (
                <>
                  Đăng nhập
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
