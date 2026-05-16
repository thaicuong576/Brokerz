"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  TrendingUp, ArrowUpRight, 
  Plus, Layout, Target,
  ChevronRight, Users, 
  Briefcase, Edit3, Trash2
} from "lucide-react";
import { apiService } from "@/lib/api";
import { cn } from "@/lib/utils";

interface PortfolioItem {
  symbol: string;
  weight: number;
  entry_price?: number;
}

interface Portfolio {
  id: string;
  name: string;
  description: string;
  created_by: string;
  created_at: string;
  items: PortfolioItem[];
}

export function SamplePortfolios({ isBroker = false }: { isBroker: boolean }) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetchSamples();
  }, []);

  const fetchSamples = async () => {
    try {
      const data = await apiService.getSamplePortfolios();
      setPortfolios(data);
    } catch (err) {
      console.error("Failed to fetch portfolios:", err);
    } finally {
      setLoading(false);
    }
  };

  const selectedPortfolio = portfolios.find(p => p.id === selectedId);

  return (
    <div className="space-y-8 pb-20">
      {/* Header with Action */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-black text-primary uppercase tracking-[0.3em] mb-1">Chiến Lược Chuyên Gia</h2>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
            {isBroker ? "Quản lý các danh mục mẫu cho khách hàng" : "Sao chép các chiến thuật từ Master Broker"}
          </p>
        </div>
        
        {isBroker && (
          <button className="flex items-center gap-2 bg-primary text-black px-5 py-2.5 rounded-2xl font-black text-[10px] hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all uppercase tracking-widest">
            <Plus className="w-4 h-4" /> Tạo Chiến Thuật
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LIST SECTION */}
        <div className="lg:col-span-5 space-y-4">
          <AnimatePresence mode="popLayout">
            {loading ? (
              [1, 2].map(i => (
                <div key={i} className="h-32 glass animate-pulse rounded-3xl w-full" />
              ))
            ) : (
              portfolios.map((p) => (
                <motion.div
                  key={p.id}
                  layout
                  onClick={() => setSelectedId(p.id)}
                  className={cn(
                    "p-6 glass rounded-3xl border cursor-pointer transition-all group relative overflow-hidden",
                    selectedId === p.id ? "border-primary/40 bg-primary/5" : "border-white/5 hover:border-white/20"
                  )}
                >
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center border border-white/5 transition-all",
                        selectedId === p.id ? "bg-primary text-black" : "bg-white/5 text-primary"
                      )}>
                        <Briefcase className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-black text-sm tracking-tight uppercase">{p.name}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[8px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                            <Users className="w-2.5 h-2.5" /> 128 Follows
                          </span>
                          <span className="text-[8px] font-bold text-emerald-400 uppercase flex items-center gap-1">
                            <TrendingUp className="w-2.5 h-2.5" /> +12.5% YTD
                          </span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className={cn("w-5 h-5 text-muted-foreground transition-transform", selectedId === p.id && "rotate-90 text-primary")} />
                  </div>
                  
                  {/* Subtle Background Accent */}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 blur-3xl -z-10 group-hover:bg-primary/10 transition-all" />
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* DETAILS SECTION */}
        <div className="lg:col-span-7">
          <AnimatePresence mode="wait">
            {selectedPortfolio ? (
              <motion.div
                key={selectedPortfolio.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="glass rounded-[40px] p-8 border border-white/5 min-h-[500px] flex flex-col"
              >
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
                      <Target className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black tracking-tighter uppercase">{selectedPortfolio.name}</h2>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{selectedPortfolio.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isBroker ? (
                      <>
                        <button className="p-3 glass rounded-xl text-muted-foreground hover:text-primary transition-all">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button className="p-3 glass rounded-xl text-muted-foreground hover:text-red-500 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <div className="text-[9px] font-black text-primary/40 uppercase tracking-widest px-4 py-2 border border-primary/10 rounded-xl">
                        View Only
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-hidden">
                  <div className="grid grid-cols-5 text-[9px] font-black text-muted-foreground uppercase tracking-widest px-4 py-3 border-b border-white/5">
                    <div className="col-span-2">Cổ Phiếu</div>
                    <div className="text-center">Tỷ Trọng</div>
                    <div className="text-center">Giá Entry</div>
                    <div className="text-right">Biến Động</div>
                  </div>
                  
                  <div className="divide-y divide-white/5">
                    {selectedPortfolio.items.map((item) => (
                      <div key={item.symbol} className="grid grid-cols-5 items-center px-4 py-5 group hover:bg-white/[0.01] transition-all">
                        <div className="col-span-2 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center font-black text-[10px] text-primary">
                            {item.symbol[0]}
                          </div>
                          <div>
                            <div className="font-black text-sm">{item.symbol}</div>
                            <div className="text-[8px] text-muted-foreground font-bold uppercase">Bluechip_VN30</div>
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs font-black">{item.weight}%</div>
                          <div className="w-12 h-1 bg-white/5 rounded-full mx-auto mt-1 overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${item.weight}%` }} />
                          </div>
                        </div>
                        <div className="text-center font-bold text-xs">
                          {item.entry_price?.toLocaleString() || "---"}
                        </div>
                        <div className="text-right text-emerald-400 font-black text-xs">
                          <div className="flex items-center justify-end gap-1">
                            <ArrowUpRight className="w-3 h-3" /> 2.4%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div>
                      <span className="text-[8px] text-muted-foreground font-bold uppercase block mb-1">Rủi Ro</span>
                      <span className="text-xs font-black text-amber-400">TRUNG BÌNH</span>
                    </div>
                    <div>
                      <span className="text-[8px] text-muted-foreground font-bold uppercase block mb-1">Lợi Nhuận Kì Vọng</span>
                      <span className="text-xs font-black text-primary">15-20% / Năm</span>
                    </div>
                  </div>
                  <span className="text-[8px] text-muted-foreground font-bold italic">Cập nhật 2 giờ trước bởi Master Broker Eddie</span>
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center glass rounded-[40px] border border-white/5 opacity-40">
                <Layout className="w-16 h-16 mb-4 text-muted-foreground" />
                <p className="font-black text-[10px] uppercase tracking-[0.3em]">Chọn một chiến lược để xem chi tiết</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
