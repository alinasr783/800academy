"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { Drawer } from "vaul";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type NotifAction = { label: string; href: string };
type NotifItem = {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  actions: NotifAction[];
  is_read: boolean;
  created_at: string;
  notification_types: { name: string; icon: string; color: string } | null;
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
export default function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const { data: notifData, isLoading: loading } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return { items: [], unreadCount: 0 };
      const res = await fetch("/api/notifications", {
        headers: { Authorization: `Bearer ${sess.session.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!userId,
  });

  const items = notifData?.items ?? [];
  const unreadCount = notifData?.unreadCount ?? 0;

  // Real-time subscription
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifs-${userId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
        queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "notification_reads", filter: `user_id=eq.${userId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      await fetch("/api/notifications", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "mark_read", notification_id: notificationId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;
      await fetch("/api/notifications", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "mark_read", all: true }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
    },
  });

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize(); // set initial
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close on outside click (desktop)
  useEffect(() => {
    if (!open || isMobile) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, isMobile]);

  async function markRead(notificationId: string) {
    markReadMutation.mutate(notificationId);
  }

  async function markAllRead() {
    markAllReadMutation.mutate();
  }

  function handleToggle() {
    setOpen((prev) => !prev);
  }

  const renderNotifItem = (n: NotifItem) => {
    const icon = n.notification_types?.icon || "notifications";
    const color = n.notification_types?.color || "#64748b";

    return (
      <div
        key={n.id}
        className={`px-5 py-4 border-b border-outline/30 last:border-0 transition-colors ${!n.is_read ? "bg-primary/[0.03]" : "hover:bg-surface-variant/30"}`}
        onClick={() => { if (!n.is_read) markRead(n.id); }}
      >
        <div className="flex gap-3">
          {/* Icon */}
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: color + "18" }}>
            <span className="material-symbols-outlined text-[20px]" style={{ color, fontVariationSettings: "'FILL' 1" }}>{icon}</span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className={`text-sm font-bold leading-snug ${!n.is_read ? "text-primary" : "text-on-surface"}`}>{n.title}</h4>
              {!n.is_read && <div className="w-2 h-2 bg-secondary rounded-full flex-shrink-0 mt-1.5" />}
            </div>
            {n.body && <p className="text-xs text-on-surface-variant mt-1 leading-relaxed line-clamp-2">{n.body}</p>}
            {/* Action Buttons */}
            {n.actions && n.actions.length > 0 && (
              <div className="flex gap-2 mt-2.5">
                {n.actions.map((a, i) => (
                  <Link
                    key={i}
                    href={a.href}
                    onClick={(e) => { e.stopPropagation(); setOpen(false); }}
                    className={`px-4 py-1.5 text-xs font-bold rounded-full transition-colors ${
                      i === 0
                        ? "text-white hover:opacity-90"
                        : "bg-surface-variant text-primary hover:bg-outline/20"
                    }`}
                    style={i === 0 ? { backgroundColor: color } : undefined}
                  >
                    {a.label}
                  </Link>
                ))}
              </div>
            )}
            <span className="text-[10px] text-on-surface-variant/60 mt-2 block">{timeAgo(n.created_at)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      className="relative group/notif" 
      ref={panelRef}
      onMouseEnter={() => !isMobile && setOpen(true)}
      onMouseLeave={() => !isMobile && setOpen(false)}
    >
      {/* Trigger Button */}
      <button
        onClick={handleToggle}
        className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-variant/60 transition-colors z-[60]"
        title="Notifications"
        aria-label="Notifications"
      >
        <span className="material-symbols-outlined text-[20px] text-on-surface-variant">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* ─── Desktop Dropdown (md+) ─── */}
      {open && !isMobile && (
        <div className="absolute right-0 top-[calc(100%-8px)] pt-4 z-50">
          <div className="w-[400px] bg-white border border-outline/40 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200 ease-out origin-top-right">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline/30 bg-surface-variant/30">
              <h3 className="font-headline font-bold text-primary text-base">Notifications</h3>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs font-bold text-secondary hover:text-primary transition-colors">
                  Mark all as read
                </button>
              )}
            </div>
            {/* List */}
            <div className="overflow-y-auto max-h-[calc(100vh-160px)] custom-scrollbar">
              {loading ? (
                <div className="p-8 text-center text-on-surface-variant text-sm italic">Synchronizing...</div>
              ) : items.length === 0 ? (
                <div className="p-8 text-center">
                  <span className="material-symbols-outlined text-[40px] text-outline/60 mb-2">notifications_off</span>
                  <p className="text-sm text-on-surface-variant">No notifications yet.</p>
                </div>
              ) : (
                items.map(renderNotifItem)
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Mobile Bottom Sheet (<md) ─── */}
      {isMobile && (
        <Drawer.Root open={open} onOpenChange={(v) => setOpen(v)}>
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]" />
            <Drawer.Content className="bg-white flex flex-col rounded-t-[32px] mt-24 max-h-[90vh] fixed bottom-0 left-0 right-0 z-[60] focus:outline-none">
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-12 h-1.5 bg-outline/60 rounded-full" />
              </div>

              {/* Header */}
              <div className="px-6 py-4 border-b border-outline/30">
                <div className="flex items-center justify-between">
                  <Drawer.Title className="font-headline font-bold text-primary text-lg">Announcements</Drawer.Title>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-xs font-bold text-secondary hover:text-primary transition-colors">
                      Mark all as read
                    </button>
                  )}
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5">Latest updates from 800 Academy</p>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto pb-6">
                {loading ? (
                  <div className="p-8 text-center text-on-surface-variant text-sm">Loading…</div>
                ) : items.length === 0 ? (
                  <div className="p-10 text-center">
                    <span className="material-symbols-outlined text-[48px] text-outline/60 mb-3">notifications_off</span>
                    <p className="text-sm text-on-surface-variant">No notifications yet.</p>
                  </div>
                ) : (
                  items.map(renderNotifItem)
                )}
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      )}
    </div>
  );
}
