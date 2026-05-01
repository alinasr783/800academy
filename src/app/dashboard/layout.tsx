"use client";

import { useState, useEffect } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import DashboardGuard from "./DashboardGuard";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Disable App Mode automatically when entering dashboard
  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("isAppMode") === "true") {
      localStorage.setItem("isAppMode", "false");
      window.dispatchEvent(new Event("appModeChange"));
    }
  }, []);

  // Determine if we should use full-width mode (hide sidebar)
  // Builder routes like /dashboard/exams/[id] or /dashboard/exams/questions/[id]
  const isBuilder =
    (pathname.startsWith("/dashboard/exams/") &&
      (pathname.includes("/questions/") || pathname.split("/").length > 3)) ||
    pathname.startsWith("/dashboard/exams/questions/");

  if (isBuilder) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
          <DashboardGuard>{children}</DashboardGuard>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1440px] mx-auto px-8 lg:px-12 py-12">
          <DashboardGuard>
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
              <aside className={`transition-all duration-300 flex-shrink-0 ${isCollapsed ? "w-[88px]" : "w-full lg:w-72"}`}>
                <div className="bg-white border border-outline/60 shadow-soft-xl overflow-hidden rounded-2xl sticky top-32">
                  <div className="p-4 sm:p-6 border-b border-outline/40 bg-slate-50/50 flex items-center justify-between">
                    {!isCollapsed && (
                      <div className="text-xs font-black text-primary uppercase tracking-[0.2em]">
                        Admin
                      </div>
                    )}
                    <button 
                      onClick={() => setIsCollapsed(!isCollapsed)}
                      className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-variant transition-colors mx-auto lg:mx-0"
                      title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {isCollapsed ? "menu_open" : "menu_open"}
                      </span>
                    </button>
                  </div>
                  <div className="p-2 flex flex-col">
                    {[
                      { href: "/dashboard", label: "Overview", icon: "dashboard" },
                      { href: "/dashboard/users", label: "Users", icon: "group" },
                      { href: "/dashboard/subscriptions", label: "Subscriptions", icon: "payments" },
                      { href: "/dashboard/packages", label: "Packages", icon: "inventory_2" },
                      { href: "/dashboard/exams", label: "Exams", icon: "quiz" },
                      { href: "/dashboard/questions", label: "Questions Bank", icon: "database" },
                      { href: "/dashboard/topics", label: "Topics", icon: "category" },
                      { href: "/dashboard/topics-management", label: "Lessons", icon: "school" },
                      { href: "/dashboard/coupons", label: "Coupons", icon: "local_offer" },
                      { href: "/dashboard/notifications", label: "Notifications", icon: "notifications" },
                      { href: "/dashboard/notification-types", label: "Notif. Types", icon: "category" },
                      { href: "/dashboard/ips", label: "IP Blacklist", icon: "block" },
                    ].map((item) => {
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          title={isCollapsed ? item.label : undefined}
                          className={`flex items-center gap-3 px-4 py-3 font-bold text-sm transition-all rounded-xl ${
                            isCollapsed ? "justify-center px-0 mx-2" : ""
                          } ${
                            isActive
                              ? "bg-primary text-white shadow-md shadow-primary/20"
                              : "text-on-surface hover:bg-surface-variant"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                          {!isCollapsed && <span>{item.label}</span>}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </aside>
              <section className="flex-1 min-w-0 transition-all duration-300">{children}</section>
            </div>
          </DashboardGuard>
      </div>
    </main>
  );
}
