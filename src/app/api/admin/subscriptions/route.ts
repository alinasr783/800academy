import { NextResponse } from "next/server";
import { requireAdminFromBearer } from "@/lib/adminGuard";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type ActiveItem = {
  id: string;
  user_id: string;
  subject_id: string;
  access_expires_at: string;
  order_item_id: string | null;
  created_at: string;
  user: { id: string; email: string | null; full_name: string | null } | null;
  subject: { id: string; slug: string; title: string; track: string | null } | null;
};

function getAdminOrFail() {
  try {
    return { admin: getSupabaseAdmin() as ReturnType<typeof getSupabaseAdmin>, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured.";
    return { admin: null, error: msg };
  }
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "active";

  const { admin, error: adminErr } = getAdminOrFail();
  if (!admin) return NextResponse.json({ error: adminErr }, { status: 500 });

  if (kind === "stats") {
    const now = Date.now();
    const days = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString();

    const [week, month, threeMonths, active] = await Promise.all([
      admin
        .from("orders")
        .select("total_cents,created_at")
        .eq("status", "paid")
        .gte("created_at", days(7)),
      admin
        .from("orders")
        .select("total_cents,created_at")
        .eq("status", "paid")
        .gte("created_at", days(30)),
      admin
        .from("orders")
        .select("total_cents,created_at")
        .eq("status", "paid")
        .gte("created_at", days(90)),
      admin
        .from("entitlements")
        .select("id", { count: "exact", head: true })
        .gte("access_expires_at", new Date().toISOString()),
    ]);

    const sum = (rows: { total_cents: number }[] | null | undefined) =>
      (rows ?? []).reduce((acc, r) => acc + (typeof r.total_cents === "number" ? r.total_cents : 0), 0);

    if (week.error) return NextResponse.json({ error: week.error.message }, { status: 400 });
    if (month.error) return NextResponse.json({ error: month.error.message }, { status: 400 });
    if (threeMonths.error) return NextResponse.json({ error: threeMonths.error.message }, { status: 400 });
    if (active.error) return NextResponse.json({ error: active.error.message }, { status: 400 });

    return NextResponse.json({
      revenue: {
        last7DaysCents: sum(week.data as { total_cents: number }[]),
        last30DaysCents: sum(month.data as { total_cents: number }[]),
        last90DaysCents: sum(threeMonths.data as { total_cents: number }[]),
      },
      activeSubscriptions: active.count ?? 0,
    });
  }

  if (kind === "offers") {
    const subjectId = url.searchParams.get("subject_id");
    if (!subjectId) return NextResponse.json({ items: [] });
    
    const { data, error } = await admin
      .from("subject_offers")
      .select("id, label, price_cents, currency, expires_at")
      .eq("subject_id", subjectId)
      .eq("is_active", true);
      
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ items: data ?? [] });
  }

  const q = url.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 100), 1), 200);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

  let userIds: string[] | null = null;
  let subjectIds: string[] | null = null;
  if (q) {
    const [usersRes, subjectsRes] = await Promise.all([
      admin
        .from("profiles")
        .select("id")
        .or(`email.ilike.%${q}%,full_name.ilike.%${q}%`)
        .limit(200),
      admin
        .from("subjects")
        .select("id")
        .or(`slug.ilike.%${q}%,title.ilike.%${q}%,track.ilike.%${q}%`)
        .limit(200),
    ]);
    if (usersRes.error) return NextResponse.json({ error: usersRes.error.message }, { status: 400 });
    if (subjectsRes.error) return NextResponse.json({ error: subjectsRes.error.message }, { status: 400 });
    userIds = (usersRes.data ?? []).map((r) => r.id);
    subjectIds = (subjectsRes.data ?? []).map((r) => r.id);
    if (userIds.length === 0 && subjectIds.length === 0) {
      return NextResponse.json({ items: [], count: 0 });
    }
  }

  let entQuery = admin
    .from("entitlements")
    .select("id,user_id,subject_id,access_expires_at,order_item_id,created_at", { count: "exact" })
    .gte("access_expires_at", new Date().toISOString())
    .order("access_expires_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (q) {
    if (userIds && userIds.length > 0 && subjectIds && subjectIds.length > 0) {
      entQuery = entQuery.or(`user_id.in.(${userIds.join(",")}),subject_id.in.(${subjectIds.join(",")})`);
    } else if (userIds && userIds.length > 0) {
      entQuery = entQuery.in("user_id", userIds);
    } else if (subjectIds && subjectIds.length > 0) {
      entQuery = entQuery.in("subject_id", subjectIds);
    }
  }

  const { data: entitlements, error, count } = await entQuery;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const userIdSet = new Set((entitlements ?? []).map((e) => e.user_id));
  const subjectIdSet = new Set((entitlements ?? []).map((e) => e.subject_id));

  const [profilesRes, subjectsRes] = await Promise.all([
    userIdSet.size
      ? admin
          .from("profiles")
          .select("id,email,full_name")
          .in("id", Array.from(userIdSet))
      : Promise.resolve({ data: [] as { id: string; email: string | null; full_name: string | null }[], error: null }),
    subjectIdSet.size
      ? admin
          .from("subjects")
          .select("id,slug,title,track")
          .in("id", Array.from(subjectIdSet))
      : Promise.resolve({ data: [] as { id: string; slug: string; title: string; track: string | null }[], error: null }),
  ]);

  if (profilesRes.error) return NextResponse.json({ error: profilesRes.error.message }, { status: 400 });
  if (subjectsRes.error) return NextResponse.json({ error: subjectsRes.error.message }, { status: 400 });

  const profilesById = new Map(profilesRes.data.map((p) => [p.id, p]));
  const subjectsById = new Map(subjectsRes.data.map((s) => [s.id, s]));

  const items: ActiveItem[] = (entitlements ?? []).map((e) => ({
    id: e.id,
    user_id: e.user_id,
    subject_id: e.subject_id,
    access_expires_at: e.access_expires_at,
    order_item_id: e.order_item_id ?? null,
    created_at: e.created_at,
    user: profilesById.get(e.user_id) ?? null,
    subject: subjectsById.get(e.subject_id) ?? null,
  }));

  return NextResponse.json({ items, count: count ?? items.length });
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const body = (await req.json().catch(() => null)) as any;
  if (!body?.action) return NextResponse.json({ error: "Invalid body." }, { status: 400 });

  const { admin, error: adminErr } = getAdminOrFail();
  if (!admin) return NextResponse.json({ error: adminErr }, { status: 500 });

  if (body.action === "manual_add") {
    // Add Entitlement only
    if (!body.user_id || !body.subject_id || !body.access_expires_at) {
      return NextResponse.json({ error: "Missing fields." }, { status: 400 });
    }
    const expiresAt = new Date(body.access_expires_at);
    if (!Number.isFinite(expiresAt.getTime())) {
      return NextResponse.json({ error: "Invalid access_expires_at." }, { status: 400 });
    }
    const { data, error } = await admin
      .from("entitlements")
      .insert({
        user_id: body.user_id,
        subject_id: body.subject_id,
        access_expires_at: expiresAt.toISOString(),
        order_item_id: null,
      })
      .select("id,user_id,subject_id,access_expires_at,order_item_id,created_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ entitlement: data });
  }

  if (body.action === "manual_subscribe") {
    // Add full Subscription + Transaction + Entitlement
    if (!body.user_id || !body.subject_id || !body.offer_id) {
      return NextResponse.json({ error: "Missing fields." }, { status: 400 });
    }
    
    // Fetch offer details
    const { data: offer, error: offerErr } = await admin
      .from("subject_offers")
      .select("price_cents, expires_at, currency, label")
      .eq("id", body.offer_id)
      .single();
      
    if (offerErr || !offer) return NextResponse.json({ error: "Offer not found." }, { status: 404 });
    
    // Create transaction
    const { data: tx, error: txError } = await admin
      .from("transactions")
      .insert({
        amount: offer.price_cents / 100,
        currency: offer.currency || "EGP",
        status: "completed",
        type: "subscription",
        user_id: body.user_id,
        metadata: {
          type: "subscription",
          manual: true,
          method: "whatsapp",
          offers: [{
            offer_id: body.offer_id,
            subject_id: body.subject_id,
            price_cents: offer.price_cents,
            expires_at: offer.expires_at,
            label: offer.label
          }]
        },
      })
      .select("id")
      .single();
      
    if (txError) return NextResponse.json({ error: txError.message }, { status: 400 });
    
    // Create User Subscription
    await admin.from("user_subscriptions").insert({
      user_id: body.user_id,
      subject_id: body.subject_id,
      subject_offer_id: body.offer_id,
      transaction_id: tx.id,
      payment_method: "whatsapp_manual",
      status: "active",
      expires_at: offer.expires_at,
    });
    
    // Create Entitlement
    const { data: ent, error: entError } = await admin.from("entitlements").insert({
      user_id: body.user_id,
      subject_id: body.subject_id,
      access_expires_at: offer.expires_at,
      order_item_id: null,
    }).select().single();
    
    if (entError) return NextResponse.json({ error: entError.message }, { status: 400 });
    return NextResponse.json({ entitlement: ent });
  }

  if (body.action === "cancel_entitlement") {
    if (!body.id) return NextResponse.json({ error: "Missing entitlement id." }, { status: 400 });
    
    const { error } = await admin
      .from("entitlements")
      .update({ access_expires_at: new Date().toISOString() })
      .eq("id", body.id);
      
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}

