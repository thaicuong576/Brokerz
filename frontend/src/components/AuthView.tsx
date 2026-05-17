"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  Lock,
  Mail,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const MODE_COPY = {
  broker: {
    title: "Đăng nhập dành cho broker",
    body: "Quản lý nhận định, danh mục khuyến nghị và trao đổi với nhà đầu tư trong một không gian làm việc riêng.",
    eyebrow: "Mirae Asset Securities",
    accent: "Broker desk",
  },
  investor: {
    title: "Đăng nhập dành cho nhà đầu tư",
    body: "Theo dõi nhận định và danh mục đã được broker chia sẻ sau khi tài khoản được kết nối.",
    eyebrow: "Mirae Asset Securities",
    accent: "Investor access",
  },
};

export function AuthView({ onAuthSuccess }: { onAuthSuccess: (role: string) => void }) {
  const [mode, setMode] = useState<"broker" | "investor">("broker");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const copy = MODE_COPY[mode];

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4 sm:p-6">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="absolute inset-x-0 top-0 h-px bg-primary/50" />

      <motion.div
        layout
        className="relative z-10 grid w-full max-w-[1040px] grid-cols-1 overflow-hidden rounded-lg border border-panel-border bg-panel shadow-2xl md:grid-cols-[1.06fr_0.94fr]"
      >
        <div className="relative flex min-h-[520px] flex-col justify-between overflow-hidden border-b border-panel-border bg-zinc-950 p-7 md:border-b-0 md:border-r md:p-10">
          <motion.div
            aria-hidden
            animate={{
              borderRadius: mode === "broker" ? "36% 64% 42% 58%" : "62% 38% 58% 42%",
              x: mode === "broker" ? -18 : 24,
              y: mode === "broker" ? 8 : -12,
              rotate: mode === "broker" ? -5 : 7,
            }}
            transition={{ type: "spring", stiffness: 70, damping: 18 }}
            className="absolute right-[-120px] top-[-90px] h-72 w-72 border border-primary/20 bg-primary/10"
          />
          <motion.div
            aria-hidden
            animate={{
              borderRadius: mode === "broker" ? "18px 80px 32px 56px" : "72px 24px 64px 18px",
              x: mode === "broker" ? 12 : -16,
            }}
            transition={{ type: "spring", stiffness: 80, damping: 20 }}
            className="absolute bottom-[-70px] left-[-50px] h-48 w-64 border border-white/10 bg-white/[0.03]"
          />
          <div className="relative">
            <div className="mb-12 flex items-center gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded bg-primary">
                  <BarChart3 className="h-6 w-6 text-zinc-950" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-zinc-100">Brokerz</h1>
                  <p className="text-[11px] text-zinc-500">Mirae Asset workflow</p>
                </div>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.24 }}
                className="space-y-4"
              >
                <div className="text-[11px] font-bold uppercase text-primary">{copy.eyebrow}</div>
                <h2 className="max-w-md text-3xl font-bold leading-tight text-zinc-100 sm:text-4xl">
                  {copy.title}
                </h2>
                <p className="max-w-md text-sm leading-6 text-zinc-400">{copy.body}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          <AccessPanel mode={mode} />

          <div className="relative mt-8 rounded border border-panel-border bg-zinc-900/70 p-4 text-xs leading-5 text-zinc-400">
          </div>
        </div>

        <div className="bg-[#151515] p-7 md:p-10">
          <div className="mb-8 rounded border border-panel-border bg-zinc-950 p-1">
            <div className="relative grid grid-cols-2 gap-1">
              {(["broker", "investor"] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => setMode(item)}
                  className={cn(
                    "relative flex items-center justify-center gap-2 rounded px-3 py-3 text-xs font-bold transition-colors",
                    mode === item ? "text-zinc-950" : "text-zinc-400 hover:text-zinc-100"
                  )}
                >
                  {mode === item && (
                    <motion.span
                      layoutId="login-mode-pill"
                      className="absolute inset-0 rounded bg-primary"
                      transition={{ type: "spring", stiffness: 360, damping: 32 }}
                    />
                  )}
                  <span className="relative flex items-center gap-2">
                    {item === "broker" ? <Briefcase className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                    {item === "broker" ? "Broker" : "Nhà đầu tư"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="mb-6 flex w-full items-center justify-center gap-3 rounded border border-panel-border bg-zinc-900 px-4 py-3 text-sm font-semibold text-zinc-200 transition-colors hover:border-primary/50 hover:text-zinc-100"
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

function AccessPanel({ mode }: { mode: "broker" | "investor" }) {
  const copy = MODE_COPY[mode];

  return (
    <div className="relative mt-8">
      <motion.div
        key={mode}
        initial={{ opacity: 0.9, scale: 0.98 }}
        animate={{
          opacity: 1,
          scale: 1,
          borderRadius: mode === "broker" ? "8px 28px 8px 18px" : "28px 8px 18px 8px",
          clipPath:
            mode === "broker"
              ? "polygon(0 0, 100% 0, 100% 88%, 92% 100%, 0 100%)"
              : "polygon(0 0, 92% 0, 100% 12%, 100% 100%, 0 100%)",
        }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
        className="border border-primary/20 bg-[#171717] p-5 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="text-sm font-bold text-zinc-100">{copy.accent}</div>
          <div className="rounded border border-panel-border bg-zinc-950 px-2.5 py-1 text-[10px] font-bold text-primary">
            Secure access
          </div>
        </div>

        <div className="space-y-2">
          <div className="h-2 rounded bg-zinc-950">
            <motion.div
              animate={{ width: mode === "broker" ? "74%" : "48%" }}
              transition={{ type: "spring", stiffness: 110, damping: 20 }}
              className="h-full rounded bg-primary"
            />
          </div>
          <div className="h-2 rounded bg-zinc-950">
            <motion.div
              animate={{ width: mode === "broker" ? "42%" : "68%" }}
              transition={{ type: "spring", stiffness: 110, damping: 20 }}
              className="h-full rounded bg-zinc-600"
            />
          </div>
          <div className="h-2 rounded bg-zinc-950">
            <motion.div
              animate={{ width: mode === "broker" ? "58%" : "36%" }}
              transition={{ type: "spring", stiffness: 110, damping: 20 }}
              className="h-full rounded bg-zinc-700"
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
