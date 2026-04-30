"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import logo from "@/app/logo.png";
import { supabase } from "@/lib/supabaseClient";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationPanel from "@/components/NotificationPanel";
import StreakPanel from "@/components/StreakPanel";

type Props = {
  active?: "home" | "plans" | "benefits" | "contact";
};

import { useRouter, usePathname } from "next/navigation";

export default function SiteHeader({ active: activeProp }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  
  // Determine active tab automatically if not passed
  const active = activeProp || (() => {
    if (pathname === "/") return "home";
    if (pathname.includes("/plans")) return "plans";
    if (pathname.includes("/mistake-bank")) return "mistakes";
    if (pathname.includes("/brain-gym")) return "questions";
    if (pathname.includes("/simulation")) return "simulation";
    return undefined;
  })();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAppMode, setIsAppMode] = useState(false);

  useEffect(() => {
    const checkAppMode = () => {
      setIsAppMode(localStorage.getItem("isAppMode") === "true");
    };
    checkAppMode();
    window.addEventListener("appModeChange", checkAppMode);
    return () => window.removeEventListener("appModeChange", checkAppMode);
  }, []);

  const toggleAppMode = () => {
    localStorage.setItem("isAppMode", "true");
    window.dispatchEvent(new Event("appModeChange"));
    setIsAppMode(true);
    router.push("/profile");
  };

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSignedIn(!!data.session);

      if (data.session) {
        const userId = data.session.user.id;

        // Fetch admin status
        try {
          const res = await fetch("/api/admin/me", {
            headers: { Authorization: `Bearer ${data.session.access_token}` },
          });
          if (!mounted) return;
          setIsAdmin(res.ok);
        } catch {
          if (!mounted) return;
          setIsAdmin(false);
        }

        // Fetch avatar
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("avatar_url")
            .eq("id", userId)
            .single();
          if (!mounted) return;
          setAvatarUrl(profile?.avatar_url || null);
        } catch {
          if (!mounted) return;
        }
      }
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSignedIn(!!session);
      if (!session) {
        setIsAdmin(false);
        setAvatarUrl(null);
        return;
      }
      // Re-check admin
      fetch("/api/admin/me", { headers: { Authorization: `Bearer ${session.access_token}` } })
        .then((res) => { if (mounted) setIsAdmin(res.ok); })
        .catch(() => { if (mounted) setIsAdmin(false); });
      // Re-fetch avatar
      supabase.from("profiles").select("avatar_url").eq("id", session.user.id).single()
        .then(({ data: profile }) => { if (mounted) setAvatarUrl(profile?.avatar_url || null); });
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Close mobile menu on route change / resize
  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 768) setMobileOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const profileHref = isAdmin ? "/dashboard" : "/profile";

  const navLinks = [
    { id: "home", label: "Home", href: "/", icon: "home" },
    { id: "plans", label: "Plans", href: "/#plans", icon: "payments" },
    { id: "mistakes", label: "Mistakes Bank", href: "/profile/mistake-bank", icon: "history_edu" },
    { id: "questions", label: "Question Bank", href: "/profile/brain-gym", icon: "quiz" },
    { id: "simulation", label: "Simulation EST", href: "/simulation", icon: "assignment" },
  ];

  return (
    <>
      <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${isAppMode ? 'liquid-glass border-b-0 py-2' : 'nav-blur shadow-sm py-4 md:py-5'}`}>
        <div className={`flex justify-between items-center px-5 md:px-8 max-w-7xl mx-auto transition-all duration-500 ${isAppMode ? 'h-10' : ''}`}>
          {/* Left side */}
          <div className="flex items-center gap-4">
            {/* Logo / Mobile Hamburger in App Mode */}
            {isAppMode ? (
              <>
                {/* Hamburger for mobile to open App Sidebar */}
                <button
                  onClick={() => window.dispatchEvent(new Event("toggleAppSidebar"))}
                  className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-surface-variant/60 transition-colors lg:hidden"
                >
                  <span className="material-symbols-outlined text-[24px] text-primary font-bold">menu</span>
                </button>
                {/* Compact Logo for desktop in App Mode */}
                <Link className="hidden lg:flex items-center gap-4" href="/">
                  <Image 
                    src={logo} 
                    alt="800 Academy" 
                    className="h-7 w-auto transition-all duration-500" 
                    priority 
                  />
                </Link>
              </>
            ) : (
              <>
                <button
                  onClick={() => setMobileOpen(true)}
                  className="md:hidden flex items-center justify-center w-9 h-9 rounded-full hover:bg-surface-variant/60 transition-colors"
                  aria-label="Open menu"
                >
                  <span className="material-symbols-outlined text-[22px] text-on-surface">menu</span>
                </button>

                <Link className="hidden md:flex items-center gap-4" href="/">
                  <Image src={logo} alt="800 Academy" className="h-10 w-auto" priority />
                </Link>
              </>
            )}
          </div>

          {/* Desktop Navigation Links — Hidden in App Mode */}
          {!isAppMode && (
            <div className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.id}
                  href={link.href}
                  className={`text-sm font-bold transition-all hover:text-primary ${
                    active === link.id ? "text-primary" : "text-on-surface"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}

          {/* Right side — action icons */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Notification Panel */}
            {signedIn && <NotificationPanel />}

            {/* Day Streak Panel */}
            {signedIn && <StreakPanel />}

            {/* Avatar */}
            <Link
              href={signedIn ? profileHref : "/join?mode=login"}
              className="ml-1 flex items-center justify-center w-9 h-9 rounded-full overflow-hidden border-2 border-outline/40 hover:border-primary/60 transition-colors bg-surface-variant"
              title={signedIn ? (isAdmin ? "Dashboard" : "My Account") : "Sign In"}
            >
              {signedIn && avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt="Avatar"
                  width={36}
                  height={36}
                  className="w-full h-full object-cover"
                />
              ) : signedIn ? (
                <span className="material-symbols-outlined text-[20px] text-primary">person</span>
              ) : (
                <span className="material-symbols-outlined text-[20px] text-on-surface-variant">account_circle</span>
              )}
            </Link>

            {/* Open App Button — Moved to far right */}
            {signedIn && !isAppMode && (
              <button
                onClick={toggleAppMode}
                className="hidden md:flex items-center gap-2 px-6 py-2 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-full hover:bg-slate-800 transition-all shadow-lg shadow-primary/20 ml-2 active:scale-95 border-2 border-primary"
              >
                Open App
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          {/* Backdrop */}
          <button
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          />

          {/* Drawer panel */}
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-white shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-outline/40">
              <Link href="/#home" onClick={() => setMobileOpen(false)}>
                <Image src={logo} alt="800 Academy" className="h-8 w-auto" priority />
              </Link>
              <button
                onClick={() => setMobileOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-variant/60 transition-colors"
                aria-label="Close menu"
              >
                <span className="material-symbols-outlined text-[20px] text-on-surface-variant">close</span>
              </button>
            </div>

            {/* Navigation links */}
            <div className="flex-1 overflow-y-auto px-4 py-6">
              <div className="space-y-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.id}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                      active === link.id
                        ? "bg-primary text-white shadow-md"
                        : "text-on-surface hover:bg-surface-variant"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {link.icon}
                    </span>
                    {link.label}
                  </Link>
                ))}
              </div>

              {/* Divider */}
              <div className="my-6 border-t border-outline/40" />

              {/* Auth actions */}
              {signedIn === null ? null : signedIn ? (
                <a
                  href={profileHref}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm bg-primary text-white shadow-md transition-all hover:bg-slate-800"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {isAdmin ? "dashboard" : "person"}
                  </span>
                  {isAdmin ? "Dashboard" : "My Account"}
                </a>
              ) : (
                <div className="space-y-2">
                  <Link
                    href="/join?mode=login"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl font-bold text-sm border-2 border-outline/60 text-on-surface hover:bg-surface-variant transition-all"
                  >
                    Log In
                  </Link>
                  <Link
                    href="/join?mode=signup"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl font-bold text-sm bg-primary text-white hover:bg-slate-800 transition-all"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
