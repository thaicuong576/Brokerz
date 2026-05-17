"use client";

import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import { Check, Copy, Key, Link2Off, Send, ShieldCheck, User as UserIcon } from "lucide-react";

import { apiService } from "@/lib/api";
import { cn } from "@/lib/utils";

export function ProfileHub({ isBroker, user, profile: initialProfile }: { isBroker: boolean; user: any; profile?: any }) {
  const [profile, setProfile] = useState<any>(initialProfile || null);
  const [soulKey, setSoulKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [inputKey, setInputKey] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [linkedBroker, setLinkedBroker] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, [user?.id, isBroker]);

  const fetchProfile = async () => {
    if (!user) return;
    const data = await apiService.getProfile(user.id || "mock-id", isBroker ? "broker" : "investor");
    if (!data) return;
    setProfile(data);
    if (isBroker) setSoulKey(data.soul_key || "");
    else setLinkedBroker(data.linked_broker_id || null);
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
        alert("SoulKey không hợp lệ. Vui lòng kiểm tra lại với broker.");
      }
    } catch (err) {
      console.error("Không kích hoạt được SoulKey", err);
      alert("SoulKey không hợp lệ. Vui lòng kiểm tra lại với broker.");
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
      console.error("Không ngắt kết nối được", err);
      window.location.reload();
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.85fr_1.15fr]">
      <section className="rounded border border-panel-border bg-panel p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded border border-panel-border bg-background text-primary">
            <UserIcon className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-zinc-100">{isBroker ? "Hồ sơ broker" : "Hồ sơ nhà đầu tư"}</h2>
            <p className="mt-1 truncate text-xs text-zinc-500">{user?.email || "anonymous@brokerz.vn"}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          <InfoRow icon={ShieldCheck} label="Bảo mật" value="Đăng nhập qua Supabase" tone="up" />
          <InfoRow label="Vai trò" value={isBroker ? "Broker workspace" : linkedBroker ? "Investor đã kết nối" : "Chờ SoulKey"} />
          <InfoRow label="Tên hiển thị" value={profile?.full_name || user?.user_metadata?.full_name || "Chưa cập nhật"} />
        </div>
      </section>

      <section className="rounded border border-panel-border bg-panel p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded border border-panel-border bg-background p-2 text-primary">
            <Key className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-100">{isBroker ? "Định danh broker" : "Kết nối workspace"}</h2>
            <p className="mt-1 text-xs text-zinc-500">
              {isBroker ? "Chia sẻ SoulKey để nhà đầu tư tham gia workspace." : "Nhập SoulKey do broker cung cấp để xem nội dung đã công bố."}
            </p>
          </div>
        </div>

        {isBroker ? (
          <div className="space-y-4">
            {soulKey ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="flex min-h-14 flex-1 items-center justify-center rounded border border-panel-border bg-background px-4 font-compact text-lg font-semibold tracking-[0.12em] text-primary">
                  {soulKey}
                </div>
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded border border-primary/30 bg-primary/10 px-4 text-xs font-semibold text-primary hover:bg-primary/20"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Đã sao chép" : "Sao chép"}
                </button>
              </div>
            ) : (
              <button type="button" onClick={fetchProfile} className="w-full rounded bg-primary py-3 text-xs font-semibold text-primary-foreground hover:bg-primary-hover">
                Tải SoulKey hiện tại
              </button>
            )}

            <div className="grid grid-cols-1 gap-3 border-t border-panel-border pt-4 sm:grid-cols-2">
              <Metric label="Trạng thái" value="Đang hoạt động" />
              <Metric label="Phạm vi" value="Workspace" />
            </div>
          </div>
        ) : linkedBroker ? (
          <div className="space-y-4">
            <div className="rounded border border-market-up/25 bg-market-up/10 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-market-up">
                <ShieldCheck className="h-4 w-4" />
                Đã kết nối an toàn
              </div>
              <p className="text-sm leading-6 text-zinc-400">
                Bạn đang theo dõi workspace của broker: <span className="font-semibold text-zinc-100">{profile?.broker_name || "Brokerz"}</span>
              </p>
              <div className="mt-3 rounded border border-panel-border bg-background px-3 py-2 font-compact text-sm font-semibold tracking-[0.08em] text-zinc-100">
                {profile?.linked_broker_key || linkedBroker}
              </div>
            </div>
            <button type="button" onClick={handleUnlink} className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-market-down">
              <Link2Off className="h-4 w-4" />
              Ngắt kết nối workspace
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-zinc-400">
              Sau khi kết nối, bạn sẽ xem được dashboard, nhận định thị trường và danh mục đã được broker công bố.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputKey}
                onChange={(event) => setInputKey(event.target.value.toUpperCase())}
                placeholder="BKZ-XXXX-XXXX"
                className="min-h-12 flex-1 rounded border border-panel-border bg-background px-3 py-2 font-compact text-sm font-semibold tracking-[0.08em] text-zinc-100 outline-none transition-colors focus:border-primary"
              />
              <button
                type="button"
                onClick={handleLink}
                disabled={isLinking || !inputKey}
                className="inline-flex min-h-12 w-12 items-center justify-center rounded bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
                title="Kích hoạt SoulKey"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, tone }: { icon?: ComponentType<{ className?: string }>; label: string; value: string; tone?: "up" }) {
  return (
    <div className="rounded border border-panel-border bg-background p-3">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className={cn("mt-1 flex items-center gap-2 text-xs font-semibold text-zinc-100", tone === "up" && "text-market-up")}>
        {Icon && <Icon className="h-4 w-4" />}
        {value}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-panel-border bg-background p-3">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className="mt-1 text-xs font-semibold text-zinc-100">{value}</div>
    </div>
  );
}
