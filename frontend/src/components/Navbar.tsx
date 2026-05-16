"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { 
  Activity, 
  Layout, 
  BarChart3, 
  User, 
  Bell, 
  ChevronDown, 
  ShieldCheck,
  Zap,
  Globe,
  LogOut,
  HelpCircle,
  Check,
  CheckCheck,
  TrendingUp,
  MessageCircle,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiService } from "@/lib/api";
import { AnimatePresence, motion } from "framer-motion";

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isBroker: boolean;
  onLogout: () => void;
  user?: any;
}

export function Navbar({ activeTab, setActiveTab, isBroker, onLogout, user }: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadNotifications();
      const interval = setInterval(loadNotifications, 30000); // Poll every 30s
      return () => clearInterval(interval);
    }
  }, [user?.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadNotifications = async () => {
    try {
      const data = await apiService.getNotifications(user.id);
      if (Array.isArray(data)) {
        setNotifications(data);
        setUnreadCount(data.filter((n: any) => !n.is_read).length);
      }
    } catch (err) {
      console.error("Failed to load notifications:", err);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await apiService.markNotificationRead(id);
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await apiService.markAllNotificationsRead(user.id);
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case "RECOMMENDATION": return <TrendingUp className="w-4 h-4 text-primary" />;
      case "INQUIRY_REPLY": return <MessageCircle className="w-4 h-4 text-blue-400" />;
      default: return <Bell className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const displayName = user?.user_metadata?.full_name?.split(' ').slice(-2).join(' ') || user?.user_metadata?.given_name || user?.email?.split('@')[0] || "User";
  const roleLabel = isBroker ? "Broker" : "Nhà đầu tư";

  const tabs = [
    { id: 'intelligence', label: 'Thị trường', icon: BarChart3 },
    { id: 'portfolio', label: 'Danh Mục', icon: Layout },
    { id: 'inquiry', label: 'Góc hỏi đáp', icon: HelpCircle },
    { id: 'profile', label: 'Cá Nhân', icon: User },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 md:pt-6 px-4 md:px-6 pointer-events-none">
      <div className={cn(
        "flex items-center gap-4 md:gap-8 px-4 md:px-8 py-3 glass rounded-2xl md:rounded-[32px] border border-white/5 transition-all duration-500 pointer-events-auto shadow-2xl max-w-full",
        isScrolled ? "scale-95 py-2" : "scale-100"
      )}>
        {/* LOGO SECTION */}
        <div className="flex items-center gap-2 md:gap-3 pr-4 md:pr-6 border-r border-white/5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center shadow-[0_0_20px_rgba(0,240,255,0.3)]">
            <Activity className="w-5 h-5 text-black" />
          </div>
          <div className="hidden sm:flex flex-col">
            <span className="text-xl font-black tracking-tighter text-white uppercase italic leading-none">Brokez</span>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.id === 'intelligence' ? '/' : `/${tab.id}`}
              className={cn(
                "relative flex items-center gap-2 px-3 md:px-5 py-2.5 rounded-2xl transition-all duration-300 group shrink-0",
                activeTab === tab.id 
                  ? "bg-primary text-black shadow-[0_0_20px_rgba(0,240,255,0.2)]" 
                  : "text-muted-foreground hover:text-white hover:bg-white/5"
              )}
            >
              <tab.icon className={cn(
                "w-4 h-4 transition-transform duration-300 group-hover:scale-110",
                activeTab === tab.id ? "text-black" : "text-muted-foreground group-hover:text-primary"
              )} />
              <span className="text-[10px] font-black uppercase tracking-widest hidden lg:inline-block">{tab.label}</span>
              
              {activeTab === tab.id && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute inset-0 bg-primary rounded-2xl -z-10"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </Link>
          ))}
        </div>

        {/* STATUS & ACTIONS */}
        <div className="flex items-center gap-2 md:gap-4 pl-4 md:pl-6 border-l border-white/5 shrink-0">
          <div className="hidden md:flex flex-col items-end">
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">XIN CHÀO,</span>
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            </div>
            <span className="text-[10px] font-black text-white uppercase tracking-tight">{roleLabel} {displayName}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={onLogout}
              className="p-2 md:p-2.5 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 transition-all group"
              title="Log Out"
            >
              <LogOut className="w-4 h-4" />
            </button>

            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className={cn(
                  "flex p-2 md:p-2.5 rounded-xl border transition-all relative",
                  showNotifications ? "bg-primary/20 border-primary/30 text-primary" : "bg-white/5 text-muted-foreground border-white/5 hover:bg-white/10"
                )}
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full border border-black animate-pulse" />
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-80 glass border border-white/10 rounded-[32px] shadow-2xl overflow-hidden z-[100]"
                  >
                    <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-white">Thông báo</span>
                      {unreadCount > 0 && (
                        <button 
                          onClick={handleMarkAllAsRead}
                          className="text-[9px] font-black uppercase tracking-widest text-primary hover:opacity-80 flex items-center gap-1"
                        >
                          <CheckCheck className="w-3 h-3" />
                          Đọc tất cả
                        </button>
                      )}
                    </div>
                    <div className="max-h-96 overflow-y-auto scrollbar-thin">
                      {notifications.length === 0 ? (
                        <div className="p-10 text-center">
                          <Bell className="w-8 h-8 text-white/5 mx-auto mb-3" />
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Không có thông báo mới</p>
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div 
                            key={n.id}
                            onClick={() => handleMarkAsRead(n.id)}
                            className={cn(
                              "p-4 border-b border-white/5 hover:bg-white/5 transition-all cursor-pointer relative group",
                              !n.is_read && "bg-primary/5"
                            )}
                          >
                            <div className="flex gap-3">
                              <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                                {getNotifIcon(n.type)}
                              </div>
                              <div className="flex-1">
                                <p className="text-[11px] font-black text-white uppercase tracking-tight mb-0.5">{n.title}</p>
                                <p className="text-[10px] text-muted-foreground font-medium leading-relaxed mb-2">{n.message}</p>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 text-[8px] text-muted-foreground font-black uppercase tracking-widest">
                                    <Clock className="w-2.5 h-2.5" />
                                    {new Date(n.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                  {!n.is_read && <div className="w-1.5 h-1.5 bg-primary rounded-full" />}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    {notifications.length > 0 && (
                      <div className="p-4 bg-white/5 text-center">
                        <button className="text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-white transition-colors">
                          Xem tất cả thông báo
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
