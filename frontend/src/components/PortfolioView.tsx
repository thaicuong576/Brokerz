"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { 
  TrendingUp, ArrowUpRight, ArrowDownRight, 
  Plus, Trash2, Save, RefreshCw, Search,
  PieChart as PieChartIcon, LayoutGrid, List as ListIcon,
  CloudOff, Cloud, History
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { apiService } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { RecommendationHistoryModal } from "./RecommendationHistoryModal";

interface Holding {
  symbol: string;
  buyPrice: number;
  buyDate: string;
  weight: number; 
  reason?: string;
  currentPrice?: number;
}

const COLORS = ["#00F0FF", "#00A3FF", "#0057FF", "#7000FF", "#AD00FF"];

export function PortfolioView({ isBroker = false, user = null, profile = null }: { isBroker: boolean, user: any, profile?: any }) {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [marketData, setMarketData] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [newAsset, setNewAsset] = useState({
    symbol: "",
    buyPrice: 0,
    buyDate: new Date().toISOString().split("T")[0],
    weight: 0,
    reason: ""
  });

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Recommendations State
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recTab, setRecTab] = useState<"ACTIVE" | "DRAFT" | "CLOSED">("ACTIVE");
  const [newRec, setNewRec] = useState({ symbol: "", side: "BUY", thesis: "", entry_price: 0, target_price: 0, cutloss_price: 0, risk_note: "" });
  const [editingRecId, setEditingRecId] = useState<string | null>(null);
  const [historyRecId, setHistoryRecId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // 1. Initial Load from Supabase Cloud
    const loadData = async () => {
      if (!user?.id) return;
      try {
        const fetchId = isBroker ? user.id : (profile?.linked_broker_id || user.id);
        const [stratData, recData] = await Promise.all([
          apiService.getMyStrategy(fetchId),
          apiService.getWsRecommendations()
        ]);

        if (stratData && stratData.items) {
          const mapped = stratData.items.map((it: any) => ({
            symbol: it.symbol,
            buyPrice: it.entry_price || 0,
            buyDate: "2024-01-01",
            weight: it.weight
          }));
          setHoldings(mapped);
          setIsCloudConnected(true);
        }

        if (recData) {
          setRecommendations(recData);
        }
      } catch (err) {
        console.error("Failed to load portfolio data", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();


    // 2. Establish WebSocket connection for Real-time Prices
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:50005/api/v1";
    const ws = new WebSocket(apiBase.replace(/^http/, "ws").replace(/\/api\/v1\/?$/, "/ws/market"));
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if ((data.type === 'MARKET_SNAPSHOT' || data.type === 'market_snapshot') && data.stocks) {
        setMarketData(data.stocks);
      }
    };

    fetchData(); 

    const timer = setTimeout(() => setIsMounted(true), 200);
    return () => {
      ws.close();
      clearTimeout(timer);
    };
  }, [user?.id]);

  const syncToCloud = async (newHoldings: Holding[]) => {
    if (!user?.id || !isBroker) return;
    try {
      await apiService.syncStrategy(user.id, {
        name: "My Master Strategy",
        description: "Live strategy managed by Broker",
        items: newHoldings.map(h => ({
          symbol: h.symbol,
          weight: h.weight,
          entry_price: h.buyPrice
        }))
      });
      setIsCloudConnected(true);
    } catch (err) {
      console.error("Cloud sync failed", err);
      setIsCloudConnected(false);
    }
  };

  const fetchData = async () => {
    try {
      const response = await apiService.getLatestStocks();
      if (response && Array.isArray(response)) {
        setMarketData(response);
      }
    } catch (err) {
      console.warn("Manual fetch failed", err);
    }
  };

  const handleTickerChange = async (val: string) => {
    const symbol = val.toUpperCase();
    setNewAsset({...newAsset, symbol});
    
    if (symbol.length >= 1) {
      setIsSearching(true);
      try {
        const results = await apiService.searchStocks(symbol);
        setSuggestions(results);
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSuggestions([]);
    }
  };

  const selectTicker = async (symbol: string) => {
    setNewAsset(prev => ({ ...prev, symbol }));
    setSuggestions([]);
    
    try {
      const data = await apiService.getStockPrice(symbol);
      if (data && data.price) {
        setNewAsset(prev => ({ ...prev, buyPrice: data.price }));
        
        // Cập nhật marketData ngay lập tức để currentPrice hiển thị đúng
        setMarketData(prev => {
            const exists = prev.find(m => m.symbol === symbol);
            if (exists) return prev.map(m => m.symbol === symbol ? {...m, price: data.price} : m);
            return [...prev, { symbol, price: data.price, ref_price: data.ref_price }];
        });
      }
    } catch (err) {
      console.warn("Price fetch failed", err);
    }
  };

  const addAsset = () => {
    if (!newAsset.symbol || !newAsset.buyPrice || !newAsset.weight) {
      alert("Vui lòng điền đầy đủ: Mã CP, Giá mua và Tỷ trọng!");
      return;
    }
    const updated = [...holdings, { ...newAsset }];
    setHoldings(updated);
    syncToCloud(updated); // Sync to Supabase
    setNewAsset({ 
      symbol: "", 
      buyPrice: 0, 
      buyDate: new Date().toISOString().split("T")[0], 
      weight: 0,
      reason: ""
    });
    setIsAdding(false);
  };

  const updateAsset = (index: number, field: keyof Holding, value: any) => {
    const updated = [...holdings];
    updated[index] = { ...updated[index], [field]: value };
    setHoldings(updated);
    syncToCloud(updated);
  };

  const removeAsset = (symbol: string) => {
    const updated = holdings.filter(h => h.symbol !== symbol);
    setHoldings(updated);
    syncToCloud(updated); // Sync to Supabase
  };

  const submitRecommendation = async () => {
    if (!newRec.symbol || !user?.id) return;
    try {
      if (editingRecId) {
        const updated = await apiService.updateRecommendationThesis(editingRecId, {
          thesis: newRec.thesis,
          target_price: newRec.target_price || undefined,
          cutloss_price: newRec.cutloss_price || undefined,
          risk_note: newRec.risk_note || undefined,
        });
        setRecommendations(prev => prev.map(r => r.id === editingRecId ? updated : r));
        setEditingRecId(null);
      } else {
        const res = await apiService.createWsRecommendation({
          symbol: newRec.symbol,
          side: newRec.side,
          thesis: newRec.thesis,
          entry_price: newRec.entry_price || undefined,
          target_price: newRec.target_price || undefined,
          cutloss_price: newRec.cutloss_price || undefined,
          risk_note: newRec.risk_note || undefined,
        });
        setRecommendations([res, ...recommendations]);
      }
      setNewRec({ symbol: "", side: "BUY", thesis: "", entry_price: 0, target_price: 0, cutloss_price: 0, risk_note: "" });
    } catch (err) {
      console.error("Failed to submit recommendation", err);
    }
  };

  const publishRecommendation = async (id: string) => {
    try {
      const updated = await apiService.publishRecommendation(id);
      setRecommendations(prev => prev.map(r => r.id === id ? updated : r));
    } catch (err) {
      console.error("Failed to publish", err);
    }
  };

  const closeRecommendation = async (id: string) => {
    const reason = prompt("Lý do đóng khuyến nghị? (VD: Chạm target, Cắt lỗ...)");
    if (!reason) return;
    try {
      const updated = await apiService.closeRecommendation(id, reason);
      setRecommendations(prev => prev.map(r => r.id === id ? updated : r));
    } catch (err) {
      console.error("Failed to close", err);
    }
  };

  const startEditRec = (r: any) => {
    setEditingRecId(r.id);
    setNewRec({ 
      symbol: r.symbol, 
      side: r.side || "BUY", 
      thesis: r.thesis || "", 
      entry_price: r.entry_price || 0,
      target_price: r.target_price || 0,
      cutloss_price: r.cutloss_price || 0,
      risk_note: r.risk_note || ""
    });
    // Scroll to form
    const form = document.getElementById("rec-form");
    form?.scrollIntoView({ behavior: "smooth" });
  };


  const enrichedHoldings = holdings.map(h => {
    const current = marketData.find(m => m.symbol === h.symbol);
    const currentPrice = current?.price || current?.ref_price || h.buyPrice;
    const pnl = ((currentPrice - h.buyPrice) / h.buyPrice) * 100;
    return { ...h, currentPrice, pnl };
  });

  const totalWeight = holdings.reduce((acc, curr) => acc + curr.weight, 0);
  const avgPnl = enrichedHoldings.length > 0 
    ? enrichedHoldings.reduce((acc, curr) => acc + (curr.pnl * (curr.weight / (totalWeight || 1))), 0)
    : 0;

  const pieData = holdings.map(h => ({ name: h.symbol, value: h.weight }));

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 pb-20">
        {/* Left Column: Portfolio & Ledger (60%) */}
        <div className="lg:col-span-7 2xl:col-span-8 space-y-6 lg:space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass p-6 rounded-3xl relative overflow-hidden group">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Hiệu suất Danh mục</p>
                  <p className={cn("text-3xl font-black italic tracking-tighter", avgPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {avgPnl >= 0 ? "+" : ""}{avgPnl.toFixed(2)}%
                  </p>
                </div>
                <div className={cn("p-3 rounded-2xl bg-white/5", avgPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mb-6">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, Math.max(0, 50 + (avgPnl * 5)))}%` }}
                  className={cn("h-full", avgPnl >= 0 ? "bg-emerald-500 shadow-[0_0_10px_#10b981]" : "bg-red-500 shadow-[0_0_10px_#ef4444]")}
                />
              </div>

              <div className="pt-4 border-t border-white/5 space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Tăng trưởng tốt nhất</p>
                  {(() => {
                    const best = [...enrichedHoldings].sort((a, b) => b.pnl - a.pnl)[0];
                    return best ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white">{best.symbol}</span>
                        <span className="text-[10px] font-bold text-emerald-400">+{best.pnl.toFixed(1)}%</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-white/20 italic">---</span>
                    );
                  })()}
                </div>

                <div className="flex justify-between items-center">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Tăng trưởng kém nhất</p>
                  {(() => {
                    const worst = [...enrichedHoldings].sort((a, b) => a.pnl - b.pnl)[0];
                    return worst ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white">{worst.symbol}</span>
                        <span className="text-[10px] font-bold text-red-400">{worst.pnl.toFixed(1)}%</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-white/20 italic">---</span>
                    );
                  })()}
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: 0.1 }} 
              className="md:col-span-2 glass p-6 rounded-3xl flex flex-col md:flex-row items-center gap-8"
            >
              <div className="flex-1 w-full h-[220px] relative">
                {isMounted && (
                  <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100} debounce={50}>
                    <PieChart>
                      <Pie 
                        data={(() => {
                          const data = holdings.map(h => ({ name: h.symbol, value: h.weight }));
                          if (totalWeight < 100) {
                            data.push({ name: "TIỀN MẶT", value: 100 - totalWeight });
                          }
                          return data;
                        })()} 
                        innerRadius={55} 
                        outerRadius={90} 
                        paddingAngle={5} 
                        dataKey="value"
                        labelLine={false}
                        label={({ cx, cy, midAngle, innerRadius, outerRadius, value, name }) => {
                          const RADIAN = Math.PI / 180;
                          const safeCx = Number(cx || 0);
                          const safeCy = Number(cy || 0);
                          const safeInner = Number(innerRadius || 0);
                          const safeOuter = Number(outerRadius || 0);
                          const safeAngle = Number(midAngle || 0);
                          const radius = safeInner + (safeOuter - safeInner) * 0.5;
                          const x = safeCx + radius * Math.cos(-safeAngle * RADIAN);
                          const y = safeCy + radius * Math.sin(-safeAngle * RADIAN);
                          
                          // Scale font size based on value (percentage)
                          const fontSize = Math.max(8, Math.min(14, value * 0.3));
                          
                          return (
                            <text 
                              x={x} 
                              y={y} 
                              fill="white" 
                              textAnchor="middle" 
                              dominantBaseline="central"
                              className="font-black"
                              style={{ fontSize: `${fontSize}px` }}
                            >
                              {name}
                            </text>
                          );
                        }}
                      >
                        {holdings.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                        {totalWeight < 100 && <Cell key="cell-cash" fill="#334155" />}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}
                        itemStyle={{ color: '#fff' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Phân bổ</p>
                  <p className="text-2xl font-black">{totalWeight}%</p>
                </div>
              </div>
              
              <div className="flex flex-col justify-center items-center md:items-start gap-4">
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Trạng thái Danh mục</p>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold">{holdings.length} Tài sản</p>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-black tracking-tighter uppercase",
                      totalWeight > 100 ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"
                    )}>
                      {totalWeight > 100 ? "⚠️ Over" : totalWeight < 100 ? "Dư Cash" : "Tối ưu"}
                    </span>
                  </div>
                </div>

                {isBroker && (
                  <button 
                    onClick={() => setIsAdding(true)}
                    className="flex items-center gap-2 text-xs bg-primary text-black px-6 py-3 rounded-2xl font-black hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all active:scale-95"
                  >
                    <Plus className="w-4 h-4" /> THÊM TÀI SẢN MỚI
                  </button>
                )}
              </div>
            </motion.div>
          </div>

          <AnimatePresence>
            {isAdding && (
              <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsAdding(false)}
                  className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                />
                
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="relative w-full max-w-xl glass p-8 md:p-10 rounded-[40px] space-y-10 border border-primary/30 shadow-[0_0_50px_rgba(0,240,255,0.15)]"
                >
                  <button 
                    onClick={() => setIsAdding(false)}
                    className="absolute top-8 right-8 p-3 rounded-2xl hover:bg-white/10 text-muted-foreground hover:text-white transition-all group"
                  >
                    <Plus className="w-6 h-6 rotate-45 group-hover:scale-110 transition-transform" />
                  </button>

                  <div className="flex items-center gap-5">
                    <div className="p-4 rounded-[20px] bg-primary/10 border border-primary/20 shadow-[0_0_20px_rgba(0,240,255,0.1)]">
                      <Plus className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-black text-2xl uppercase tracking-tighter">Thêm vào Danh mục</h3>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-black opacity-60">Xây dựng chiến lược Master</p>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="space-y-4 relative">
                      <label className="text-[10px] text-muted-foreground uppercase font-black tracking-widest ml-1 opacity-50">Mã Chứng khoán</label>
                      <div className="relative">
                        <input 
                          type="text"
                          placeholder="VD: FPT"
                          className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-sm focus:outline-none focus:border-primary/50 transition-all pl-16 font-black uppercase placeholder:text-white/10"
                          value={newAsset.symbol}
                          onChange={(e) => handleTickerChange(e.target.value)}
                        />
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground/40" />
                        
                        <AnimatePresence>
                          {suggestions.length > 0 && (
                            <motion.div 
                              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                              className="absolute top-full left-0 right-0 mt-4 glass border border-white/10 rounded-[24px] overflow-hidden z-[210] shadow-[0_20px_50px_rgba(0,0,0,0.5)] max-h-56 overflow-y-auto"
                            >
                              {suggestions.map((s) => (
                                <button
                                  key={s}
                                  onClick={() => selectTicker(s)}
                                  className="w-full px-8 py-5 text-left hover:bg-primary hover:text-black transition-all font-black text-xs flex items-center justify-between group"
                                >
                                  <span>{s}</span>
                                  <Plus className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <label className="text-[10px] text-muted-foreground uppercase font-black tracking-widest ml-1 opacity-50">Giá Mua</label>
                        <input 
                          type="number"
                          className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-sm focus:outline-none focus:border-primary/50 transition-all font-black"
                          value={newAsset.buyPrice || ""}
                          onChange={(e) => setNewAsset({...newAsset, buyPrice: Number(e.target.value)})}
                        />
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] text-muted-foreground uppercase font-black tracking-widest ml-1 opacity-50">Tỷ trọng (%)</label>
                        <input 
                          type="number"
                          className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-sm focus:outline-none focus:border-primary/50 transition-all font-black"
                          value={newAsset.weight || ""}
                          onChange={(e) => setNewAsset({...newAsset, weight: Number(e.target.value)})}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] text-muted-foreground uppercase font-black tracking-widest ml-1 opacity-50">Lý do / Nhận định</label>
                      <textarea 
                        placeholder="Tại sao chọn mã này? (VD: Hưởng lợi từ đầu tư công...)"
                        rows={3}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-sm focus:outline-none focus:border-primary/50 transition-all font-medium resize-none placeholder:text-white/10"
                        value={newAsset.reason}
                        onChange={(e) => setNewAsset({...newAsset, reason: e.target.value})}
                      ></textarea>
                    </div>

                    <button 
                      onClick={addAsset}
                      className="w-full bg-primary text-black font-black py-6 rounded-2xl shadow-2xl shadow-primary/20 hover:shadow-primary/40 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-[0.2em] text-xs"
                    >
                      Xác nhận Thêm vào Danh mục
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <div className="glass rounded-3xl overflow-hidden flex flex-col">
            <div className="p-4 md:p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="font-bold text-lg text-primary tracking-tighter uppercase italic">
                {isBroker ? "Danh mục hiện tại" : "Danh mục Broker đề xuất"}
              </h3>
              {isBroker && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setIsAdding(true)}
                    className="flex-1 sm:flex-none bg-primary/10 border border-primary/20 text-primary px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-primary hover:text-black transition-all"
                  >
                    Thêm tài sản
                  </button>
                </div>
              )}
            </div>

            <div className="overflow-x-auto overflow-y-hidden custom-scrollbar">
              <div className="min-w-[600px]">
                <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                    <th className="px-6 py-5">Tài sản</th>
                    <th className="px-6 py-5">Giá mua</th>
                    <th className="px-6 py-5">Giá hiện tại</th>
                    <th className="px-6 py-5">Tỷ trọng</th>
                    <th className="px-6 py-5">Lợi nhuận</th>
                    <th className="px-6 py-5">Nhận định</th>
                    {isBroker && <th className="px-6 py-5">Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {enrichedHoldings.map((h, i) => (
                      <motion.tr 
                        key={h.symbol}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ delay: i * 0.05 }}
                        className="group border-b border-white/5 hover:bg-white/[0.02] transition-all"
                      >
                        <td className="px-6 py-3">
                          <p className="text-sm font-black text-white">{h.symbol}</p>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            {isBroker ? (
                              <input 
                                type="number"
                                className="w-24 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-primary/50 transition-all font-bold"
                                value={h.buyPrice}
                                onChange={(e) => updateAsset(i, "buyPrice", Number(e.target.value))}
                              />
                            ) : (
                              <span className="text-xs font-bold text-white/60 tabular-nums">
                                {h.buyPrice.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-sm font-black text-white tabular-nums">
                              {h.currentPrice?.toLocaleString()}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-sm font-bold text-muted-foreground">
                          <div className="flex items-center gap-2">
                            {isBroker ? (
                              <input 
                                type="number"
                                className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-primary/50 transition-all font-bold"
                                value={h.weight}
                                onChange={(e) => updateAsset(i, "weight", Number(e.target.value))}
                              />
                            ) : (
                              <span className="text-xs font-bold text-white/60 tabular-nums">
                                {h.weight}
                              </span>
                            )}
                            <span className="text-[10px] font-black opacity-40">%</span>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <div className={`flex items-center gap-1.5 font-black text-xs ${h.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {h.pnl >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {h.pnl >= 0 ? "+" : ""}{h.pnl.toFixed(2)}%
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          {isBroker ? (
                            <input 
                              type="text"
                              placeholder="Ghi chú chiến thuật..."
                              className="w-full min-w-[150px] bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] focus:outline-none focus:border-primary/50 transition-all font-medium italic"
                              value={h.reason || ""}
                              onChange={(e) => updateAsset(i, "reason", e.target.value)}
                            />
                          ) : (
                            <p className="text-[10px] text-muted-foreground font-medium italic">
                              {h.reason || "Không có nhận định"}
                            </p>
                          )}
                        </td>
                        {isBroker && (
                          <td className="px-6 py-3">
                            <button 
                              onClick={() => removeAsset(h.symbol)}
                              className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/10 hover:text-red-500 rounded-xl transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
              </div>
            </div>
          </div>
        </div>


        {/* Right Column: Recommendations & Tools (40%) */}
        <div className="lg:col-span-5 2xl:col-span-4 space-y-6 lg:space-y-8">
          <div className="glass rounded-3xl overflow-hidden flex flex-col min-h-[500px]">
            <div className="p-6 border-b border-white/5">
              <h3 className="font-bold text-lg text-primary tracking-tighter">KHUYẾN NGHỊ HÔM NAY</h3>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>

            {/* Rec Tabs */}
            <div className="flex p-2 gap-2 bg-white/5 border-b border-white/5 overflow-x-auto no-scrollbar">
              <button 
                onClick={() => setRecTab("ACTIVE")}
                className={`flex-1 min-w-[80px] py-2.5 rounded-xl font-black text-[10px] transition-all ${recTab === "ACTIVE" ? "bg-primary text-black shadow-[0_0_15px_rgba(0,240,255,0.3)]" : "text-muted-foreground hover:bg-white/5"}`}
              >
                ĐANG MỞ
              </button>
              {isBroker && (
                <button 
                  onClick={() => setRecTab("DRAFT")}
                  className={`flex-1 min-w-[80px] py-2.5 rounded-xl font-black text-[10px] transition-all ${recTab === "DRAFT" ? "bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.3)]" : "text-muted-foreground hover:bg-white/5"}`}
                >
                  BẢN NHÁP
                </button>
              )}
              <button 
                onClick={() => setRecTab("CLOSED")}
                className={`flex-1 min-w-[80px] py-2.5 rounded-xl font-black text-[10px] transition-all ${recTab === "CLOSED" ? "bg-white/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]" : "text-muted-foreground hover:bg-white/5"}`}
              >
                LỊCH SỬ
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <AnimatePresence mode="popLayout">
                {recommendations.filter(r => r.status === recTab).length > 0 ? (
                  recommendations.filter(r => r.status === recTab).map((r, i) => (
                    <motion.div 
                      key={r.id || i}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="p-5 rounded-2xl bg-white/5 border border-white/5 relative overflow-hidden group"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center font-black border",
                            r.side === "BUY" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
                          )}>
                            {r.symbol}
                          </div>
                          <div>
                            <p className="text-xs font-black text-muted-foreground">
                              {r.side === "BUY" ? "MUA" : "BÁN"} {r.entry_price ? `@${r.entry_price.toLocaleString()}` : ""}
                            </p>
                            <div className="flex gap-2 text-[10px] font-bold mt-1">
                              {r.target_price && <span className="text-emerald-400">TG: {r.target_price.toLocaleString()}</span>}
                              {r.cutloss_price && <span className="text-red-400">CL: {r.cutloss_price.toLocaleString()}</span>}
                            </div>
                          </div>
                        </div>
                        {isBroker && (
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button 
                              onClick={() => setHistoryRecId(r.id)}
                              className="p-2 bg-white/5 hover:bg-white/20 hover:text-white rounded-xl transition-all text-muted-foreground"
                              title="View History"
                            >
                              <History className="w-4 h-4" />
                            </button>
                            {r.status === "DRAFT" && (
                              <button 
                                onClick={() => publishRecommendation(r.id)}
                                className="p-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-black rounded-xl transition-all"
                                title="Publish"
                              >
                                <ArrowUpRight className="w-4 h-4" />
                              </button>
                            )}
                            {(r.status === "DRAFT" || r.status === "ACTIVE") && (
                              <>
                                <button 
                                  onClick={() => startEditRec(r)}
                                  className="p-2 bg-white/5 hover:bg-primary hover:text-black rounded-xl transition-all"
                                  title="Edit Thesis"
                                >
                                  <Save className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => closeRecommendation(r.id)}
                                  className="p-2 bg-white/5 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                                  title="Close Recommendation"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="p-4 rounded-xl bg-black/40 border border-white/5 text-[11px] leading-relaxed text-muted-foreground font-medium relative group-hover:border-primary/20 transition-all space-y-2">
                        <p className="italic">" {r.thesis} "</p>
                        {r.risk_note && (
                          <p className="text-red-400/80 text-[10px] border-t border-white/5 pt-2 mt-2">
                            ⚠️ {r.risk_note}
                          </p>
                        )}
                        {r.status === "CLOSED" && r.closed_reason && (
                          <p className="text-yellow-400/80 text-[10px] border-t border-white/5 pt-2 mt-2 font-bold">
                            Đã đóng: {r.closed_reason}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="h-40 flex items-center justify-center text-muted-foreground text-[10px] font-bold uppercase tracking-widest opacity-50 italic">
                    Chưa có khuyến nghị nào
                  </div>
                )}
              </AnimatePresence>
            </div>

            {/* Add Recommendation Form (Broker Only) */}
            {isBroker && (
              <div id="rec-form" className="p-6 border-t border-white/5 bg-black/20">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">
                    {editingRecId ? "Cập Nhật Khuyến Nghị" : "Tạo Khuyến Nghị Mới (Nháp)"}
                  </h4>
                  {editingRecId && (
                    <button 
                      onClick={() => {
                        setEditingRecId(null);
                        setNewRec({ symbol: "", side: "BUY", thesis: "", entry_price: 0, target_price: 0, cutloss_price: 0, risk_note: "" });
                      }}
                      className="text-[9px] text-red-400 font-bold hover:underline"
                    >
                      HỦY BỎ
                    </button>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <input 
                      type="text"
                      placeholder="Mã CP (VD: SSI)"
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs focus:outline-none focus:border-primary/50 transition-all font-bold uppercase"
                      value={newRec.symbol}
                      onChange={(e) => setNewRec({...newRec, symbol: e.target.value.toUpperCase()})}
                      disabled={!!editingRecId}
                    />
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setNewRec({...newRec, side: "BUY"})}
                        disabled={!!editingRecId}
                        className={`flex-1 py-2 rounded-lg text-[9px] font-black border transition-all ${newRec.side === "BUY" ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" : "border-white/5 text-muted-foreground disabled:opacity-50"}`}
                      >
                        MUA
                      </button>
                      <button 
                        onClick={() => setNewRec({...newRec, side: "SELL"})}
                        disabled={!!editingRecId}
                        className={`flex-1 py-2 rounded-lg text-[9px] font-black border transition-all ${newRec.side === "SELL" ? "bg-red-500/10 border-red-500 text-red-400" : "border-white/5 text-muted-foreground disabled:opacity-50"}`}
                      >
                        BÁN
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input 
                      type="number"
                      placeholder="Giá vào"
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs focus:outline-none focus:border-primary/50 transition-all"
                      value={newRec.entry_price || ""}
                      onChange={(e) => setNewRec({...newRec, entry_price: Number(e.target.value)})}
                    />
                    <input 
                      type="number"
                      placeholder="Target"
                      className="w-full bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 text-xs focus:outline-none focus:border-emerald-500 transition-all"
                      value={newRec.target_price || ""}
                      onChange={(e) => setNewRec({...newRec, target_price: Number(e.target.value)})}
                    />
                    <input 
                      type="number"
                      placeholder="Cutloss"
                      className="w-full bg-red-500/5 border border-red-500/20 rounded-xl p-3 text-xs focus:outline-none focus:border-red-500 transition-all"
                      value={newRec.cutloss_price || ""}
                      onChange={(e) => setNewRec({...newRec, cutloss_price: Number(e.target.value)})}
                    />
                  </div>
                  <textarea 
                    placeholder="Luận điểm đầu tư (Thesis)..."
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs focus:outline-none focus:border-primary/50 transition-all font-medium resize-none"
                    value={newRec.thesis}
                    onChange={(e) => setNewRec({...newRec, thesis: e.target.value})}
                  ></textarea>
                  <textarea 
                    placeholder="Rủi ro / Lưu ý (Risk note)..."
                    rows={1}
                    className="w-full bg-red-500/5 border border-red-500/20 rounded-xl p-3 text-xs focus:outline-none focus:border-red-500/50 transition-all font-medium resize-none text-red-400 placeholder:text-red-400/50"
                    value={newRec.risk_note}
                    onChange={(e) => setNewRec({...newRec, risk_note: e.target.value})}
                  ></textarea>
                  <button 
                    onClick={submitRecommendation}
                    className={cn(
                      "w-full font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all",
                      editingRecId ? "bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)]" : "bg-primary text-black hover:shadow-[0_0_20px_rgba(0,240,255,0.3)]"
                    )}
                  >
                    {editingRecId ? "Lưu Thay Đổi" : "Tạo Bản Nháp (Draft)"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <RecommendationHistoryModal 
        isOpen={!!historyRecId} 
        onClose={() => setHistoryRecId(null)} 
        recId={historyRecId} 
      />
    </>
  );
}
