import { NextResponse } from "next/server";
import { requireAdminFromBearer } from "@/lib/adminGuard";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const admin = getSupabaseAdmin();
  const { data: coupons, error } = await admin
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ coupons });
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const body = await req.json();
  const admin = getSupabaseAdmin();

  if (body.action === "create") {
    const { data, error } = await admin
      .from("coupons")
      .insert([
        {
          code: body.code.toUpperCase(),
          description: body.description,
          discount_type: body.discount_type,
          discount_value: body.discount_value,
          min_order_cents: body.min_order_cents || 0,
          max_discount_cents: body.max_discount_cents || null,
          start_at: body.start_at || new Date().toISOString(),
          expires_at: body.expires_at || null,
          is_active: body.is_active ?? true,
          is_new_user_only: body.is_new_user_only ?? false,
          total_usage_limit: body.total_usage_limit || null,
          subject_id: body.subject_id || null,
        },
      ])
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ coupon: data });
  }

  if (body.action === "update") {
    const { data, error } = await admin
      .from("coupons")
      .update({
        description: body.description,
        discount_type: body.discount_type,
        discount_value: body.discount_value,
        min_order_cents: body.min_order_cents,
        max_discount_cents: body.max_discount_cents,
        start_at: body.start_at,
        expires_at: body.expires_at,
        is_active: body.is_active,
        is_new_user_only: body.is_new_user_only,
        total_usage_limit: body.total_usage_limit,
        subject_id: body.subject_id,
      })
      .eq("id", body.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ coupon: data });
  }

  if (body.action === "delete") {
    const { error } = await admin.from("coupons").delete().eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
