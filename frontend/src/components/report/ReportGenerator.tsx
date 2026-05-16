"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, Check, Clock, Copy, Eye, Loader2, Send, Save } from "lucide-react";
import ExpertJudgmentForm, { JudgmentData } from "./ExpertJudgmentForm";
import { apiService, type DailyBriefResponse } from "@/lib/api";

const stripMarkdown = (markdown: string) =>
  markdown
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/`(.*?)`/g, "$1");

function formatDateTime(value?: string | null) {
  if (!value) return "Chưa publish";
  return new Date(value).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" });
}

function LatestDailyBriefView() {
  const [brief, setBrief] = useState<DailyBriefResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    apiService
      .getLatestDailyBrief()
      .then((data) => {
        if (mounted) setBrief(data);
      })
      .catch((err) => {
        console.error("Latest daily brief failed", err);
        if (mounted) setBrief(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-panel p-4 text-sm text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Đang tải nhận định mới nhất...
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-panel p-5">
        <div className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">Daily Market Brief</div>
        <h3 className="mt-1 text-lg font-bold text-zinc-100">Chưa có nhận định đã publish</h3>
        <p className="mt-2 text-sm text-zinc-400">Bạn sẽ thấy bản nhận định thị trường sau khi broker duyệt và publish.</p>
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-zinc-800 bg-panel p-5 shadow-md">
      <div className="flex flex-col gap-2 border-b border-zinc-800 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">Daily Market Brief</div>
          <h3 className="mt-1 text-xl font-bold text-zinc-100">{brief.title}</h3>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-zinc-500">
            <span>Broker: {brief.broker_name || "Brokerz"}</span>
            <span>Publish: {formatDateTime(brief.published_at)}</span>
          </div>
        </div>
        <span className="inline-flex w-fit items-center gap-1 rounded-full border border-green-900/50 bg-green-950/30 px-2.5 py-1 text-[11px] font-bold text-green-300">
          <Check className="h-3.5 w-3.5" />
          Published
        </span>
      </div>
      <article className="prose prose-invert prose-zinc mt-5 max-w-none prose-p:leading-relaxed prose-headings:text-zinc-100 prose-a:text-blue-400">
        <ReactMarkdown>{brief.content_markdown}</ReactMarkdown>
      </article>
    </section>
  );
}

export default function ReportGenerator({ isBroker = true }: { isBroker?: boolean }) {
  const [brief, setBrief] = useState<DailyBriefResponse | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  if (!isBroker) {
    return <LatestDailyBriefView />;
  }

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(stripMarkdown(content)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleGenerate = async (data: JudgmentData) => {
    setIsGenerating(true);
    try {
      const draft = await apiService.draftDailyBrief({ manual_override: data });
      setBrief(draft);
      setTitle(draft.title);
      setContent(draft.content_markdown);
    } catch (err) {
      console.error(err);
      alert("Không tạo được bản nháp daily brief. Hãy kiểm tra dữ liệu thị trường và GOOGLE_API_KEY.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!brief) return;
    setIsSaving(true);
    try {
      const updated = await apiService.updateDailyBrief(brief.id, {
        title,
        content_markdown: content,
      });
      setBrief(updated);
      setTitle(updated.title);
      setContent(updated.content_markdown);
    } catch (err) {
      console.error(err);
      alert("Không lưu được bản nháp.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!brief) return;
    setIsPublishing(true);
    try {
      const updated = await apiService.updateDailyBrief(brief.id, {
        title,
        content_markdown: content,
      });
      const published = await apiService.publishDailyBrief(updated.id);
      setBrief(published);
      setTitle(published.title);
      setContent(published.content_markdown);
    } catch (err) {
      console.error(err);
      alert("Không publish được daily brief.");
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <ExpertJudgmentForm onSubmit={handleGenerate} isGenerating={isGenerating} />
      </div>

      <div className="flex h-full flex-col lg:col-span-2">
        <div className="flex flex-col gap-3 rounded-t-lg border border-zinc-800 bg-[#1a1a1a] p-3 shadow-md sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-bold text-zinc-100">
              Daily brief workspace
              {brief?.status === "PUBLISHED" && <span className="h-2 w-2 rounded-full bg-green-500" />}
            </h3>
            <p className="mt-1 flex items-center gap-1 text-[11px] text-zinc-500">
              <Clock className="h-3.5 w-3.5" />
              {brief ? `${brief.status} · ${formatDateTime(brief.published_at || brief.updated_at)}` : "Chưa có bản nháp"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCopy}
              disabled={!content || isGenerating}
              className="inline-flex items-center gap-1.5 rounded bg-zinc-800 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              {copied ? "Đã copy" : "Copy Zalo"}
            </button>
            <button
              onClick={handleSave}
              disabled={!brief || isSaving || brief.status !== "DRAFT"}
              className="inline-flex items-center gap-1.5 rounded bg-zinc-800 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Lưu
            </button>
            <button
              onClick={handlePublish}
              disabled={!brief || !content.trim() || isPublishing || brief.status !== "DRAFT"}
              className="inline-flex items-center gap-1.5 rounded bg-primary px-2.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Publish
            </button>
          </div>
        </div>

        <div className="grid min-h-[520px] flex-1 grid-cols-1 overflow-hidden rounded-b-lg border border-t-0 border-zinc-800 bg-panel shadow-md xl:grid-cols-2">
          <div className="relative border-b border-zinc-800 p-4 xl:border-b-0 xl:border-r">
            {isGenerating && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-bl-lg bg-panel/85 backdrop-blur-sm">
                <Bot className="mb-4 h-12 w-12 animate-bounce text-blue-400" />
                <h3 className="text-lg font-bold text-zinc-200">AI đang soạn bản nháp...</h3>
                <p className="mt-1 text-sm text-zinc-500">Broker vẫn là người duyệt cuối cùng trước khi investor nhìn thấy.</p>
              </div>
            )}

            <label className="mb-3 flex flex-col gap-1.5 text-xs font-bold text-zinc-400">
              Tiêu đề
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={!brief || brief.status !== "DRAFT"}
                placeholder="Nhận định thị trường ngày..."
                className="rounded border border-zinc-800 bg-zinc-900 p-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-60"
              />
            </label>

            <label className="flex h-[420px] flex-col gap-1.5 text-xs font-bold text-zinc-400">
              Nội dung markdown
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={!brief || brief.status !== "DRAFT"}
                placeholder="Bản nháp AI sẽ xuất hiện ở đây sau khi tạo..."
                className="h-full resize-none rounded border border-zinc-800 bg-zinc-900 p-3 text-sm leading-relaxed text-zinc-100 outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-60"
              />
            </label>

            {brief?.warnings?.length ? (
              <div className="mt-3 rounded border border-amber-900/40 bg-amber-950/30 p-3 text-xs text-amber-200">
                {brief.warnings.map((warning) => (
                  <div key={warning}>{warning}</div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
              <Eye className="h-4 w-4" />
              Preview investor hub
            </div>
            {content ? (
              <article className="prose prose-invert prose-zinc max-w-none prose-p:leading-relaxed prose-headings:text-zinc-100 prose-a:text-blue-400">
                <ReactMarkdown>{content}</ReactMarkdown>
              </article>
            ) : (
              <div className="flex h-[420px] items-center justify-center rounded border border-dashed border-zinc-800 text-center text-sm text-zinc-500">
                Tạo bản nháp để xem preview trước khi publish.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
