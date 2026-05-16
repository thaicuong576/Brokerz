"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageSquare, 
  Send, 
  Search, 
  Filter, 
  ShieldAlert, 
  Lock, 
  Globe, 
  ChevronRight, 
  Plus, 
  User, 
  Bot,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  Paperclip,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiService } from "@/lib/api";

interface InquiryHubProps {
  user: any;
  isBroker?: boolean;
  profile?: any;
}

export function InquiryHub({ user, isBroker = false, profile = null }: InquiryHubProps) {
  const [activeSubTab, setActiveSubTab] = useState<"community" | "ai">("community");
  const [threads, setThreads] = useState<any[]>([]);
  const [selectedThread, setSelectedThread] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  
  // AI Chat states
  const [aiMessages, setAiMessages] = useState<{ role: 'ai' | 'user', content: string }[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    if (aiMessages.length === 0) {
      const brokerName = profile?.broker_name || "Broker của bạn";
      const greeting = isBroker 
        ? "Chào sếp! Tôi là trợ lý AI của sếp. Sếp cần kiểm tra dữ liệu hay phân tích gì không?"
        : `Chào bạn! Tôi là trợ lý của ${brokerName}. Tôi có thể giúp gì cho bạn trong lúc Broker vắng mặt không?`;
      
      setAiMessages([{ role: 'ai', content: greeting }]);
    }
  }, [profile, isBroker]);

  // Form states
  const [newThread, setNewThread] = useState({ title: "", initialMessage: "", isPrivate: true });
  const [replyContent, setReplyContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  
  // Image states
  const [newThreadImage, setNewThreadImage] = useState<string | null>(null);
  const [replyImage, setReplyImage] = useState<string | null>(null);

  useEffect(() => {
    loadThreads();
  }, [user.id]);

  useEffect(() => {
    if (selectedThread) {
      loadMessages(selectedThread.id);
    }
  }, [selectedThread]);

  const loadThreads = async () => {
    setIsLoading(true);
    try {
      const data = await apiService.getInquiryThreads(user.id);
      setThreads(data);
    } catch (err) {
      console.error("Failed to load threads:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (threadId: string) => {
    try {
      const data = await apiService.getThreadMessages(threadId);
      setMessages(data);
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  };

  const handleCreateThread = async () => {
    if (!newThread.title || !newThread.initialMessage) return;
    setIsSending(true);
    try {
      await apiService.createInquiryThread(user.id, {
        title: newThread.title,
        is_private: newThread.isPrivate,
        initial_message: newThread.initialMessage,
        image_url: newThreadImage || undefined
      });
      setIsCreating(false);
      setNewThread({ title: "", initialMessage: "", isPrivate: true });
      setNewThreadImage(null);
      loadThreads();
    } catch (err) {
      alert("Không thể tạo topic. Vui lòng kiểm tra SoulKey của bạn.");
    } finally {
      setIsSending(false);
    }
  };

  const handleSendReply = async () => {
    if ((!replyContent && !replyImage) || !selectedThread) return;
    setIsSending(true);
    try {
      const msg = await apiService.addThreadMessage(
        selectedThread.id, 
        user.id, 
        replyContent,
        replyImage || undefined
      );
      setMessages([...messages, msg]);
      setReplyContent("");
      setReplyImage(null);
      // Refresh threads list to update 'updated_at'
      loadThreads();
    } catch (err) {
      console.error("Failed to reply:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleImagePaste = (e: React.ClipboardEvent, type: 'reply' | 'thread') => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (type === 'reply') setReplyImage(event.target?.result as string);
            else setNewThreadImage(event.target?.result as string);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'reply' | 'thread') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (type === 'reply') setReplyImage(event.target?.result as string);
        else setNewThreadImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return "Vừa xong";
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    return date.toLocaleDateString('vi-VN');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Sub Tabs */}
      <div className="flex justify-center">
        <div className="glass p-1 rounded-2xl flex items-center gap-1">
          <button 
            onClick={() => { setActiveSubTab("community"); setSelectedThread(null); }}
            className={cn(
              "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
              activeSubTab === "community" ? "bg-primary text-black shadow-lg" : "text-muted-foreground hover:text-white"
            )}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Thảo luận
          </button>
          <button 
            onClick={() => setActiveSubTab("ai")}
            className={cn(
              "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
              activeSubTab === "ai" ? "bg-primary text-black shadow-lg" : "text-muted-foreground hover:text-white"
            )}
          >
            <Bot className="w-3.5 h-3.5" />
            Hỏi đáp cùng AI
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeSubTab === "community" ? (
          <motion.div 
            key="community"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {!selectedThread ? (
              <>
                {/* Header Actions */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input 
                      type="text" 
                      placeholder="Tìm kiếm chủ đề bàn luận..." 
                      className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all font-medium"
                    />
                  </div>
                  <button 
                    onClick={() => setIsCreating(true)}
                    className="w-full md:w-auto bg-primary text-black px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-105 transition-all shadow-[0_0_20px_rgba(0,240,255,0.2)]"
                  >
                    <Plus className="w-4 h-4" />
                    Tạo Topic mới
                  </button>
                </div>

                {/* Thread List */}
                <div className="grid grid-cols-1 gap-4">
                  {isLoading ? (
                    <div className="p-20 text-center text-muted-foreground animate-pulse font-black uppercase tracking-widest text-xs">Đang tải dữ liệu...</div>
                  ) : threads.length === 0 ? (
                    <div className="glass p-20 rounded-[32px] text-center border-dashed border-white/10">
                      <MessageSquare className="w-12 h-12 text-white/10 mx-auto mb-4" />
                      <p className="text-muted-foreground font-medium">Chưa có chủ đề nào. Hãy bắt đầu thảo luận ngay!</p>
                    </div>
                  ) : (
                    threads.map((thread, i) => (
                      <motion.div
                        key={thread.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => setSelectedThread(thread)}
                        className="glass p-6 rounded-[28px] flex items-center justify-between group hover:border-primary/40 transition-all cursor-pointer border border-white/5"
                      >
                        <div className="flex items-center gap-5">
                          <div className="relative">
                            <div className={cn(
                              "w-14 h-14 rounded-2xl overflow-hidden border border-white/10 shadow-inner flex items-center justify-center bg-white/5",
                              thread.is_private && "ring-2 ring-amber-500/20"
                            )}>
                              {thread.author_avatar ? (
                                <img src={thread.author_avatar} alt={thread.author_name} className="w-full h-full object-cover" />
                              ) : (
                                <User className="w-6 h-6 text-muted-foreground" />
                              )}
                            </div>
                            <div className={cn(
                              "absolute -bottom-1 -right-1 p-1.5 rounded-lg border border-black/50 shadow-lg",
                              thread.is_private ? "bg-amber-500 text-black" : "bg-primary text-black"
                            )}>
                              {thread.is_private ? <Lock className="w-2.5 h-2.5" /> : <Globe className="w-2.5 h-2.5" />}
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <h4 className="font-bold text-lg tracking-tight group-hover:text-primary transition-colors">{thread.title}</h4>
                              {thread.status === "RESOLVED" && (
                                <span className="bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase px-2 py-0.5 rounded-full border border-emerald-500/20">Xong</span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                              <span className="flex items-center gap-1.5 text-white/70">
                                {thread.author_name}
                              </span>
                              <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {getTimeAgo(thread.updated_at)}</span>
                              <span className="flex items-center gap-1.5"><MessageSquare className="w-3 h-3" /> {thread.message_count} trả lời</span>
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      </motion.div>
                    ))
                  )}
                </div>
              </>
            ) : (
              /* Thread Detail View */
              <div className="space-y-6">
                <button 
                  onClick={() => setSelectedThread(null)}
                  className="flex items-center gap-2 text-muted-foreground hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
                >
                  <ArrowLeft className="w-4 h-4" /> Quay lại danh sách
                </button>

                <div className="glass p-8 rounded-[40px] border-primary/10">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border",
                          selectedThread.is_private ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-primary/10 text-primary border-primary/20"
                        )}>
                          {selectedThread.is_private ? "Riêng tư" : "Cộng đồng"}
                        </span>
                        <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">#{selectedThread.id.slice(0,8)}</span>
                      </div>
                      <h2 className="text-3xl font-black tracking-tighter uppercase italic">{selectedThread.title}</h2>
                    </div>
                    {selectedThread.status === "OPEN" && isBroker && (
                      <button className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-black transition-all">Đánh dấu đã giải quyết</button>
                    )}
                  </div>

                  <div className="space-y-8 relative before:absolute before:left-6 before:top-2 before:bottom-2 before:w-px before:bg-white/5">
                    {messages.map((msg, i) => (
                      <div key={msg.id} className="relative flex gap-6">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl shrink-0 overflow-hidden border z-10 flex items-center justify-center bg-white/5",
                          msg.is_ai_generated ? "bg-primary/20 border-primary/30 text-primary" : "border-white/10"
                        )}>
                          {msg.is_ai_generated ? (
                            <Bot className="w-6 h-6" />
                          ) : msg.sender_avatar ? (
                            <img src={msg.sender_avatar} alt={msg.sender_name} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-6 h-6 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-xs font-black uppercase tracking-widest text-white">{msg.sender_name}</span>
                            <span className="text-[10px] text-muted-foreground font-medium">{getTimeAgo(msg.created_at)}</span>
                          </div>
                          <div className="glass p-6 rounded-3xl rounded-tl-none border-white/5 text-sm leading-relaxed text-white/90 font-medium whitespace-pre-wrap">
                            {msg.content}
                            {msg.image_url && (
                              <div className="mt-4 rounded-xl overflow-hidden border border-white/10 shadow-lg bg-black/20">
                                <img 
                                  src={msg.image_url} 
                                  alt="Attached content" 
                                  className="w-full max-h-[500px] object-contain"
                                  onClick={() => window.open(msg.image_url, '_blank')}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Reply Input */}
                  <div className="mt-12 pt-8 border-t border-white/5">
                    {replyImage && (
                      <div className="mb-4 relative w-fit group">
                        <img src={replyImage} alt="Preview" className="h-32 w-auto rounded-2xl border border-white/10 shadow-2xl" />
                        <button 
                          onClick={() => setReplyImage(null)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <div className="flex gap-4">
                      <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4 flex items-start gap-3">
                        <textarea 
                          rows={Math.min(5, replyContent.split('\n').length)}
                          value={replyContent}
                          onChange={(e) => setReplyContent(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendReply();
                            }
                          }}
                          onPaste={(e) => handleImagePaste(e, 'reply')}
                          placeholder="Nhập nội dung phản hồi (dán ảnh trực tiếp)..." 
                          className="flex-1 bg-transparent border-none focus:outline-none text-sm placeholder:text-muted-foreground font-medium resize-none max-h-48 scrollbar-thin py-1"
                        />
                        <div className="flex items-center gap-2 pt-1 border-l border-white/10 pl-3">
                          <label className="cursor-pointer text-muted-foreground hover:text-primary transition-colors p-1.5 hover:bg-white/5 rounded-lg" title="Tải ảnh lên">
                            <ImageIcon className="w-5 h-5" />
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*" 
                              onChange={(e) => handleImageUpload(e, 'reply')}
                            />
                          </label>
                        </div>
                      </div>
                      <button 
                        onClick={handleSendReply}
                        disabled={isSending || (!replyContent && !replyImage)}
                        className="bg-primary text-black px-8 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(0,240,255,0.3)] font-black text-xs uppercase tracking-widest disabled:opacity-50 h-[54px] self-end"
                      >
                        {isSending ? "Đang gửi..." : "Gửi"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="ai"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass rounded-[48px] border-white/5 flex flex-col h-[700px] relative overflow-hidden"
          >
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
                  <Bot className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tighter uppercase italic text-white">
                    {isBroker ? "Trợ lý AI của Bạn" : `Trợ lý của Broker ${profile?.broker_name || "Brokez"}`}
                  </h3>
                  <p className="text-[10px] text-primary font-black uppercase tracking-widest opacity-70">Trực tuyến • Phản hồi tức thì</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
              {aiMessages.map((msg, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: msg.role === 'ai' ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[80%] p-5 rounded-3xl text-sm leading-relaxed font-medium ${
                    msg.role === 'ai' 
                      ? 'bg-white/5 border border-white/10 text-white rounded-tl-none' 
                      : 'bg-primary text-black font-bold rounded-tr-none shadow-[0_0_20px_rgba(0,240,255,0.2)]'
                  }`}>
                    {msg.content}
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="p-8 bg-white/[0.01] border-t border-white/5">
              <div className="flex flex-wrap gap-2 mb-4">
                {["Tóm tắt thị trường", "Phân tích rủi ro", "Top cổ phiếu"].map(tip => (
                  <button 
                    key={tip} 
                    onClick={() => {
                      setAiMessages(prev => [...prev, { role: 'user', content: tip }]);
                      setTimeout(() => {
                        setAiMessages(prev => [...prev, { role: 'ai', content: "Tôi đang phân tích yêu cầu của bạn về " + tip + "... Tính năng này sẽ sớm được cập nhật." }]);
                      }, 1000);
                    }}
                    className="px-4 py-2 rounded-xl border border-white/5 bg-white/5 text-[9px] font-black uppercase tracking-wider text-muted-foreground hover:text-white hover:border-primary/30 transition-all"
                  >
                    {tip}
                  </button>
                ))}
              </div>
              <div className="bg-white/5 border border-white/10 rounded-3xl p-2 flex items-center shadow-inner group focus-within:border-primary/40 transition-all">
                 <input 
                   type="text" 
                   value={aiInput}
                   onChange={(e) => setAiInput(e.target.value)}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter' && aiInput.trim()) {
                        const val = aiInput;
                        setAiInput("");
                        setAiMessages(prev => [...prev, { role: 'user', content: val }]);
                        setTimeout(() => {
                          setAiMessages(prev => [...prev, { role: 'ai', content: "Hệ thống AI đang được tinh chỉnh. Câu hỏi của bạn đã được ghi nhận!" }]);
                        }, 1000);
                     }
                   }}
                   placeholder="Hỏi trợ lý chiến thuật..."
                   className="flex-1 bg-transparent border-none focus:outline-none px-6 py-4 text-sm font-medium text-white"
                 />
                 <button 
                  onClick={() => {
                    if (!aiInput.trim()) return;
                    const val = aiInput;
                    setAiInput("");
                    setAiMessages(prev => [...prev, { role: 'user', content: val }]);
                    setTimeout(() => {
                      setAiMessages(prev => [...prev, { role: 'ai', content: "Hệ thống AI đang được tinh chỉnh. Câu hỏi của bạn đã được ghi nhận!" }]);
                    }, 1000);
                  }}
                  className="bg-primary text-black p-4 rounded-2xl hover:scale-105 transition-all shadow-lg shadow-primary/20"
                 >
                   <Send className="w-5 h-5" />
                 </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Creating Topic */}
      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreating(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-2xl glass rounded-[40px] border border-white/10 p-10 relative z-10"
            >
              <h3 className="text-3xl font-black tracking-tighter uppercase italic mb-8">Tạo Chủ đề thảo luận mới</h3>
              
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 block">Tiêu đề Topic</label>
                  <input 
                    type="text" 
                    value={newThread.title}
                    onChange={(e) => setNewThread({...newThread, title: e.target.value})}
                    placeholder="Ví dụ: Triển vọng ngành Thép Q3/2024?"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-sm font-medium focus:outline-none focus:border-primary/50 transition-all"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">Nội dung câu hỏi/bàn luận</label>
                    <label className="cursor-pointer text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest p-2 bg-white/5 rounded-xl border border-white/5">
                      <ImageIcon className="w-3.5 h-3.5" />
                      {newThreadImage ? "Đổi ảnh" : "Thêm ảnh"}
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*" 
                        onChange={(e) => handleImageUpload(e, 'thread')}
                      />
                    </label>
                  </div>
                  <textarea 
                    rows={4}
                    value={newThread.initialMessage}
                    onChange={(e) => setNewThread({...newThread, initialMessage: e.target.value})}
                    onPaste={(e) => handleImagePaste(e, 'thread')}
                    placeholder="Mô tả chi tiết câu hỏi (dán ảnh trực tiếp)..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-sm font-medium focus:outline-none focus:border-primary/50 transition-all resize-none"
                  />
                  {newThreadImage && (
                    <div className="mt-4 relative group w-fit">
                      <img src={newThreadImage} alt="Attached" className="h-32 rounded-2xl border border-white/10" />
                      <button 
                        onClick={() => setNewThreadImage(null)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between p-6 bg-white/5 rounded-[24px] border border-white/5">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "p-3 rounded-xl",
                      newThread.isPrivate ? "bg-amber-500/10 text-amber-500" : "bg-primary/10 text-primary"
                    )}>
                      {newThread.isPrivate ? <Lock className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest">{newThread.isPrivate ? "Chế độ Riêng tư" : "Chế độ Công khai"}</p>
                      <p className="text-[9px] text-muted-foreground font-medium">{newThread.isPrivate ? "Chỉ bạn và Broker của bạn nhìn thấy." : "Tất cả nhà đầu tư cùng SoulKey Broker đều thấy."}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setNewThread({...newThread, isPrivate: !newThread.isPrivate})}
                    className={cn(
                      "w-12 h-6 rounded-full relative transition-all duration-300",
                      newThread.isPrivate ? "bg-amber-500/20" : "bg-primary/20"
                    )}
                  >
                    <motion.div 
                      animate={{ x: newThread.isPrivate ? 4 : 28 }}
                      className={cn("absolute top-1 w-4 h-4 rounded-full", newThread.isPrivate ? "bg-amber-500" : "bg-primary")}
                    />
                  </button>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setIsCreating(false)}
                    className="flex-1 py-5 rounded-2xl border border-white/5 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all"
                  >
                    Hủy bỏ
                  </button>
                  <button 
                    onClick={handleCreateThread}
                    disabled={isSending || !newThread.title || !newThread.initialMessage}
                    className="flex-[2] py-5 bg-primary text-black rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-[0_0_30px_rgba(0,240,255,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {isSending ? "Đang phát hành..." : "Phát hành chủ đề"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
