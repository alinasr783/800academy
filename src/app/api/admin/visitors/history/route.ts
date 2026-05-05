import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromBearer } from "@/lib/adminGuard";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const admin = getSupabaseAdmin();
  const url = new URL(req.url);
  const ip = url.searchParams.get("ip");

  if (!ip) return NextResponse.json({ error: "ip is required" }, { status: 400 });

  try {
    const { data, error } = await admin
      .from("page_visits")
      .select("id, path, country, city, user_agent, created_at")
      .eq("ip_address", ip)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;

    const history = (data || []).map(v => ({
      id: v.id,
      path: v.path,
      country: v.country,
      city: v.city,
      device: detectDevice(v.user_agent),
      created_at: v.created_at,
    }));

    return NextResponse.json({ history, ip });
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
