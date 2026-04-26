import { NextResponse } from "next/server";
import { requireAdminFromBearer } from "@/lib/adminGuard";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const admin = getSupabaseAdmin();
  const { data: usage, error } = await admin
    .from("coupon_usages")
    .select(`
      *,
      coupon:coupons(code),
      profile:profiles(id, email, full_name)
    `)
    .order("used_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ usage });
}
