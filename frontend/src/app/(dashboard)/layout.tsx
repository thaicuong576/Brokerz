"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { Dashboard } from "@/components/Dashboard";
import { InquiryHub } from "@/components/InquiryHub";
import { Navbar } from "@/components/Navbar";
import { PortfolioView } from "@/components/PortfolioView";
import { ProfileHub } from "@/components/ProfileHub";
import { TetherGate } from "@/components/TetherGate";
import { UserContext } from "@/context/UserContext";
import { apiService } from "@/lib/api";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [userType, setUserType] = useState<"broker" | "investor">("investor");
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isTethered, setIsTethered] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [workspace, setWorkspace] = useState<any>(null);
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set());
  const [brokerPendingApproval, setBrokerPendingApproval] = useState(false);

  const getActiveTab = () => {
    if (pathname === "/") return "intelligence";
    if (pathname.startsWith("/inquiry")) return "inquiry";
    if (pathname.startsWith("/portfolio")) return "portfolio";
    if (pathname.startsWith("/profile")) return "profile";
    return "intelligence";
  };

  useEffect(() => {
    const activeTab = getActiveTab();
    setVisitedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [pathname]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession?.user) {
        loadFoundation();
      } else {
        setLoading(false);
        router.push("/login");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, authSession) => {
      if (authSession?.user) {
        setSession(authSession);
        loadFoundation();
      } else {
        setLoading(false);
        router.push("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadFoundation = async () => {
    setLoading(true);
    try {
      const me = await apiService.getMe();
      let currentWorkspace = await apiService.getCurrentWorkspace();
      const currentRole = me.role === "BROKER" ? "broker" : "investor";

      const loginIntent = typeof window !== "undefined" ? localStorage.getItem("bkz_login_intent") : null;
      if (loginIntent === "broker" && currentRole === "investor") {
        setBrokerPendingApproval(true);
        setLoading(false);
        return;
      }
      setBrokerPendingApproval(false);

      if (currentRole === "broker" && !currentWorkspace.workspace) {
        const created = await apiService.bootstrapBrokerWorkspace({
          name: `${me.full_name || "Broker"} Workspace`,
        });
        currentWorkspace = { profile_role: "BROKER", workspace: created };
      }

      setUserType(currentRole);
      setWorkspace(currentWorkspace.workspace || null);
      setProfile({
        ...me,
        role: me.role,
        soul_key: currentWorkspace.workspace?.invite_code || null,
        linked_broker_id: currentWorkspace.workspace?.owner_profile_id || null,
        broker_name: currentWorkspace.workspace?.name || null,
      });

      setIsTethered(currentRole === "broker" || Boolean(currentWorkspace.workspace));
    } catch (e) {
      console.error("Session foundation load failed:", e);
      setSession(null);
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (typeof window !== "undefined") localStorage.removeItem("bkz_login_intent");
    setSession(null);
    setIsTethered(false);
    setWorkspace(null);
    setProfile(null);
    setBrokerPendingApproval(false);
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
      </div>
    );
  }

  if (!session) return null;

  if (brokerPendingApproval) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black p-6">
        <div className="w-full max-w-lg rounded border border-panel-border bg-panel p-8 text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded border border-amber-500/20 bg-amber-500/10 text-amber-400">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-amber-400">Đang chờ phê duyệt</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-zinc-400">
            Tài khoản <span className="text-zinc-100">{session?.user?.email}</span> chưa được cấp quyền Broker.
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-500">
            Liên hệ quản trị viên để được thêm vào danh sách Broker hoặc đăng nhập lại bằng tài khoản nhà đầu tư.
          </p>
          <button
            onClick={handleLogout}
            className="mt-6 rounded border border-panel-border bg-zinc-950 px-5 py-2 text-xs font-bold text-zinc-300 hover:border-primary/50"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    );
  }

  if (userType === "investor" && !isTethered) {
    return <TetherGate user={session?.user} onGateUnlock={loadFoundation} />;
  }

  const activeTab = getActiveTab();
  const pageTitle =
    activeTab === "intelligence" ? "Thị trường" :
    activeTab === "inquiry" ? "Hỏi đáp" :
    activeTab === "portfolio" ? "Danh mục" :
    "Cá nhân";
  const pageDescription =
    activeTab === "intelligence" ? "Bảng điều khiển dữ liệu thị trường, nhận định và nguồn dữ liệu." :
    activeTab === "inquiry" ? "Trao đổi giữa broker và nhà đầu tư." :
    activeTab === "portfolio" ? "Theo dõi danh mục và khuyến nghị đã publish." :
    "Quản lý thông tin tài khoản và kết nối workspace.";

  return (
    <main className="mx-auto min-h-screen max-w-[1440px] px-3 pb-8 pt-20 selection:bg-primary/30 md:px-5">
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab === "intelligence") router.push("/");
          else router.push(`/${tab}`);
        }}
        isBroker={userType === "broker"}
        onLogout={handleLogout}
        user={session?.user}
      />

      <div className="mb-3 rounded border border-panel-border bg-panel px-4 py-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase text-zinc-600">BROKERZ TERMINAL</div>
            <h1 className="mt-0.5 text-lg font-bold text-zinc-100">{pageTitle}</h1>
            <p className="mt-1 text-xs text-zinc-500">{pageDescription}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
            <span className="rounded border border-panel-border bg-zinc-950 px-2 py-1">
              {userType === "broker" ? "BROKER" : "INVESTOR"}
            </span>
            <span className="rounded border border-panel-border bg-zinc-950 px-2 py-1">
              {workspace?.name || "Workspace"}
            </span>
          </div>
        </div>
      </div>

      <UserContext.Provider value={{ user: session?.user, profile, workspace, isBroker: userType === "broker" }}>
        <div className={cn(activeTab === "intelligence" ? "relative opacity-100" : "invisible absolute -left-[9999px] -top-[9999px] opacity-0")}>
          {visitedTabs.has("intelligence") && <Dashboard isBroker={userType === "broker"} />}
        </div>

        <div className={cn(activeTab === "inquiry" ? "relative opacity-100" : "invisible absolute -left-[9999px] -top-[9999px] opacity-0")}>
          {visitedTabs.has("inquiry") && <InquiryHub user={session?.user} isBroker={userType === "broker"} profile={profile} />}
        </div>

        <div className={cn(activeTab === "portfolio" ? "relative opacity-100" : "invisible absolute -left-[9999px] -top-[9999px] opacity-0")}>
          {visitedTabs.has("portfolio") && <PortfolioView isBroker={userType === "broker"} user={session?.user} profile={profile} />}
        </div>

        <div className={cn(activeTab === "profile" ? "relative opacity-100" : "invisible absolute -left-[9999px] -top-[9999px] opacity-0")}>
          {visitedTabs.has("profile") && <ProfileHub isBroker={userType === "broker"} user={session?.user} profile={profile} />}
        </div>

        <div className="hidden">{children}</div>
      </UserContext.Provider>

      <div className="pointer-events-none fixed inset-0 -z-10 bg-background">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>
    </main>
  );
}
