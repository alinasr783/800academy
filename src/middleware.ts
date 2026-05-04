import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// Cache blocked IPs to avoid hitting DB on every request
let blockedIpsCache: Set<string> = new Set();
let blockedReasonsCache: Record<string, string> = {};
let lastFetch = 0;
const CACHE_TTL = 60_000; // 1 minute

async function getBlockedIps(): Promise<{ ips: Set<string>; reasons: Record<string, string> }> {
  const now = Date.now();
  if (now - lastFetch < CACHE_TTL) {
    return { ips: blockedIpsCache, reasons: blockedReasonsCache };
  }

  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin.from("blocked_ips").select("ip_address, reason");
    const ips = new Set<string>();
    const reasons: Record<string, string> = {};
    
    (data || []).forEach((row: any) => {
      ips.add(row.ip_address);
      reasons[row.ip_address] = row.reason || "Access denied from this IP address";
    });

    blockedIpsCache = ips;
    blockedReasonsCache = reasons;
    lastFetch = now;
    return { ips, reasons };
  } catch {
    return { ips: blockedIpsCache, reasons: blockedReasonsCache };
  }
}

export async function middleware(request: NextRequest) {
  // Skip API routes and static assets
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/")) {
    return NextResponse.next();
  }

  // Get IP from headers
  const ip = request.headers.get("x-real-ip") || 
             request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
             "unknown";

  const { ips, reasons } = await getBlockedIps();

  if (ips.has(ip)) {
    const reason = reasons[ip] || "Access denied";
    // Return minimal HTML page with only the reason
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Access Denied</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; background: #0a0a0c; }
  body { display: flex; align-items: center; justify-content: center; font-family: system-ui, sans-serif; }
  h1 { color: #ef4444; font-size: clamp(1.2rem, 4vw, 2.5rem); font-weight: 900; text-align: center; padding: 0 24px; }
</style>
</head>
<body>
<h1>${reason}</h1>
</body>
</html>`;

    return new NextResponse(html, {
      status: 403,
      headers: { "content-type": "text/html" },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/((?!_next|api|favicon.ico).*)",
};
