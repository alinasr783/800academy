import { NextResponse } from "next/server";
import { requireAdminFromBearer } from "@/lib/adminGuard";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function getAdmin() {
  try {
    return { admin: getSupabaseAdmin(), error: null };
  } catch (e) {
    return { admin: null, error: e instanceof Error ? e.message : "Server error" };
  }
}

export async function GET(req: Request) {
  const guard = await requireAdminFromBearer(req.headers.get("authorization"));
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const { admin, error } = getAdmin();
  if (!admin) return NextResponse.json({ error }, { status: 500 });

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 200);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

  const { data, error: dbErr, count } = await admin
    .from("notifications")
    .select("*, notification_types(name, icon, color)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 400 });
  return NextResponse.json({ items: data ?? [], count: count ?? 0 });
}

export async function POST(req: Request) {
  const guard = await requireAdminFromBearer(req.headers.get("authorization"));
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const body = await req.json().catch(() => null);
  if (!body?.action) return NextResponse.json({ error: "Invalid body." }, { status: 400 });

  const { admin, error: adminErr } = getAdmin();
  if (!admin) return NextResponse.json({ error: adminErr }, { status: 500 });

  if (body.action === "create") {
    if (!body.title?.trim()) return NextResponse.json({ error: "Title is required." }, { status: 400 });

    const { data, error } = await admin
      .from("notifications")
      .insert({
        type_id: body.type_id || null,
        title: body.title.trim(),
        body: body.body?.trim() || "",
        image_url: body.image_url?.trim() || null,
        target_user_id: body.target_user_id || null,
        actions: Array.isArray(body.actions) ? body.actions : [],
        is_active: true,
      })
      .select("*, notification_types(name, icon, color)")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ item: data });
  }

  if (body.action === "update") {
    if (!body.id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

    const updates: Record<string, any> = {};
    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.body !== undefined) updates.body = body.body.trim();
    if (body.image_url !== undefined) updates.image_url = body.image_url?.trim() || null;
    if (body.type_id !== undefined) updates.type_id = body.type_id || null;
    if (body.target_user_id !== undefined) updates.target_user_id = body.target_user_id || null;
    if (body.actions !== undefined) updates.actions = body.actions;
    if (body.is_active !== undefined) updates.is_active = body.is_active;

    const { error } = await admin
      .from("notifications")
      .update(updates)
      .eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  if (body.action === "delete") {
    if (!body.id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    const { error } = await admin
      .from("notifications")
      .delete()
      .eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
