"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type WeekDay = {
  date: string;
  dayName: string;
  active: boolean;
};

type StreakData = {
  currentStreak: number;
  longestStreak: number;
  weekStatus: WeekDay[];
};

export default function StreakPanel() {
  const [open, setOpen] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
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

  const { data, isLoading } = useQuery<StreakData>({
    queryKey: ["streak", userId],
    queryFn: async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return { currentStreak: 0, longestStreak: 0, weekStatus: [] };
      const res = await fetch("/api/user/streak", {
        headers: { Authorization: `Bearer ${sess.session.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch streak");
      return res.json();
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const currentStreak = data?.currentStreak ?? 0;
  const weekStatus = data?.weekStatus ?? [];

  const handleToggle = () => setOpen(!open);

  const renderDropdownContent = () => (
    <>
      {/* Header Card */}
      <div className="p-6 bg-gradient-to-br from-orange-50 to-orange-100/50 relative overflow-hidden">
        {/* Background blob */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-orange-200/30 rounded-full blur-3xl" />
        
        <div className="relative flex flex-col items-center text-center">
          <div className="flex items-center gap-2">
            <span className="text-5xl font-black text-orange-600 leading-none">{currentStreak}</span>
            <span className="material-symbols-outlined text-orange-500 text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
          </div>
          <div className="text-sm font-black text-orange-800/60 mt-2 uppercase tracking-[0.2em]">Day Streak</div>
        </div>

        {/* Week Status */}
        <div className="mt-8 flex justify-between items-center gap-1">
          {weekStatus.map((day, idx) => {
            const isToday = day.date === new Date().toISOString().split('T')[0];
            return (
              <div key={idx} className="flex flex-col items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  day.active 
                    ? "bg-orange-500 text-white shadow-md shadow-orange-200" 
                    : isToday ? "border-2 border-orange-500/30 text-orange-500/50" : "text-on-surface-variant/30"
                }`}>
                  {day.active ? (
                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
                  ) : (
                    <span className="text-[10px] font-black">{day.dayName[0]}</span>
                  )}
                </div>
                <span className={`text-[10px] font-bold ${isToday ? "text-orange-600" : "text-on-surface-variant/40"}`}>
                  {day.dayName[0]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* FAQ Accordion */}
      <div className="p-2 border-t border-outline/30">
        <button
          onClick={() => setShowHowItWorks(!showHowItWorks)}
          className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-surface-variant/50 transition-colors group"
        >
          <span className="text-sm font-bold text-primary group-hover:translate-x-1 transition-transform">How do streaks work?</span>
          <span className={`material-symbols-outlined text-on-surface-variant transition-transform ${showHowItWorks ? "rotate-180" : ""}`}>expand_more</span>
        </button>
        
        {showHowItWorks && (
          <div className="px-4 pb-4 pt-1 space-y-3 animate-in fade-in slide-in-from-top-1">
            {[
              { icon: "star", text: "Complete at least one question each day to build your streak." },
              { icon: "psychology", text: "A streak can help you build a consistent study habit." },
              { icon: "refresh", text: "Missing a day will reset your streak to 0." }
            ].map((item, i) => (
              <div key={i} className="flex gap-3">
                <span className="material-symbols-outlined text-[18px] text-orange-500 mt-0.5">{item.icon}</span>
                <p className="text-xs text-on-surface-variant leading-relaxed font-medium">{item.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );

  return (
    <div 
      className="relative group/streak" 
      ref={panelRef}
      onMouseEnter={() => !isMobile && setOpen(true)}
      onMouseLeave={() => !isMobile && setOpen(false)}
    >
      {/* Trigger Button */}
      <button
        onClick={handleToggle}
        className="flex items-center gap-1.5 px-3 h-9 rounded-full hover:bg-surface-variant/60 transition-all border border-outline/20 bg-white/50 z-[60] relative"
      >
        <span 
          className={`material-symbols-outlined text-[20px] transition-all duration-500 ${currentStreak > 0 ? "text-orange-500 scale-110" : "text-on-surface-variant/40"}`}
          style={{ fontVariationSettings: currentStreak > 0 ? "'FILL' 1" : "'FILL' 0" }}
        >
          local_fire_department
        </span>
        <span className={`text-sm font-extrabold tabular-nums ${currentStreak > 0 ? "text-primary" : "text-on-surface-variant/60"}`}>
          {currentStreak}
        </span>
      </button>

      {/* Dropdown */}
      {open && !isMobile && (
        <div className="absolute right-0 top-[calc(100%-8px)] pt-4 z-50">
          <div className="w-[320px] bg-white border border-outline/40 rounded-[28px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200 ease-out origin-top-right">
            {renderDropdownContent()}
          </div>
        </div>
      )}
      {/* ─── Mobile Dropdown (<md) ─── */}
      {open && isMobile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-[340px] bg-white rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Mobile Header with Close */}
            <div className="absolute top-4 right-4 z-10">
              <button onClick={() => setOpen(false)} className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all">
                <span className="material-symbols-outlined text-primary">close</span>
              </button>
            </div>
            
            {renderDropdownContent()}
          </div>
        </div>
      )}
    </div>
  );
}
