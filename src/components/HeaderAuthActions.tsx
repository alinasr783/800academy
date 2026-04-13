"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function HeaderAuthActions() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSignedIn(!!data.session);

      if (data.session) {
        try {
          const res = await fetch("/api/admin/me", {
            headers: { Authorization: `Bearer ${data.session.access_token}` },
          });
          if (!mounted) return;
          if (!res.ok) {
            const body = await res.text().catch(() => "");
            console.error("[HeaderAuthActions] /api/admin/me not ok", res.status, body);
          }
          setIsAdmin(res.ok);
        } catch (e) {
          if (!mounted) return;
          console.error("[HeaderAuthActions] /api/admin/me fetch failed", e);
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session);
      if (!session) {
        setIsAdmin(false);
        return;
      }
      fetch("/api/admin/me", { headers: { Authorization: `Bearer ${session.access_token}` } })
        .then(async (res) => {
          if (!mounted) return;
          if (!res.ok) {
            const body = await res.text().catch(() => "");
            console.error("[HeaderAuthActions] /api/admin/me not ok", res.status, body);
          }
          setIsAdmin(res.ok);
        })
        .catch((e) => {
          if (!mounted) return;
          console.error("[HeaderAuthActions] /api/admin/me fetch failed", e);
          setIsAdmin(false);
        });
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (signedIn === null) {
    return <div className="w-[210px]" />;
  }

  if (signedIn) {
    return (
      <div className="flex items-center gap-6 font-bold text-sm tracking-wide">
        <Link
          className="bg-primary text-white px-7 py-3 uppercase hover:bg-slate-800 transition-all rounded-full"
          href={isAdmin ? "/dashboard" : "/profile"}
        >
          {isAdmin ? "Dashboard" : "My Account"}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6 font-bold text-sm tracking-wide">
      <Link
        className="text-on-surface hover:opacity-70 transition-all uppercase rounded-full"
        href="/join?mode=login"
      >
        Log In
      </Link>
      <Link
        className="bg-primary text-white px-7 py-3 uppercase hover:bg-slate-800 transition-all rounded-full"
        href="/join?mode=signup"
      >
        Sign Up
      </Link>
    </div>
  );
}
