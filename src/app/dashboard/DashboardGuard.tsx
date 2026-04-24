"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function DashboardGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ok" | "redirect">("loading");

  useEffect(() => {
    let mounted = true;

    async function run() {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        console.error("[DashboardGuard] no session");
        router.push("/join?mode=login");
        if (mounted) setStatus("redirect");
        return;
      }

      let res: Response | null = null;
      try {
        res = await fetch("/api/admin/me", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
      } catch (e) {
        console.error("[DashboardGuard] fetch /api/admin/me failed", e);
        router.push("/profile");
        if (mounted) setStatus("redirect");
        return;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error("[DashboardGuard] /api/admin/me not ok", res.status, body);
        router.push("/profile");
        if (mounted) setStatus("redirect");
        return;
      }

      if (mounted) setStatus("ok");
    }

    run();
    return () => {
      mounted = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (status !== "ok") {
    return (
      <div className="bg-surface-variant border border-outline/40 p-10 text-on-surface-variant font-medium">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
