"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { id: "home", label: "Home", href: "/profile", icon: "home" },
  { id: "plans", label: "Plans", href: "/#plans", icon: "payments" },
  { id: "mistakes", label: "Mistakes Bank", href: "/profile/mistake-bank", icon: "history_edu" },
  { id: "questions", label: "Question Bank", href: "/profile/brain-gym", icon: "quiz" },
  { id: "lessons", label: "Lessons", href: "/lessons", icon: "school" },
  { id: "simulation", label: "Simulations", href: "/simulation", icon: "assignment" },
];

export default function AppSidebar() {
  const [isAppMode, setIsAppMode] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const check = () => setIsAppMode(localStorage.getItem("isAppMode") === "true");
    check();
    window.addEventListener("appModeChange", check);
    
    const handleToggle = () => setMobileOpen(v => !v);
    window.addEventListener("toggleAppSidebar", handleToggle);

    return () => {
      window.removeEventListener("appModeChange", check);
      window.removeEventListener("toggleAppSidebar", handleToggle);
    };
  }, []);

  if (!isAppMode) return null;

  const renderLinks = (isMobile = false) => (
    <div className="space-y-1 px-3">
      {navLinks.map((link) => {
        const active = pathname === link.href || (link.id === 'home' && pathname === '/profile');
        return (
          <Link
            key={link.id}
            href={link.href}
            onClick={() => isMobile && setMobileOpen(false)}
            className={`flex items-center gap-4 px-3 py-3 rounded-2xl transition-all duration-300 group/item ${
              active 
                ? "bg-primary text-white shadow-lg shadow-primary/10" 
                : "hover:bg-primary/[0.04] text-on-surface-variant hover:text-primary"
            }`}
          >
            <span className={`material-symbols-outlined text-[24px] flex-shrink-0 transition-transform duration-300 ${active ? "" : "group-hover/item:scale-110"}`}>
              {link.icon}
            </span>
            <span className={`text-sm font-bold whitespace-nowrap transition-all duration-300 ${!isMobile ? "opacity-0 group-hover:opacity-100 lg:w-0 lg:group-hover:w-auto overflow-hidden" : ""}`}>
              {link.label}
            </span>
          </Link>
        );
      })}
    </div>
  );

  return (
    <>
      {/* ─── Desktop Sidebar (Fixed Left, Collapsed to Hover-Expand) ─── */}
      <aside className="fixed left-0 top-0 bottom-0 z-40 hidden lg:flex flex-col pt-16 transition-all duration-300 w-[72px] hover:w-64 bg-white border-r border-outline/30 group">
        <div className="flex-1 py-6">
          {renderLinks()}
        </div>

        <div className="p-4 border-t border-outline/20">
           <button 
             onClick={() => {
               localStorage.setItem("isAppMode", "false");
               window.dispatchEvent(new Event("appModeChange"));
               window.location.reload();
             }}
             className="w-full flex items-center gap-4 px-3 py-3 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-50 transition-colors overflow-hidden group/exit"
           >
             <span className="material-symbols-outlined text-[20px] flex-shrink-0">logout</span>
             <span className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Exit App Mode</span>
           </button>
        </div>
      </aside>

      {/* ─── Mobile Sidebar (Drawer) ─── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <div className="absolute inset-y-0 left-0 w-[280px] bg-white shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
            <div className="p-6 border-b border-outline/30 flex items-center justify-between">
              <h3 className="font-headline font-black text-xl text-primary">Menu</h3>
              <button onClick={() => setMobileOpen(false)} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-variant transition-colors">
                 <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex-1 py-6 overflow-y-auto">
              {renderLinks(true)}
            </div>
            <div className="p-6 border-t border-outline/30">
               <button 
                 onClick={() => {
                   localStorage.setItem("isAppMode", "false");
                   window.dispatchEvent(new Event("appModeChange"));
                   window.location.reload();
                 }}
                 className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-rose-50 text-rose-600 font-bold text-sm"
               >
                 <span className="material-symbols-outlined">logout</span>
                 Exit App Mode
               </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
