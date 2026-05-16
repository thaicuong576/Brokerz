"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { TetherGate } from "@/components/TetherGate";
import { apiService } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { UserContext } from "@/context/UserContext";
import { cn } from "@/lib/utils";
import { Dashboard } from "@/components/Dashboard";
import { InquiryHub } from "@/components/InquiryHub";
import { PortfolioView } from "@/components/PortfolioView";
import { ProfileHub } from "@/components/ProfileHub";

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

  // Add the current tab to visited list whenever it changes
  useEffect(() => {
    const activeTab = getActiveTab();
    setVisitedTabs(prev => {
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
        router.push('/login');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setSession(session);
        loadFoundation();
      } else {
        setLoading(false);
        router.push('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, []); // Remove router from dependency to prevent re-runs on navigation

  const loadFoundation = async () => {
    setLoading(true);
    try {
      const me = await apiService.getMe();
      let currentWorkspace = await apiService.getCurrentWorkspace();
      const currentRole = me.role === "BROKER" ? "broker" : "investor";

      // Detect broker-pending state: user intended broker login but got INVESTOR from backend
      const loginIntent = typeof window !== 'undefined'
        ? localStorage.getItem('bkz_login_intent')
        : null;
      if (loginIntent === 'broker' && currentRole === 'investor') {
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

      if (currentRole === 'broker' || currentWorkspace.workspace) {
        setIsTethered(true);
      } else {
        setIsTethered(false);
      }
    } catch (e) {
      console.error("Session foundation load failed:", e);
      setSession(null);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (typeof window !== 'undefined') localStorage.removeItem('bkz_login_intent');
    setSession(null);
    setIsTethered(false);
    setWorkspace(null);
    setProfile(null);
    setBrokerPendingApproval(false);
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  if (brokerPendingApproval) {
    return (
      <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center p-6 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-amber-500/10 blur-[150px] rounded-full animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-amber-500/5 blur-[120px] rounded-full" />
        </div>
        <div className="w-full max-w-xl glass rounded-[48px] border border-white/5 p-12 relative overflow-hidden text-center">
          <div className="w-20 h-20 bg-amber-500/10 rounded-[32px] flex items-center justify-center mx-auto mb-8 border border-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.15)]">
            <svg className="w-10 h-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-3xl font-black tracking-tighter uppercase mb-4 text-amber-400">Đang Chờ Phê Duyệt</h2>
          <p className="text-muted-foreground font-medium mb-2 max-w-sm mx-auto">
            Tài khoản <span className="text-white">{session?.user?.email}</span> chưa được cấp quyền Broker.
          </p>
          <p className="text-muted-foreground text-sm mb-10 max-w-sm mx-auto">
            Liên hệ quản trị viên để được thêm vào danh sách Broker hoặc đăng nhập lại bằng tài khoản nhà đầu tư.
          </p>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 mx-auto text-[11px] text-muted-foreground uppercase font-black tracking-widest hover:text-white transition-colors border border-white/10 rounded-2xl px-6 py-3"
          >
            Đăng Xuất
          </button>
        </div>
      </div>
    );
  }

  if (userType === 'investor' && !isTethered) {
    return <TetherGate user={session?.user} onGateUnlock={loadFoundation} />;
  }

  return (
    <main className="min-h-screen pt-28 pb-12 px-4 md:px-8 max-w-[1440px] mx-auto selection:bg-primary/30">
      <Navbar 
        activeTab={getActiveTab()} 
        setActiveTab={(tab) => {
            if (tab === "intelligence") router.push("/");
            else router.push(`/${tab}`);
        }} 
        isBroker={userType === "broker"} 
        onLogout={handleLogout}
        user={session?.user}
      />

      <div className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-4xl font-black tracking-tighter sm:text-5xl md:text-6xl uppercase italic"
          >
            {getActiveTab() === "intelligence" && "Brokez"}
            {getActiveTab() === "inquiry" && "Hỏi đáp"}
            {getActiveTab() === "portfolio" && "Danh mục"}
            {getActiveTab() === "profile" && "Cá nhân"}
          </motion.h1>
          <motion.p 
             initial={{ opacity: 0, x: -20 }}
             animate={{ opacity: 1, x: 0 }}
             transition={{ delay: 0.1 }}
             className="text-muted-foreground mt-2 max-w-xl font-medium"
          >
            {getActiveTab() === "intelligence" && "Theo dõi biến động và dữ liệu thị trường thời gian thực."}
            {getActiveTab() === "inquiry" && "Hỗ trợ giải đáp thắc mắc và phân tích dữ liệu bằng AI."}
            {getActiveTab() === "portfolio" && "Theo dõi hiệu suất và tối ưu hóa danh mục đầu tư."}
            {getActiveTab() === "profile" && "Quản lý thông tin cá nhân và thiết lập tài khoản."}
          </motion.p>
        </div>
      </div>

      <div className="relative">
        <UserContext.Provider value={{ 
          user: session?.user, 
          profile, 
          workspace,
          isBroker: userType === "broker" 
        }}>
          {/* PERSISTENT TABS - Lazy loaded to save memory, then kept off-screen to preserve state */}
          <div className={cn(getActiveTab() === "intelligence" ? "relative opacity-100" : "absolute -left-[9999px] -top-[9999px] opacity-0 pointer-events-none invisible")}>
            {visitedTabs.has("intelligence") && <Dashboard isBroker={userType === "broker"} />}
          </div>
          
          <div className={cn(getActiveTab() === "inquiry" ? "relative opacity-100" : "absolute -left-[9999px] -top-[9999px] opacity-0 pointer-events-none invisible")}>
            {visitedTabs.has("inquiry") && (
              <InquiryHub 
                user={session?.user} 
                isBroker={userType === "broker"}
                profile={profile}
              />
            )}
          </div>

          <div className={cn(getActiveTab() === "portfolio" ? "relative opacity-100" : "absolute -left-[9999px] -top-[9999px] opacity-0 pointer-events-none invisible")}>
            {visitedTabs.has("portfolio") && (
              <PortfolioView 
                isBroker={userType === "broker"} 
                user={session?.user} 
                profile={profile}
              />
            )}
          </div>

          <div className={cn(getActiveTab() === "profile" ? "relative opacity-100" : "absolute -left-[9999px] -top-[9999px] opacity-0 pointer-events-none invisible")}>
            {visitedTabs.has("profile") && (
              <ProfileHub 
                isBroker={userType === "broker"} 
                user={session?.user} 
                profile={profile}
              />
            )}
          </div>

          {/* Fallback for other children if any */}
          <div className="hidden">{children}</div>
        </UserContext.Provider>
      </div>

      <div className="fixed top-0 left-0 -z-10 w-full h-full overflow-hidden pointer-events-none">
        <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] blur-[120px] rounded-full transition-all duration-1000 ${userType === 'broker' ? 'bg-primary/5' : 'bg-blue-500/5'}`} />
        <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-blue-500/5 blur-[100px] rounded-full" />
      </div>
    </main>
  );
}
