"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, Edit, FileText, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { apiService, RecommendationEventResponse, WsRecommendationResponse } from "@/lib/api";

interface RecommendationHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  recId: string | null;
}

export function RecommendationHistoryModal({ isOpen, onClose, recId }: RecommendationHistoryModalProps) {
  const [history, setHistory] = useState<RecommendationEventResponse[]>([]);
  const [rec, setRec] = useState<WsRecommendationResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && recId) {
      setLoading(true);
      Promise.all([
        apiService.getWsRecommendation(recId),
        apiService.getRecommendationHistory(recId)
      ])
        .then(([recData, historyData]) => {
          setRec(recData);
          setHistory(historyData);
        })
        .catch(err => console.error("Failed to load history", err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, recId]);

  if (!isOpen) return null;

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "CREATED": return <FileText className="w-4 h-4 text-emerald-400" />;
      case "PUBLISHED": return <CheckCircle2 className="w-4 h-4 text-blue-400" />;
      case "THESIS_UPDATED": return <Edit className="w-4 h-4 text-yellow-400" />;
      case "CLOSED": return <XCircle className="w-4 h-4 text-red-400" />;
      case "ARCHIVED": return <Trash2 className="w-4 h-4 text-muted-foreground" />;
      default: return <Clock className="w-4 h-4 text-white/50" />;
    }
  };

  const formatEventName = (eventType: string) => {
    switch (eventType) {
      case "CREATED": return "Tạo Bản Nháp";
      case "PUBLISHED": return "Phát Hành";
      case "THESIS_UPDATED": return "Cập Nhật Nhận Định";
      case "CLOSED": return "Đóng Khuyến Nghị";
      case "ARCHIVED": return "Lưu Trữ";
      default: return eventType;
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl max-h-[85vh] glass p-0 rounded-[32px] border border-primary/30 shadow-[0_0_50px_rgba(0,240,255,0.1)] flex flex-col overflow-hidden"
      >
        <div className="p-6 md:p-8 border-b border-white/5 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-black text-2xl tracking-tighter uppercase text-white flex items-center gap-3">
              <span className="text-primary">{rec?.symbol}</span>
              <span className="text-[10px] font-bold text-muted-foreground px-2 py-1 rounded-md bg-white/5 border border-white/10 tracking-widest uppercase">
                {rec?.side === "BUY" ? "MUA" : "BÁN"}
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mt-1 font-medium tracking-wide">
              Lịch sử vòng đời & cập nhật nhận định
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-3 rounded-2xl hover:bg-white/10 text-muted-foreground hover:text-white transition-all group shrink-0"
          >
            <X className="w-6 h-6 group-hover:scale-110 transition-transform" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm font-medium italic">
              Không có dữ liệu lịch sử
            </div>
          ) : (
            <div className="relative border-l-2 border-white/10 ml-4 space-y-8 pb-4">
              {history.map((event, index) => {
                const isFirst = index === 0; // Most recent event
                return (
                  <div key={event.id} className="relative pl-8">
                    <div className="absolute -left-[17px] top-0 w-8 h-8 rounded-full bg-black border-2 border-white/10 flex items-center justify-center z-10 shadow-lg">
                      {getEventIcon(event.event_type)}
                    </div>
                    
                    <div className={`p-4 rounded-2xl border ${isFirst ? 'bg-primary/5 border-primary/20' : 'bg-white/5 border-white/5'} hover:bg-white/10 transition-colors`}>
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <h4 className={`text-sm font-black tracking-tight uppercase ${isFirst ? 'text-primary' : 'text-white'}`}>
                          {formatEventName(event.event_type)}
                        </h4>
                        <span className="text-[10px] text-muted-foreground font-bold tracking-widest shrink-0">
                          {event.created_at ? new Date(event.created_at).toLocaleString('vi-VN') : ""}
                        </span>
                      </div>
                      
                      {event.note && (
                        <div className="text-xs text-white/80 font-medium italic bg-black/40 p-3 rounded-xl border border-white/5 mb-3">
                          "{event.note}"
                        </div>
                      )}

                      {event.after_state && (
                        <div className="grid grid-cols-2 gap-4 mt-3">
                          {(() => {
                            try {
                              const stateObj = JSON.parse(event.after_state);
                              return (
                                <>
                                  {stateObj.target_price !== undefined && (
                                    <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                                      Target: <span className="text-emerald-400 ml-1">{stateObj.target_price}</span>
                                    </div>
                                  )}
                                  {stateObj.cutloss_price !== undefined && (
                                    <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                                      Cutloss: <span className="text-red-400 ml-1">{stateObj.cutloss_price}</span>
                                    </div>
                                  )}
                                </>
                              );
                            } catch (e) {
                              return null;
                            }
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
