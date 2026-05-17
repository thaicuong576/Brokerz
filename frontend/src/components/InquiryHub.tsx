"use client";

import type { ChangeEvent, ClipboardEvent, ComponentType } from "react";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock,
  Globe,
  Image as ImageIcon,
  Lock,
  MessageSquare,
  Plus,
  Search,
  Send,
  User,
  X,
} from "lucide-react";

import { apiService } from "@/lib/api";
import { cn } from "@/lib/utils";

interface InquiryHubProps {
  user: any;
  isBroker?: boolean;
  profile?: any;
}

const inputClass =
  "w-full rounded border border-panel-border bg-background px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-primary";

export function InquiryHub({ user, isBroker = false, profile = null }: InquiryHubProps) {
  const [activeSubTab, setActiveSubTab] = useState<"community" | "ai">("community");
  const [threads, setThreads] = useState<any[]>([]);
  const [selectedThread, setSelectedThread] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ role: "ai" | "user"; content: string }[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [newThread, setNewThread] = useState({ title: "", initialMessage: "", isPrivate: true });
  const [replyContent, setReplyContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [newThreadImage, setNewThreadImage] = useState<string | null>(null);
  const [replyImage, setReplyImage] = useState<string | null>(null);

  useEffect(() => {
    if (aiMessages.length > 0) return;
    const brokerName = profile?.broker_name || "broker";
    const greeting = isBroker
      ? "Tôi có thể hỗ trợ chuẩn bị câu trả lời nháp, tóm tắt câu hỏi và kiểm tra thông tin trước khi broker phản hồi."
      : `Tôi có thể giúp bạn tóm tắt câu hỏi trước khi gửi đến ${brokerName}. Nội dung chính thức vẫn do broker phản hồi.`;
    setAiMessages([{ role: "ai", content: greeting }]);
  }, [profile, isBroker, aiMessages.length]);

  useEffect(() => {
    if (user?.id) loadThreads();
  }, [user?.id]);

  useEffect(() => {
    if (selectedThread) loadMessages(selectedThread.id);
  }, [selectedThread?.id]);

  const loadThreads = async () => {
    setIsLoading(true);
    try {
      const data = await apiService.getInquiryThreads(user.id);
      setThreads(data || []);
    } catch (err) {
      console.error("Không tải được danh sách hỏi đáp", err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (threadId: string) => {
    try {
      const data = await apiService.getThreadMessages(threadId);
      setMessages(data || []);
    } catch (err) {
      console.error("Không tải được nội dung trao đổi", err);
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
        image_url: newThreadImage || undefined,
      });
      setIsCreating(false);
      setNewThread({ title: "", initialMessage: "", isPrivate: true });
      setNewThreadImage(null);
      loadThreads();
    } catch (err) {
      alert("Không tạo được chủ đề. Vui lòng kiểm tra kết nối workspace.");
    } finally {
      setIsSending(false);
    }
  };

  const handleSendReply = async () => {
    if ((!replyContent && !replyImage) || !selectedThread) return;
    setIsSending(true);
    try {
      const message = await apiService.addThreadMessage(selectedThread.id, user.id, replyContent, replyImage || undefined);
      setMessages([...messages, message]);
      setReplyContent("");
      setReplyImage(null);
      loadThreads();
    } catch (err) {
      console.error("Không gửi được phản hồi", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleImagePaste = (event: ClipboardEvent, type: "reply" | "thread") => {
    const items = event.clipboardData.items;
    for (let index = 0; index < items.length; index += 1) {
      if (!items[index].type.includes("image")) continue;
      const file = items[index].getAsFile();
      if (!file) continue;
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        if (type === "reply") setReplyImage(readerEvent.target?.result as string);
        else setNewThreadImage(readerEvent.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>, type: "reply" | "thread") => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      if (type === "reply") setReplyImage(readerEvent.target?.result as string);
      else setNewThreadImage(readerEvent.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return "Vừa xong";
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    return date.toLocaleDateString("vi-VN");
  };

  const sendAiMessage = (content: string) => {
    if (!content.trim()) return;
    setAiInput("");
    setAiMessages((prev) => [...prev, { role: "user", content }]);
    setTimeout(() => {
      setAiMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content: "Tôi đã ghi nhận yêu cầu. Với dữ liệu hiện tại, phần này nên được broker kiểm tra lại trước khi gửi cho nhà đầu tư.",
        },
      ]);
    }, 600);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-col gap-3 rounded border border-panel-border bg-panel px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Hỏi đáp nhà đầu tư</h2>
          <p className="mt-1 text-xs text-zinc-500">Theo dõi câu hỏi, phản hồi và nội dung nháp trong workspace.</p>
        </div>
        <div className="flex rounded border border-panel-border bg-background p-1">
          <Segment active={activeSubTab === "community"} icon={MessageSquare} label="Trao đổi" onClick={() => { setActiveSubTab("community"); setSelectedThread(null); }} />
          <Segment active={activeSubTab === "ai"} icon={Bot} label="Trợ lý nháp" onClick={() => setActiveSubTab("ai")} />
        </div>
      </div>

      {activeSubTab === "community" ? (
        selectedThread ? (
          <ThreadDetail
            thread={selectedThread}
            messages={messages}
            isBroker={isBroker}
            replyContent={replyContent}
            replyImage={replyImage}
            isSending={isSending}
            getTimeAgo={getTimeAgo}
            onBack={() => setSelectedThread(null)}
            onReplyChange={setReplyContent}
            onReplyImageClear={() => setReplyImage(null)}
            onSendReply={handleSendReply}
            onImagePaste={handleImagePaste}
            onImageUpload={handleImageUpload}
          />
        ) : (
          <section className="space-y-3">
            <div className="flex flex-col gap-2 rounded border border-panel-border bg-panel p-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input className={cn(inputClass, "pl-9")} placeholder="Tìm chủ đề, mã cổ phiếu hoặc nhà đầu tư..." />
              </div>
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="inline-flex items-center justify-center gap-2 rounded bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-hover"
              >
                <Plus className="h-4 w-4" />
                Tạo chủ đề
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {isLoading ? (
                <EmptyState label="Đang tải dữ liệu..." />
              ) : threads.length === 0 ? (
                <EmptyState label="Chưa có chủ đề nào trong workspace." />
              ) : (
                threads.map((thread) => (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => setSelectedThread(thread)}
                    className="rounded border border-panel-border bg-panel p-4 text-left transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-zinc-100">{thread.title}</h3>
                          <PrivacyBadge isPrivate={thread.is_private} />
                          {thread.status === "RESOLVED" && (
                            <span className="inline-flex items-center gap-1 rounded border border-market-up/30 bg-market-up/10 px-2 py-0.5 text-[11px] text-market-up">
                              <CheckCircle2 className="h-3 w-3" />
                              Đã xử lý
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
                          <span>{thread.author_name}</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {getTimeAgo(thread.updated_at)}
                          </span>
                          <span>{thread.message_count} phản hồi</span>
                        </div>
                      </div>
                      <MessageSquare className="h-4 w-4 shrink-0 text-zinc-600" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>
        )
      ) : (
        <section className="flex h-[680px] flex-col rounded border border-panel-border bg-panel">
          <div className="flex items-center gap-3 border-b border-panel-border px-4 py-3">
            <div className="rounded border border-primary/30 bg-primary/10 p-2 text-primary">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">{isBroker ? "Trợ lý soạn phản hồi" : `Trợ lý của ${profile?.broker_name || "broker"}`}</h3>
              <p className="text-xs text-zinc-500">Nội dung AI chỉ là bản nháp, cần broker kiểm tra trước khi gửi.</p>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {aiMessages.map((message, index) => (
              <div key={index} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[82%] rounded border px-4 py-3 text-sm leading-6", message.role === "user" ? "border-primary/30 bg-primary/10 text-zinc-100" : "border-panel-border bg-background text-zinc-300")}>
                  {message.content}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-panel-border p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {["Tóm tắt câu hỏi", "Soạn phản hồi nháp", "Liệt kê rủi ro"].map((tip) => (
                <button key={tip} type="button" onClick={() => sendAiMessage(tip)} className="rounded border border-panel-border bg-background px-3 py-1.5 text-[11px] text-zinc-400 hover:border-primary/40 hover:text-zinc-100">
                  {tip}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className={inputClass}
                value={aiInput}
                onChange={(event) => setAiInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") sendAiMessage(aiInput);
                }}
                placeholder="Nhập yêu cầu soạn nháp..."
              />
              <button type="button" onClick={() => sendAiMessage(aiInput)} className="rounded bg-primary px-4 text-primary-foreground hover:bg-primary-hover">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {isCreating && (
        <CreateThreadModal
          newThread={newThread}
          newThreadImage={newThreadImage}
          isSending={isSending}
          setNewThread={setNewThread}
          setNewThreadImage={setNewThreadImage}
          onClose={() => setIsCreating(false)}
          onCreate={handleCreateThread}
          onImagePaste={handleImagePaste}
          onImageUpload={handleImageUpload}
        />
      )}
    </div>
  );
}

function ThreadDetail({
  thread,
  messages,
  isBroker,
  replyContent,
  replyImage,
  isSending,
  getTimeAgo,
  onBack,
  onReplyChange,
  onReplyImageClear,
  onSendReply,
  onImagePaste,
  onImageUpload,
}: {
  thread: any;
  messages: any[];
  isBroker: boolean;
  replyContent: string;
  replyImage: string | null;
  isSending: boolean;
  getTimeAgo: (dateStr: string) => string;
  onBack: () => void;
  onReplyChange: (value: string) => void;
  onReplyImageClear: () => void;
  onSendReply: () => void;
  onImagePaste: (event: ClipboardEvent, type: "reply" | "thread") => void;
  onImageUpload: (event: ChangeEvent<HTMLInputElement>, type: "reply" | "thread") => void;
}) {
  return (
    <section className="rounded border border-panel-border bg-panel">
      <div className="border-b border-panel-border px-4 py-3">
        <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-100">
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách
        </button>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <PrivacyBadge isPrivate={thread.is_private} />
              <span className="text-[11px] text-zinc-600">#{thread.id.slice(0, 8)}</span>
            </div>
            <h2 className="text-lg font-semibold text-zinc-100">{thread.title}</h2>
          </div>
          {thread.status === "OPEN" && isBroker && (
            <button type="button" className="rounded border border-market-up/30 bg-market-up/10 px-3 py-2 text-xs font-semibold text-market-up">
              Đánh dấu đã xử lý
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4 p-4">
        {messages.map((message) => (
          <div key={message.id} className="flex gap-3">
            <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded border border-panel-border bg-background", message.is_ai_generated ? "text-primary" : "text-zinc-500")}>
              {message.is_ai_generated ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-zinc-200">{message.sender_name}</span>
                <span className="text-[11px] text-zinc-600">{getTimeAgo(message.created_at)}</span>
              </div>
              <div className="rounded border border-panel-border bg-background px-4 py-3 text-sm leading-6 text-zinc-300">
                <div className="whitespace-pre-wrap">{message.content}</div>
                {message.image_url && (
                  <img src={message.image_url} alt="Nội dung đính kèm" className="mt-3 max-h-[420px] rounded border border-panel-border object-contain" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-panel-border p-4">
        {replyImage && (
          <div className="mb-3 flex w-fit items-start gap-2 rounded border border-panel-border bg-background p-2">
            <img src={replyImage} alt="Ảnh đính kèm" className="h-24 rounded object-contain" />
            <button type="button" onClick={onReplyImageClear} className="rounded p-1 text-zinc-500 hover:text-market-down">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <div className="flex flex-1 gap-2 rounded border border-panel-border bg-background p-2 focus-within:border-primary">
            <textarea
              rows={2}
              value={replyContent}
              onChange={(event) => onReplyChange(event.target.value)}
              onPaste={(event) => onImagePaste(event, "reply")}
              placeholder="Nhập phản hồi..."
              className="min-h-[44px] flex-1 resize-none bg-transparent px-2 py-1 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
            />
            <label className="cursor-pointer rounded border border-panel-border p-2 text-zinc-500 hover:text-primary" title="Đính kèm ảnh">
              <ImageIcon className="h-4 w-4" />
              <input type="file" className="hidden" accept="image/*" onChange={(event) => onImageUpload(event, "reply")} />
            </label>
          </div>
          <button type="button" onClick={onSendReply} disabled={isSending || (!replyContent && !replyImage)} className="rounded bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50">
            {isSending ? "Đang gửi" : "Gửi"}
          </button>
        </div>
      </div>
    </section>
  );
}

function CreateThreadModal({
  newThread,
  newThreadImage,
  isSending,
  setNewThread,
  setNewThreadImage,
  onClose,
  onCreate,
  onImagePaste,
  onImageUpload,
}: {
  newThread: { title: string; initialMessage: string; isPrivate: boolean };
  newThreadImage: string | null;
  isSending: boolean;
  setNewThread: (value: { title: string; initialMessage: string; isPrivate: boolean }) => void;
  setNewThreadImage: (value: string | null) => void;
  onClose: () => void;
  onCreate: () => void;
  onImagePaste: (event: ClipboardEvent, type: "reply" | "thread") => void;
  onImageUpload: (event: ChangeEvent<HTMLInputElement>, type: "reply" | "thread") => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl rounded border border-panel-border bg-panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-100">Tạo chủ đề mới</h3>
          <button type="button" onClick={onClose} className="rounded border border-panel-border p-2 text-zinc-500 hover:text-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <input className={inputClass} value={newThread.title} onChange={(event) => setNewThread({ ...newThread, title: event.target.value })} placeholder="Tiêu đề chủ đề" />
          <textarea className={cn(inputClass, "resize-none leading-6")} rows={5} value={newThread.initialMessage} onChange={(event) => setNewThread({ ...newThread, initialMessage: event.target.value })} onPaste={(event) => onImagePaste(event, "thread")} placeholder="Nội dung câu hỏi hoặc trao đổi" />
          {newThreadImage && (
            <div className="flex w-fit items-start gap-2 rounded border border-panel-border bg-background p-2">
              <img src={newThreadImage} alt="Ảnh đính kèm" className="h-24 rounded object-contain" />
              <button type="button" onClick={() => setNewThreadImage(null)} className="rounded p-1 text-zinc-500 hover:text-market-down">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="flex flex-col gap-3 rounded border border-panel-border bg-background p-3 md:flex-row md:items-center md:justify-between">
            <button
              type="button"
              onClick={() => setNewThread({ ...newThread, isPrivate: !newThread.isPrivate })}
              className={cn("inline-flex items-center gap-2 text-xs font-semibold", newThread.isPrivate ? "text-market-ref" : "text-primary")}
            >
              {newThread.isPrivate ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
              {newThread.isPrivate ? "Riêng tư với broker" : "Công khai trong workspace"}
            </button>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-500 hover:text-primary">
              <ImageIcon className="h-4 w-4" />
              Đính kèm ảnh
              <input type="file" className="hidden" accept="image/*" onChange={(event) => onImageUpload(event, "thread")} />
            </label>
          </div>
          <button type="button" onClick={onCreate} disabled={isSending || !newThread.title || !newThread.initialMessage} className="w-full rounded bg-primary py-3 text-xs font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50">
            {isSending ? "Đang tạo..." : "Tạo chủ đề"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Segment({ active, icon: Icon, label, onClick }: { active: boolean; icon: ComponentType<{ className?: string }>; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("inline-flex items-center gap-2 rounded px-3 py-2 text-xs font-semibold transition-colors", active ? "bg-primary text-primary-foreground" : "text-zinc-500 hover:bg-muted hover:text-zinc-100")}>
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function PrivacyBadge({ isPrivate }: { isPrivate: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px]", isPrivate ? "border-market-ref/30 bg-market-ref/10 text-market-ref" : "border-primary/30 bg-primary/10 text-primary")}>
      {isPrivate ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
      {isPrivate ? "Riêng tư" : "Công khai"}
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded border border-dashed border-panel-border bg-panel px-4 py-12 text-center text-xs text-zinc-500">{label}</div>;
}
