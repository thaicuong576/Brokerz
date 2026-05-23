"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Key, Send, ShieldAlert, Sparkles, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { apiService } from "@/lib/api";

export function TetherGate({ onGateUnlock }: { user: any; onGateUnlock: () => void }) {
  const [inputKey, setInputKey] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLink = async () => {
    if (!inputKey) return;
    setIsLinking(true);
    setError(null);
    try {
      // Verify first (no auth required) to surface a friendly message before consuming redemption
      const check = await apiService.verifySoulKey(inputKey);
      if (!check.valid) {
        setError(check.reason || "SoulKey không hợp lệ. Vui lòng kiểm tra lại với Broker của bạn.");
        return;
      }
      const result = await apiService.redeemSoulKey(inputKey);
      if (result.status === "success") {
        onGateUnlock();
      } else {
        setError("Không thể kích hoạt SoulKey. Vui lòng thử lại.");
      }
    } catch (err) {
      console.error("Linking error:", err);
      setError("Không thể kết nối. Vui lòng thử lại sau.");
    } finally {
      setIsLinking(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center p-6 overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/10 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-primary/5 blur-[120px] rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-xl glass rounded-[48px] border border-white/5 p-12 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-12 opacity-5 text-primary">
          <Key className="w-48 h-48" />
        </div>

        <div className="relative z-10 text-center">
          <div className="w-20 h-20 bg-primary/10 rounded-[32px] flex items-center justify-center mx-auto mb-8 border border-primary/20 shadow-[0_0_30px_rgba(0,240,255,0.2)]">
            <Sparkles className="w-10 h-10 text-primary" />
          </div>

          <h2 className="text-4xl font-black tracking-tighter uppercase mb-4">Yêu cầu Kích hoạt</h2>
          <p className="text-muted-foreground font-medium mb-10 max-w-sm mx-auto">
            Chào mừng bạn đến với hệ sinh thái Brokerz. Để mở khóa dữ liệu và chiến lược đầu tư chuyên nghiệp, vui lòng nhập mã{" "}
            <span className="text-white">SoulKey</span> được cung cấp bởi Broker của bạn.
          </p>

          <div className="space-y-4">
            <div className="relative">
              <input
                type="text"
                value={inputKey}
                onChange={(e) => {
                  setInputKey(e.target.value.toUpperCase());
                  setError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleLink()}
                placeholder="BKZ-XXXX-XXXX"
                className="w-full bg-white/5 border border-white/10 rounded-3xl p-6 text-xl font-black tracking-[0.2em] text-center focus:outline-none focus:border-blue-500/50 transition-all placeholder:tracking-normal placeholder:font-bold placeholder:text-sm"
              />
              <ShieldAlert className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground opacity-50" />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-3 text-red-400 text-xs font-bold text-left flex items-center gap-2"
              >
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                {error}
              </motion.div>
            )}

            <button
              onClick={handleLink}
              disabled={isLinking || !inputKey}
              className="w-full py-6 bg-primary text-black rounded-3xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/30 hover:bg-primary/80 hover:shadow-primary/40 transition-all flex items-center justify-center gap-3 disabled:opacity-50 mt-2"
            >
              {isLinking ? "Đang xác thực..." : "Mở khóa Quyền Truy cập Chuyên gia"}
              {!isLinking && <Send className="w-4 h-4" />}
            </button>

            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 mx-auto text-[10px] text-muted-foreground uppercase font-black tracking-widest hover:text-white transition-colors pt-4"
            >
              <LogOut className="w-3 h-3" /> Về trang chủ
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
