import SiteHeader from "@/components/SiteHeader";
import Link from "next/link";
import DashboardGuard from "./DashboardGuard";

export const metadata = {
  title: "Dashboard | 800 Academy",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="pt-24">
        <div className="max-w-[1440px] mx-auto px-8 lg:px-12 py-12">
          <DashboardGuard>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <aside className="lg:col-span-3">
                <div className="bg-white border border-outline/60 shadow-soft-xl overflow-hidden">
                  <div className="p-6 border-b border-outline/40">
                    <div className="text-xs font-bold text-primary uppercase tracking-widest">
                      Admin Dashboard
                    </div>
                  </div>
                  <div className="p-4 flex flex-col">
                    <Link
                      href="/dashboard"
                      className="px-4 py-3 font-bold text-sm text-on-surface hover:bg-surface-variant transition-all"
                    >
                      Overview
                    </Link>
                    <Link
                      href="/dashboard/users"
                      className="px-4 py-3 font-bold text-sm text-on-surface hover:bg-surface-variant transition-all"
                    >
                      Users
                    </Link>
                    <Link
                      href="/dashboard/subscriptions"
                      className="px-4 py-3 font-bold text-sm text-on-surface hover:bg-surface-variant transition-all"
                    >
                      Subscriptions
                    </Link>
                    <Link
                      href="/dashboard/packages"
                      className="px-4 py-3 font-bold text-sm text-on-surface hover:bg-surface-variant transition-all"
                    >
                      Packages
                    </Link>
                    <Link
                      href="/dashboard/exams"
                      className="px-4 py-3 font-bold text-sm text-on-surface hover:bg-surface-variant transition-all"
                    >
                      Exams
                    </Link>
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
