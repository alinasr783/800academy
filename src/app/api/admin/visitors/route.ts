import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromBearer } from "@/lib/adminGuard";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const admin = getSupabaseAdmin();
  const url = new URL(req.url);
  const country = url.searchParams.get("country");
  const city = url.searchParams.get("city");
  const device = url.searchParams.get("device");
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = (page - 1) * limit;

  try {
    // Get unique visitors (grouped by IP) with their latest visit info
    let query = admin
      .from("page_visits")
      .select("id, ip_address, country, city, user_agent, path, created_at, session_hash", { count: "exact" });

    if (country) query = query.eq("country", country);
    if (city) query = query.eq("city", city);
    if (device) {
      if (device === "mobile") query = query.or("user_agent.ilike.%Mobile%,user_agent.ilike.%Android%,user_agent.ilike.%iPhone%");
      else if (device === "tablet") query = query.or("user_agent.ilike.%iPad%,user_agent.ilike.%Tablet%");
      else if (device === "desktop") query = query.not("user_agent", "ilike", "%Mobile%").not("user_agent", "ilike", "%Android%").not("user_agent", "ilike", "%iPhone%").not("user_agent", "ilike", "%iPad%").not("user_agent", "ilike", "%Tablet%");
      else if (device === "bot") query = query.or("user_agent.ilike.%bot%,user_agent.ilike.%crawler%,user_agent.ilike.%spider%,user_agent.ilike.%scraper%");
    }

    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    // Get unique IPs for stats
    const { data: uniqueData, error: uniqueError } = await admin
      .from("page_visits")
      .select("ip_address")
      .order("created_at", { ascending: false });

    const uniqueIps = new Set((uniqueData || []).map(v => v.ip_address));
    const totalVisits = count || 0;

    // Check which IPs have accounts
    const ips = data?.map(v => v.ip_address).filter(Boolean) || [];
    let ipAccounts: Record<string, any> = {};
    
    if (ips.length > 0) {
      const { data: profiles } = await admin.rpc("get_profiles_by_ips", { ips: ips });
      // Fallback: try querying with a unique approach
      if (!profiles) {
        // Just return data without account info
      } else {
        (profiles as any[]).forEach((p: any) => {
          if (p.last_sign_in_ip) ipAccounts[p.last_sign_in_ip] = p;
        });
      }
    }

    const visitors = (data || []).map(v => ({
      id: v.id,
      ip_address: v.ip_address,
      country: v.country,
      city: v.city,
      user_agent: v.user_agent,
      device_type: detectDevice(v.user_agent),
      last_path: v.path,
      last_visit: v.created_at,
      session_hash: v.session_hash,
      has_account: ipAccounts[v.ip_address] ? true : false,
      account: ipAccounts[v.ip_address] || null,
    }));

    return NextResponse.json({
      visitors,
      total: totalVisits,
      uniqueIps: uniqueIps.size,
      page,
      limit,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function detectDevice(ua: string | null): string {
  if (!ua) return "unknown";
  const agent = ua.toLowerCase();
  if (/bot|crawler|spider|scraper/i.test(agent)) return "bot";
  if (/ipad|tablet|(android(?!.*mobile))/i.test(agent)) return "tablet";
  if (/mobile|iphone|android/i.test(agent)) return "mobile";
  return "desktop";
}
