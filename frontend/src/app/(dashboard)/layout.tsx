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
    setSession(null);
    setIsTethered(false);
    setWorkspace(null);
    setProfile(null);
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
