"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Activity, BarChart3, Bell, CheckCheck, Clock, HelpCircle, Layout, LogOut, MessageCircle, TrendingUp, User } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { apiService } from "@/lib/api";
import { cn } from "@/lib/utils";

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isBroker: boolean;
  onLogout: () => void;
  user?: any;
}

export function Navbar({ activeTab, isBroker, onLogout, user }: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
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
        setUnreadCount(data.filter((item: any) => !item.is_read).length);
      }
    } catch (err) {
      console.error("Không tải được thông báo", err);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await apiService.markNotificationRead(id);
      setNotifications((items) => items.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
      setUnreadCount((value) => Math.max(0, value - 1));
    } catch (err) {
      console.error("Không đánh dấu được thông báo", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await apiService.markAllNotificationsRead(user.id);
      setNotifications((items) => items.map((item) => ({ ...item, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Không đánh dấu được tất cả thông báo", err);
    }
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case "RECOMMENDATION":
        return <TrendingUp className="h-4 w-4 text-primary" />;
      case "INQUIRY_REPLY":
        return <MessageCircle className="h-4 w-4 text-primary" />;
      default:
        return <Bell className="h-4 w-4 text-zinc-500" />;
    }
  };

  const displayName =
    user?.user_metadata?.full_name?.split(" ").slice(-2).join(" ") ||
    user?.user_metadata?.given_name ||
    user?.email?.split("@")[0] ||
    "Người dùng";
  const roleLabel = isBroker ? "Broker" : "Nhà đầu tư";

  const tabs = [
    { id: "intelligence", label: "Thị trường", icon: BarChart3 },
    { id: "portfolio", label: "Danh mục", icon: Layout },
    { id: "inquiry", label: "Hỏi đáp", icon: HelpCircle },
    { id: "profile", label: "Cá nhân", icon: User },
  ];

  return (
    <nav className="pointer-events-none fixed left-0 right-0 top-0 z-50 flex justify-center px-4 pt-4 md:px-6 md:pt-6">
      <div
        className={cn(
          "pointer-events-auto flex max-w-full items-center gap-3 rounded-lg border border-panel-border bg-panel/95 px-4 py-3 shadow-2xl backdrop-blur md:gap-6 md:px-6",
          isScrolled ? "scale-95 py-2" : "scale-100"
        )}
      >
        <div className="flex shrink-0 items-center gap-3 border-r border-panel-border pr-4">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary">
            <Activity className="h-5 w-5 text-zinc-950" />
          </div>
          <span className="hidden text-lg font-bold text-zinc-100 sm:inline">Brokerz</span>
        </div>

        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto py-1">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.id === "intelligence" ? "/" : `/${tab.id}`}
              className={cn(
                "relative flex shrink-0 items-center gap-2 rounded px-3 py-2.5 transition-colors md:px-4",
                activeTab === tab.id ? "bg-primary text-zinc-950" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
              )}
            >
              <tab.icon className="h-4 w-4" />
              <span className="hidden text-[10px] font-bold uppercase lg:inline-block">{tab.label}</span>
              {activeTab === tab.id && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute inset-0 -z-10 rounded bg-primary"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </Link>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2 border-l border-panel-border pl-4 md:gap-3">
          <div className="hidden flex-col items-end md:flex">
            <span className="text-[8px] font-bold uppercase text-zinc-500">Xin chào</span>
            <span className="text-[10px] font-bold uppercase text-zinc-100">
              {roleLabel} {displayName}
            </span>
          </div>

          <button
            onClick={onLogout}
            className="rounded border border-market-down/20 bg-market-down/10 p-2 text-market-down transition-colors hover:bg-market-down/20"
            title="Đăng xuất"
          >
            <LogOut className="h-4 w-4" />
          </button>

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowNotifications((value) => !value)}
              className={cn(
                "relative rounded border p-2 transition-colors",
                showNotifications ? "border-primary/30 bg-primary/10 text-primary" : "border-panel-border bg-zinc-900 text-zinc-400 hover:text-zinc-100"
              )}
              title="Thông báo"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-market-down" />
              )}
            </button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.96 }}
                  className="absolute right-0 z-[100] mt-3 w-80 overflow-hidden rounded-lg border border-panel-border bg-panel shadow-2xl"
                >
                  <div className="flex items-center justify-between border-b border-panel-border bg-zinc-900 p-4">
                    <span className="text-[10px] font-bold uppercase text-zinc-100">Thông báo</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllAsRead}
                        className="flex items-center gap-1 text-[9px] font-bold uppercase text-primary hover:opacity-80"
                      >
                        <CheckCheck className="h-3 w-3" />
                        Đọc tất cả
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-10 text-center">
                        <Bell className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
                        <p className="text-[10px] font-medium uppercase text-zinc-500">Không có thông báo mới</p>
                      </div>
                    ) : (
                      notifications.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => handleMarkAsRead(item.id)}
                          className={cn(
                            "cursor-pointer border-b border-panel-border p-4 transition-colors hover:bg-zinc-900",
                            !item.is_read && "bg-primary/5"
                          )}
                        >
                          <div className="flex gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-panel-border bg-zinc-900">
                              {getNotifIcon(item.type)}
                            </div>
                            <div className="flex-1">
                              <p className="mb-0.5 text-[11px] font-bold uppercase text-zinc-100">{item.title}</p>
                              <p className="mb-2 text-[10px] leading-relaxed text-zinc-400">{item.message}</p>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-[8px] font-bold uppercase text-zinc-500">
                                  <Clock className="h-2.5 w-2.5" />
                                  {new Date(item.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                                </div>
                                {!item.is_read && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </nav>
  );
}
