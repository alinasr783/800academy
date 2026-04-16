"use client";

import SiteHeader from "@/components/SiteHeader";
import Link from "next/link";
import { usePathname } from "next/navigation";
import DashboardGuard from "./DashboardGuard";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Determine if we should use full-width mode (hide sidebar)
  // Builder routes like /dashboard/exams/[id] or /dashboard/exams/questions/[id]
  const isBuilder =
    (pathname.startsWith("/dashboard/exams/") &&
      (pathname.includes("/questions/") || pathname.split("/").length > 3)) ||
    pathname.startsWith("/dashboard/exams/questions/");

  if (isBuilder) {
    return (
      <>
        <SiteHeader />
        <main className="pt-24 min-h-screen bg-slate-50">
          <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
            <DashboardGuard>{children}</DashboardGuard>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="pt-24 min-h-screen bg-slate-50">
        <div className="max-w-[1440px] mx-auto px-8 lg:px-12 py-12">
          <DashboardGuard>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <aside className="lg:col-span-3">
                <div className="bg-white border border-outline/60 shadow-soft-xl overflow-hidden rounded-2xl sticky top-32">
                  <div className="p-6 border-b border-outline/40 bg-slate-50/50">
                    <div className="text-xs font-black text-primary uppercase tracking-[0.2em]">
                      Admin Dashboard
                    </div>
                  </div>
                  <div className="p-2 flex flex-col">
                    {[
                      { href: "/dashboard", label: "Overview", icon: "dashboard" },
                      { href: "/dashboard/users", label: "Users", icon: "group" },
                      { href: "/dashboard/subscriptions", label: "Subscriptions", icon: "payments" },
                      { href: "/dashboard/packages", label: "Packages", icon: "inventory_2" },
                      { href: "/dashboard/exams", label: "Exams", icon: "quiz" },
                    ].map((item) => {
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-3 px-4 py-3 font-bold text-sm transition-all rounded-xl ${
                            isActive
                              ? "bg-primary text-white shadow-md shadow-primary/20"
                              : "text-on-surface hover:bg-surface-variant"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </aside>
              <section className="lg:col-span-9">{children}</section>
            </div>
          </DashboardGuard>
        </div>
      </main>
    </>
  );
}
