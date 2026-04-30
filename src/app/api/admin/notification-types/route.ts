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

  const { data, error: dbErr } = await admin
    .from("notification_types")
    .select("*")
    .order("created_at", { ascending: true });

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 400 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: Request) {
  const guard = await requireAdminFromBearer(req.headers.get("authorization"));
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const body = await req.json().catch(() => null);
  if (!body?.action) return NextResponse.json({ error: "Invalid body." }, { status: 400 });

  const { admin, error: adminErr } = getAdmin();
  if (!admin) return NextResponse.json({ error: adminErr }, { status: 500 });

  if (body.action === "create") {
    if (!body.name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    const { data, error } = await admin
      .from("notification_types")
      .insert({
        name: body.name.trim(),
        icon: body.icon?.trim() || "campaign",
        color: body.color?.trim() || "#3e5e95",
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ item: data });
  }

  if (body.action === "update") {
    if (!body.id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    const updates: Record<string, string> = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.icon !== undefined) updates.icon = body.icon.trim();
    if (body.color !== undefined) updates.color = body.color.trim();

    const { error } = await admin
      .from("notification_types")
      .update(updates)
      .eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  if (body.action === "delete") {
    if (!body.id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    const { error } = await admin
      .from("notification_types")
      .delete()
      .eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
