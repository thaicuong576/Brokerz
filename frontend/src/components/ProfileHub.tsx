"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Key, Send, ShieldCheck, Sparkles, Target, User as UserIcon } from "lucide-react";

import { apiService } from "@/lib/api";

export function ProfileHub({ isBroker, user, profile: initialProfile }: { isBroker: boolean; user: any; profile?: any }) {
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
    const data = await apiService.getProfile(user.id || "mock-id", isBroker ? "broker" : "investor");
    if (!data) return;
    setProfile(data);
    if (isBroker) setSoulKey(data.soul_key || "");
    else setLinkedBroker(data.linked_broker_id || null);
  };

  const authorizeIdentity = async () => {
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <section className="relative overflow-hidden rounded-lg border border-panel-border bg-panel p-8 shadow-md">
        <div className="relative z-10">
          <div className="mb-8 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded border border-panel-border bg-primary/10 text-primary">
              <UserIcon className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-zinc-100">
                {isBroker ? "Hồ sơ broker" : "Hồ sơ nhà đầu tư"}
              </h3>
              <p className="text-[10px] font-bold uppercase text-zinc-500">
                {user?.email || "anonymous@brokerz.vn"}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded border border-panel-border bg-zinc-950 p-4">
              <div className="mb-1 text-[9px] font-bold uppercase text-zinc-500">Bảo mật tài khoản</div>
              <div className="flex items-center gap-2 text-xs font-bold text-market-up">
                <ShieldCheck className="h-4 w-4" />
                Đăng nhập qua Supabase
              </div>
            </div>
            <div className="rounded border border-panel-border bg-zinc-950 p-4">
              <div className="mb-1 text-[9px] font-bold uppercase text-zinc-500">Phạm vi truy cập</div>
              <div className="text-xs font-bold text-primary">
                {isBroker ? "Sở hữu workspace" : linkedBroker ? "Đã tham gia workspace" : "Chờ SoulKey"}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-lg border border-panel-border bg-panel p-8 shadow-md lg:col-span-2">
        <div className="absolute right-0 top-0 p-6 opacity-10">
          <Key className="h-24 w-24" />
        </div>

        <div className="relative z-10 flex h-full flex-col">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded bg-primary/10 p-2 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <h3 className="text-xl font-bold text-zinc-100">
              {isBroker ? "Định danh broker" : "Kết nối bằng SoulKey"}
            </h3>
          </div>

          {isBroker ? (
            <div className="flex flex-1 flex-col gap-6">
              <p className="max-w-md text-sm leading-6 text-zinc-400">
                SoulKey là mã mời vào workspace của broker. Nhà đầu tư chỉ xem được dashboard, danh mục và nhận định sau khi tham gia bằng mã này.
              </p>

              {soulKey ? (
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 items-center justify-center rounded border border-panel-border bg-zinc-950 p-5 font-mono text-xl font-bold tracking-[0.18em] text-primary">
                    {soulKey}
                  </div>
                  <button
                    onClick={copyToClipboard}
                    className="flex h-[66px] w-[66px] items-center justify-center rounded border border-primary/20 bg-primary/10 text-primary transition-colors hover:bg-primary/20"
                    title="Sao chép SoulKey"
                  >
                    {copied ? <Check className="h-6 w-6" /> : <Copy className="h-6 w-6" />}
                  </button>
                </div>
              ) : (
                <button
                  onClick={authorizeIdentity}
                  className="w-full rounded bg-primary py-4 text-xs font-bold uppercase text-zinc-950 transition-colors hover:bg-primary-hover"
                >
                  Tải SoulKey hiện tại
                </button>
              )}

              <div className="mt-auto grid grid-cols-2 gap-4 border-t border-panel-border pt-4">
                <Metric label="Trạng thái" value="Đang hoạt động" />
                <Metric label="Nguồn quyền truy cập" value="Workspace" />
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-6">
              {linkedBroker ? (
                <div className="space-y-6">
                  <div className="rounded border border-market-up/20 bg-market-up/10 p-6">
                    <div className="mb-3 flex items-center gap-3 text-xs font-bold uppercase text-market-up">
                      <ShieldCheck className="h-5 w-5" />
                      Đã kết nối an toàn
                    </div>
                    <p className="mb-4 text-sm leading-6 text-zinc-400">
                      Bạn đang theo dõi workspace của broker: <span className="font-bold text-zinc-100">{profile?.broker_name || "Brokerz"}</span>
                    </p>
                    <div className="rounded border border-panel-border bg-zinc-950 p-4 text-center font-mono font-bold tracking-widest text-zinc-100">
                      {profile?.linked_broker_key || linkedBroker}
                    </div>
                  </div>

                  <button
                    onClick={handleUnlink}
                    className="flex items-center gap-2 text-[10px] font-bold uppercase text-zinc-500 transition-colors hover:text-market-down"
                  >
                    <Target className="h-3 w-3" />
                    Ngắt kết nối workspace
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm leading-6 text-zinc-400">
                    Nhập SoulKey được broker cung cấp để xem dashboard, nhận định thị trường và danh mục được công bố.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={inputKey}
                      onChange={(event) => setInputKey(event.target.value.toUpperCase())}
                      placeholder="BKZ-XXXX-XXXX"
                      className="flex-1 rounded border border-panel-border bg-zinc-950 p-4 text-sm font-bold tracking-widest text-zinc-100 outline-none transition-colors focus:border-primary"
                    />
                    <button
                      onClick={handleLink}
                      disabled={isLinking || !inputKey}
                      className="flex h-[58px] w-[58px] items-center justify-center rounded bg-primary text-zinc-950 transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                      title="Kích hoạt SoulKey"
                    >
                      <Send className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-panel-border bg-zinc-950 p-4">
      <div className="mb-1 text-[9px] font-bold uppercase text-zinc-500">{label}</div>
      <div className="text-xs font-bold text-zinc-100">{value}</div>
    </div>
  );
}
