import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const body = await req.json();
  const { code, cartItems, totalCents } = body;
  const ip = req.headers.get("x-forwarded-for") || "unknown";

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = authHeader.replace("Bearer ", "");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();

  // 1. Check IP Blacklist
  const { data: isBlocked } = await admin
    .from("blocked_ips")
    .select("ip_address")
    .eq("ip_address", ip)
    .single();
  
  if (isBlocked) {
    return NextResponse.json({ error: "Access denied from this IP" }, { status: 403 });
  }

  // 2. Fetch Coupon
  const { data: coupon, error: couponErr } = await admin
    .from("coupons")
    .select("*")
    .eq("code", code.toUpperCase())
    .single();

  if (couponErr || !coupon) {
    return NextResponse.json({ error: "Invalid coupon code" }, { status: 404 });
  }

  // 3. Basic Checks (Active, Dates, Total Limit)
  if (!coupon.is_active) return NextResponse.json({ error: "Coupon is disabled" }, { status: 400 });

  const now = new Date();
  if (new Date(coupon.start_at) > now) return NextResponse.json({ error: "Coupon not yet active" }, { status: 400 });
  if (coupon.expires_at && new Date(coupon.expires_at) < now) return NextResponse.json({ error: "Coupon expired" }, { status: 400 });

  if (coupon.total_usage_limit !== null && coupon.used_count >= coupon.total_usage_limit) {
    return NextResponse.json({ error: "Coupon usage limit reached" }, { status: 400 });
  }

  // 4. Per-User Usage Limit (1 per account)
  const { count: userUsageCount } = await admin
    .from("coupon_usages")
    .select("id", { count: "exact", head: true })
    .eq("coupon_id", coupon.id)
    .eq("user_id", user.id);

  if (userUsageCount && userUsageCount > 0) {
    return NextResponse.json({ error: "You have already used this coupon" }, { status: 400 });
  }

  // 5. New User Only Check
  if (coupon.is_new_user_only) {
    const { count: subCount } = await admin
      .from("user_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    
    if (subCount && subCount > 0) {
      return NextResponse.json({ error: "This coupon is for new users only" }, { status: 400 });
    }
  }

  // 6. Subject Match Check
  if (coupon.subject_id) {
    const hasMatch = cartItems.some((item: any) => item.subject_id === coupon.subject_id);
    if (!hasMatch) {
      return NextResponse.json({ error: "This coupon applies to a specific subject only" }, { status: 400 });
    }
  }

  // 7. Min Order Value
  if (totalCents < coupon.min_order_cents) {
    const minFormatted = (coupon.min_order_cents / 100).toFixed(2);
    return NextResponse.json({ error: `Minimum order value for this coupon is ${minFormatted}` }, { status: 400 });
  }

  // 8. Calculate Discount
  let discountAmount = 0;
  if (coupon.discount_type === "percentage") {
    discountAmount = Math.floor(totalCents * (coupon.discount_value / 100));
    if (coupon.max_discount_cents && discountAmount > coupon.max_discount_cents) {
      discountAmount = coupon.max_discount_cents;
    }
  } else {
    discountAmount = Math.floor(Number(coupon.discount_value) * 100);
  }

  // Don't allow discount to exceed total
  if (discountAmount > totalCents) discountAmount = totalCents;

  return NextResponse.json({
    valid: true,
    couponId: coupon.id,
    discountAmountCents: discountAmount,
    code: coupon.code,
  });
}
