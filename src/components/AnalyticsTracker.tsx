"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackVisit } from "@/app/actions/analytics";

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const trackedPaths = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Only track each path once per user session to avoid artificial inflation
    if (pathname && !trackedPaths.current.has(pathname)) {
      trackedPaths.current.add(pathname);
      trackVisit(pathname).catch(() => {});
    }
  }, [pathname]);

  return null;
}
