import { NextResponse } from "next/server";
import { requireAdminFromBearer } from "@/lib/adminGuard";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const admin = getSupabaseAdmin();
  const { data: blocked, error } = await admin
    .from("blocked_ips")
    .select("*")
    .order("blocked_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ blocked });
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const body = await req.json();
  const admin = getSupabaseAdmin();

  if (body.action === "block") {
    const { data, error } = await admin
      .from("blocked_ips")
      .insert([{ ip_address: body.ip_address, reason: body.reason }])
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ blocked: data });
  }

  if (body.action === "unblock") {
    const { error } = await admin.from("blocked_ips").delete().eq("ip_address", body.ip_address);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
