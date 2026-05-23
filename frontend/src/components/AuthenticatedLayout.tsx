"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { TetherGate } from "@/components/TetherGate";
import { apiService } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { UserContext } from "@/context/UserContext";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [userType, setUserType] = useState<"broker" | "investor">("investor");
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isTethered, setIsTethered] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  // Map pathname to activeTab for Navbar
  const getActiveTab = () => {
    if (pathname === "/") return "intelligence";
    if (pathname.startsWith("/inquiry")) return "inquiry";
    if (pathname.startsWith("/portfolio")) return "portfolio";
    if (pathname.startsWith("/profile")) return "profile";
    return "intelligence";
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);

      if (currentSession?.user) {
        checkTether(currentSession.user.id, currentSession.user.user_metadata);
      } else {
        setLoading(false);
        router.push('/login');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        checkTether(newSession.user.id, newSession.user.user_metadata);
      } else {
        setLoading(false);
        router.push('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const checkTether = async (userId: string, metadata?: any) => {
    setLoading(true);
    try {
      const profileData = await apiService.getProfile(
        userId, 
        undefined, 
        metadata?.full_name || metadata?.name, 
        metadata?.avatar_url || metadata?.picture
      );
      
      const currentRole = profileData?.role?.toLowerCase() || "investor";
      setUserType(currentRole as any);
      setProfile(profileData);

      if (currentRole === 'broker' || profileData?.linked_broker_id) {
        setIsTethered(true);
      } else {
        setIsTethered(false);
      }
    } catch (e) {
      console.error("Tether check failed:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setIsTethered(false);
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
    return <TetherGate user={session?.user} onGateUnlock={() => setIsTethered(true)} />;
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
            {getActiveTab() === "intelligence" && "Brokerz"}
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

      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <UserContext.Provider value={{ 
            user: session?.user, 
            profile, 
            isBroker: userType === "broker" 
          }}>
            {children}
          </UserContext.Provider>
        </motion.div>
      </AnimatePresence>

      <div className="fixed top-0 left-0 -z-10 w-full h-full overflow-hidden pointer-events-none">
        <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] blur-[120px] rounded-full transition-all duration-1000 ${userType === 'broker' ? 'bg-primary/5' : 'bg-blue-500/5'}`} />
        <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-blue-500/5 blur-[100px] rounded-full" />
      </div>
    </main>
  );
}
