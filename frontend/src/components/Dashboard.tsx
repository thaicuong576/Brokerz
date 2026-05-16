"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, Activity, TrendingUp, BarChart3, Users, 
  Database, Zap, X, Info, Loader2
} from "lucide-react";
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { cn } from "@/lib/utils";
import { apiService } from "@/lib/api";

const AVAILABLE_NODES = [
  { id: "vnindex", title: "VNINDEX_CORE", icon: Activity, color: "text-primary" },
  { id: "financials", title: "FINANCIAL_FLOW", icon: Zap, color: "text-amber-400" },
  { id: "breadth", title: "MARKET_BREADTH", icon: Users, color: "text-emerald-400" },
  { id: "pnl", title: "STRATEGY_PERF", icon: TrendingUp, color: "text-indigo-400" },
];

interface Widget {
  instanceId: string;
  nodeId: string;
  viewMode: "stats" | "line" | "bar";
}

export function Dashboard({ isBroker = false }: { isBroker?: boolean }) {
  const [widgets, setWidgets] = useState<Widget[]>([
    { instanceId: "init-1", nodeId: "vnindex", viewMode: "line" },
    { instanceId: "init-2", nodeId: "breadth", viewMode: "stats" }
  ]);
  const [marketSnapshot, setMarketSnapshot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchSnapshot = async () => {
    try {
      const data = await apiService.getMarketSnapshot();
      setMarketSnapshot(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Snapshot Fetch Failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Initial Fetch
    fetchSnapshot();

    // 2. Setup WebSocket for Real-time updates
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:50005/api/v1";
    const wsUrl = apiBase.replace(/^http/, "ws").replace(/\/api\/v1\/?$/, "/ws/market");
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "MARKET_SNAPSHOT") {
          console.log("WS Update Received:", message.data);
          // Merge new data into existing snapshot to maintain consistency
          setMarketSnapshot((prev: any) => ({
            ...prev,
            ...message.data,
            // Ensure vnindex update is clean
            vnindex: {
              ...(prev?.vnindex || {}),
              ...message.data.vnindex
            }
          }));
          setLastUpdated(new Date());
        }
      } catch (err) {
        console.error("WS Message Error:", err);
      }
    };

    ws.onopen = () => console.log("Intelligence Stream: CONNECTED");
    ws.onclose = () => console.log("Intelligence Stream: DISCONNECTED");

    return () => ws.close();
  }, []);

  const addWidget = (nodeId: string) => {
    const newWidget: Widget = {
      instanceId: `widget-${Math.random().toString(36).substr(2, 9)}`,
      nodeId,
      viewMode: "line"
    };
    setWidgets([...widgets, newWidget]);
  };

  const removeWidget = (id: string) => {
    setWidgets(widgets.filter(w => w.instanceId !== id));
  };

  const updateWidgetMode = (id: string, mode: "stats" | "line" | "bar") => {
    setWidgets(widgets.map(w => w.instanceId === id ? { ...w, viewMode: mode } : w));
  };

  return (
    <div className="flex flex-col gap-6 -mt-8">
      {/* Top Controls: Manual Refresh & Status */}
      <div className="flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={fetchSnapshot}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl border border-primary/20 transition-all group min-w-[140px] justify-center"
          >
            {loading && <Loader2 className="w-3 h-3 animate-spin" />}
            <span className="text-[10px] font-black uppercase tracking-widest">Làm mới dữ liệu</span>
          </button>
          {lastUpdated && (
            <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">
              Cập nhật lần cuối: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-8 min-h-[calc(100vh-220px)]">
        {/* LEFT LIBRARY */}
        {isBroker && (
          <div className="w-72 flex flex-col gap-3 shrink-0 self-start">
            <div className="px-4 py-2 mb-2 flex items-center gap-3">
              <h2 className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.3em]">Thư Viện Dữ Liệu</h2>
            </div>
            
            {AVAILABLE_NODES.map((node) => (
              <button
                key={node.id}
                onClick={() => addWidget(node.id)}
                className="w-full h-14 bg-white/[0.03] border border-white/5 hover:border-primary/40 hover:bg-primary/5 rounded-2xl px-5 flex items-center justify-between transition-all group relative overflow-hidden"
              >
                <div className="flex flex-col items-start relative z-10">
                  <span className="text-[11px] font-black tracking-tight text-white/70 group-hover:text-white uppercase transition-colors">{node.title}</span>
                  <span className="text-[7px] text-muted-foreground/50 font-bold tracking-widest uppercase">Nguồn Dữ Liệu</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* MAIN ANALYTICAL CANVAS */}
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6 pb-20">
            <AnimatePresence mode="popLayout">
              {widgets.map((widget) => (
                <DashboardWidget 
                  key={widget.instanceId} 
                  widget={widget}
                  snapshot={marketSnapshot}
                  onRemove={isBroker ? () => removeWidget(widget.instanceId) : undefined}
                  onUpdateMode={isBroker ? (mode) => updateWidgetMode(widget.instanceId, mode) : undefined}
                  isBroker={isBroker}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardWidget({ widget, snapshot, onRemove, onUpdateMode, isBroker }: { 
  widget: Widget, 
  snapshot: any,
  onRemove?: () => void, 
  onUpdateMode?: (mode: any) => void,
  isBroker: boolean
}) {
  const nodeInfo = AVAILABLE_NODES.find(n => n.id === widget.nodeId)!;
  
  // Extract specific node data from the unified snapshot
  const data = snapshot ? (
    widget.nodeId === "vnindex" ? snapshot.vnindex :
    widget.nodeId === "breadth" ? { summary: snapshot.sectors } : // Simplified mapping
    null
  ) : null;

  const loading = !snapshot;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="glass rounded-[32px] p-5 border border-white/5 flex flex-col gap-4 group min-h-[360px]"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-[11px] font-black tracking-tight uppercase text-white/90">{nodeInfo.title}</h3>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse" />
              <span className="text-[7px] text-muted-foreground font-black tracking-widest uppercase">
                {snapshot?.vnindex?.status === 'LIVE' ? 'Streaming' : 'Stationary'}
              </span>
            </div>
          </div>
        </div>

        {isBroker && onRemove && (
          <button onClick={onRemove} className="p-1.5 hover:bg-red-500/10 text-muted-foreground/20 hover:text-red-500 rounded-lg transition-all opacity-0 group-hover:opacity-100">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {isBroker && onUpdateMode && (
        <div className="flex items-center gap-0.5 p-0.5 bg-white/5 rounded-lg self-start border border-white/5">
          {["stats", "line", "bar"].map((mode) => (
            <button 
              key={mode}
              onClick={() => onUpdateMode(mode)}
              className={cn("px-2.5 py-1 rounded-md text-[7px] font-black transition-all uppercase tracking-tighter", 
              widget.viewMode === mode ? "bg-primary text-black shadow-[0_0_10px_rgba(0,240,255,0.2)]" : "text-muted-foreground hover:text-white")}
            >{mode}</button>
          ))}
        </div>
      )}

      <div className="flex-1 flex flex-col justify-center min-h-[200px] mt-2">
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-5 h-5 border-2 border-primary/10 border-t-primary rounded-full animate-spin" />
          </div>
        ) : !data ? (
          <div className="text-center opacity-20">
            <p className="text-[8px] font-black uppercase tracking-widest">No Node Data</p>
          </div>
        ) : (
          <div className="w-full h-full">
            {/* STATS MODE */}
            {widget.viewMode === "stats" && (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <div className="text-5xl font-black text-white tracking-tighter">
                  {data.price?.toLocaleString() || "---"}
                </div>
                {data.change_percent !== undefined && (
                  <div className={cn(
                    "px-2 py-0.5 rounded-full text-[8px] font-black border uppercase",
                    data.change_percent >= 0 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
                  )}>
                    {data.change_percent >= 0 ? "+" : ""}{data.change_percent.toFixed(2)}%
                  </div>
                )}
              </div>
            )}

            {/* CHART MODES */}
            {(widget.viewMode === "line" || widget.viewMode === "bar") && data.history && (
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {widget.viewMode === "line" ? (
                    <AreaChart data={data.history} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`grad-${widget.instanceId}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00F0FF" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#00F0FF" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                      <XAxis dataKey="date" hide />
                      <YAxis stroke="#ffffff15" fontSize={8} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#ffffff10', borderRadius: '8px', fontSize: '9px' }} />
                      <Area type="monotone" dataKey="value" stroke="#00F0FF" strokeWidth={2} fill={`url(#grad-${widget.instanceId})`} animationDuration={800} />
                    </AreaChart>
                  ) : (
                    <BarChart data={data.history} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                      <XAxis dataKey="date" hide />
                      <YAxis stroke="#ffffff15" fontSize={8} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#ffffff10', borderRadius: '8px', fontSize: '9px' }} />
                      <Bar dataKey="volume" fill="#00F0FF" radius={[1, 1, 0, 0]} animationDuration={800} opacity={0.6} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-white/5 flex items-center justify-between">
         <span className="text-[7px] text-muted-foreground font-bold uppercase tracking-[0.2em]">Node_Ref: {data?.status || 'OFFLINE'}</span>
      </div>
    </motion.div>
  );
}
