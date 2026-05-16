"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Key, Copy, Check, Users, ShieldAlert, Sparkles, Send, ShieldCheck, User as UserIcon, Zap, Target } from "lucide-react";
import { apiService } from "@/lib/api";
import { supabase } from "@/lib/supabase";

export function ProfileHub({ isBroker, user, profile: initialProfile }: { isBroker: boolean, user: any, profile?: any }) {
  const [profile, setProfile] = useState<any>(initialProfile || null);
  const [soulKey, setSoulKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [inputKey, setInputKey] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [linkedBroker, setLinkedBroker] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    const data = await apiService.getProfile(user.id || 'mock-id', isBroker ? 'broker' : 'investor');

    if (data) {
      setProfile(data);
      if (isBroker) {
        setSoulKey(data.soul_key || "");
      } else {
        setLinkedBroker(data.linked_broker_id || null);
      }
    }
  };

  const authorizeIdentity = async () => {
    // Backend đã tự động tạo SoulKey khi profile.role === 'BROKER'
    // nên ta chỉ cần fetch lại để lấy key đó về
    await fetchProfile();
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(soulKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLink = async () => {
    setIsLinking(true);
    try {
      const result = await apiService.linkBroker(user.id, inputKey);
      if (result.status === "success") {
        setLinkedBroker(inputKey);
        window.location.reload(); 
      } else {
        alert("Invalid SoulKey. Please verify with your Broker.");
      }
    } catch (err) {
      console.error("Linking error:", err);
      alert("Invalid SoulKey. Please verify with your Broker.");
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlink = async () => {
    try {
      await apiService.unlinkBroker(user.id);
      setLinkedBroker(null);
      window.location.reload();
    } catch (err) {
      console.error("Unlink failed:", err);
      window.location.reload();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Role Identity Card */}
      <div className="glass rounded-[32px] border border-white/5 p-8 relative overflow-hidden">
        <div className={`absolute top-0 right-0 p-8 opacity-5 ${isBroker ? 'text-primary' : 'text-blue-500'}`}>
          <UserIcon className="w-32 h-32" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-8">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border border-white/10 ${isBroker ? 'bg-primary/10 text-primary' : 'bg-blue-500/10 text-blue-400'}`}>
              <UserIcon className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tighter">
                {isBroker ? "Master Broker" : "Elite Investor"}
              </h3>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">
                {user?.email || "anonymous@brokez.com"}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
              <div className="text-[9px] text-muted-foreground uppercase font-black tracking-widest mb-1">Account Security</div>
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <ShieldCheck className="w-4 h-4" /> 2FA ENCRYPTED
              </div>
            </div>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
              <div className="text-[9px] text-muted-foreground uppercase font-black tracking-widest mb-1">Network Priority</div>
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                <Zap className="w-4 h-4" /> ULTRA-LOW LATENCY
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Connection & SoulKey Section */}
      <div className="lg:col-span-2 glass rounded-[32px] border border-white/5 p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-10">
          <Key className="w-24 h-24" />
        </div>

        <div className="relative z-10 h-full flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className={`p-2 rounded-xl ${isBroker ? 'bg-primary/20 text-primary' : 'bg-blue-500/20 text-blue-400'}`}>
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tighter">
              {isBroker ? "Định danh Chuyên gia" : "Kết nối Chiến lược"}
            </h3>
          </div>

          {isBroker ? (
            <div className="space-y-6 flex-1">
              <p className="text-sm text-muted-foreground font-medium max-w-md italic">
                Đây là chữ ký chuyên nghiệp duy nhất của bạn. Nhà đầu tư sử dụng mã này để theo dõi các chiến lược tổ chức của bạn.
              </p>

              {soulKey ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-5 text-2xl font-black tracking-[0.2em] text-primary flex items-center justify-center font-mono">
                    {soulKey}
                  </div>
                  <button 
                    onClick={copyToClipboard}
                    className="h-[68px] w-[68px] glass rounded-2xl flex items-center justify-center hover:bg-white/10 transition-all text-primary border border-primary/20"
                  >
                    {copied ? <Check className="w-6 h-6" /> : <Copy className="w-6 h-6" />}
                  </button>
                </div>
              ) : (
                <button 
                  onClick={authorizeIdentity}
                  className="w-full py-5 bg-primary text-black rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20"
                >
                  Kích hoạt Định danh Chuyên gia
                </button>
              )}

              <div className="flex items-center gap-6 pt-4 border-t border-white/5 mt-auto">
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Liên kết Active</span>
                  <span className="text-lg font-black text-white">08</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Trust Rating</span>
                  <span className="text-lg font-black text-emerald-400">99.8%</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 flex-1">
              {linkedBroker ? (
                <div className="space-y-6">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-2xl">
                    <div className="flex items-center gap-3 text-emerald-400 font-black uppercase text-xs tracking-widest mb-3">
                      <ShieldCheck className="w-5 h-5" /> Đã kết nối an toàn
                    </div>
                    <p className="text-sm text-muted-foreground font-medium mb-4">
                      Bạn đang theo dõi chiến lược của Master Broker: <span className="text-white font-black">{profile?.broker_name || "Institutional"}</span>
                    </p>
                    <div className="bg-white/5 p-4 rounded-xl font-mono text-white font-bold tracking-widest text-center border border-white/5">
                      {profile?.linked_broker_key || linkedBroker}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div className="text-[9px] text-muted-foreground uppercase font-black tracking-widest mb-1">Đồng bộ tín hiệu</div>
                      <div className="text-emerald-400 font-bold text-xs uppercase">Tức thời</div>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div className="text-[9px] text-muted-foreground uppercase font-black tracking-widest mb-1">Nguồn dữ liệu</div>
                      <div className="text-blue-400 font-bold text-xs uppercase">Tổ chức</div>
                    </div>
                  </div>

                  <button 
                    onClick={handleUnlink}
                    className="mt-4 text-[10px] text-muted-foreground uppercase font-black tracking-widest hover:text-red-500 transition-colors flex items-center gap-2"
                  >
                    <Target className="w-3 h-3" /> Ngắt kết nối chiến lược
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground font-medium italic">
                    Để truy cập dữ liệu và tín hiệu từ chuyên gia, vui lòng nhập SoulKey được cung cấp bởi Broker của bạn.
                  </p>
                  <div className="flex items-center gap-2">
                    <input 
                      type="text"
                      value={inputKey}
                      onChange={(e) => setInputKey(e.target.value.toUpperCase())}
                      placeholder="BKZ-XXXX-XXXX"
                      className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-5 text-sm font-bold tracking-widest focus:outline-none focus:border-blue-500/50"
                    />
                    <button 
                      onClick={handleLink}
                      disabled={isLinking || !inputKey}
                      className="h-[62px] w-[62px] bg-blue-600 text-white rounded-2xl flex items-center justify-center hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
