"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Activity, BarChart3, Bell, CheckCheck, Clock, HelpCircle, Layout, LogOut, MessageCircle, User } from "lucide-react";

import { apiService } from "@/lib/api";
import { cn } from "@/lib/utils";

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isBroker: boolean;
  onLogout: () => void;
  user?: any;
}

const tabs = [
  { id: "intelligence", label: "Thị trường", icon: BarChart3, href: "/" },
  { id: "portfolio", label: "Danh mục", icon: Layout, href: "/portfolio" },
  { id: "inquiry", label: "Hỏi đáp", icon: HelpCircle, href: "/inquiry" },
  { id: "profile", label: "Cá nhân", icon: User, href: "/profile" },
];

export function Navbar({ activeTab, isBroker, onLogout, user }: NavbarProps) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const displayName =
    user?.user_metadata?.full_name?.split(" ").slice(-2).join(" ") ||
    user?.user_metadata?.given_name ||
    user?.email?.split("@")[0] ||
    "Người dùng";
  const roleLabel = isBroker ? "Broker" : "Nhà đầu tư";

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-panel-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-4 px-3 md:px-5">
        <Link href="/" className="flex shrink-0 items-center gap-2 border-r border-panel-border pr-4">
          <div className="flex h-8 w-8 items-center justify-center rounded border border-primary/30 bg-primary/10 text-primary">
            <Activity className="h-4 w-4" />
          </div>
          <span className="hidden text-base font-semibold text-zinc-100 sm:inline">Brokerz</span>
        </Link>

        <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded px-3 py-2 text-xs font-semibold transition-colors",
                activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-zinc-400 hover:bg-muted hover:text-zinc-100"
              )}
            >
              <tab.icon className="h-4 w-4" />
              <span className="hidden md:inline">{tab.label}</span>
            </Link>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden text-right md:block">
            <div className="text-[10px] text-zinc-500">{roleLabel}</div>
            <div className="max-w-40 truncate text-xs font-semibold text-zinc-100">{displayName}</div>
          </div>

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowNotifications((value) => !value)}
              className={cn(
                "relative rounded border p-2 transition-colors",
                showNotifications ? "border-primary/40 bg-primary/10 text-primary" : "border-panel-border bg-panel text-zinc-400 hover:text-zinc-100"
              )}
              title="Thông báo"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-market-down" />}
            </button>

            {showNotifications && (
              <div className="absolute right-0 z-[100] mt-2 w-80 overflow-hidden rounded border border-panel-border bg-panel">
                <div className="flex items-center justify-between border-b border-panel-border bg-background px-3 py-2">
                  <span className="text-xs font-semibold text-zinc-100">Thông báo</span>
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllAsRead} className="flex items-center gap-1 text-[11px] font-semibold text-primary">
                      <CheckCheck className="h-3 w-3" />
                      Đọc tất cả
                    </button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center">
                      <Bell className="mx-auto mb-3 h-7 w-7 text-zinc-700" />
                      <p className="text-xs text-zinc-500">Không có thông báo mới</p>
                    </div>
                  ) : (
                    notifications.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleMarkAsRead(item.id)}
                        className={cn(
                          "w-full border-b border-panel-border p-3 text-left transition-colors hover:bg-muted",
                          !item.is_read && "bg-primary/5"
                        )}
                      >
                        <div className="flex gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-panel-border bg-background text-primary">
                            {item.type === "INQUIRY_REPLY" ? <MessageCircle className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-zinc-100">{item.title}</p>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-400">{item.message}</p>
                            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-zinc-500">
                              <Clock className="h-3 w-3" />
                              {new Date(item.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={onLogout}
            className="rounded border border-panel-border bg-panel p-2 text-zinc-400 transition-colors hover:border-market-down/40 hover:text-market-down"
            title="Đăng xuất"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}
