import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

async function getUserFromBearer(bearer: string | null) {
  const token = bearer?.startsWith("Bearer ") ? bearer.slice(7).trim() : null;
  if (!token) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const client = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

// GET — Fetch notifications for the current user (broadcast + targeted)
export async function GET(req: Request) {
  const user = await getUserFromBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = getSupabaseAdmin();

  // Fetch active notifications: broadcast (target_user_id IS NULL) or targeted to this user
  const { data: notifications, error: notifErr } = await admin
    .from("notifications")
    .select("*, notification_types(name, icon, color)")
    .eq("is_active", true)
    .or(`target_user_id.is.null,target_user_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (notifErr) return NextResponse.json({ error: notifErr.message }, { status: 400 });

  // Fetch which ones the user has read
  const notifIds = (notifications ?? []).map((n: any) => n.id);
  let readSet = new Set<string>();

  if (notifIds.length > 0) {
    const { data: reads } = await admin
      .from("notification_reads")
      .select("notification_id")
      .eq("user_id", user.id)
      .in("notification_id", notifIds);

    readSet = new Set((reads ?? []).map((r: any) => r.notification_id));
  }

  const items = (notifications ?? []).map((n: any) => ({
    ...n,
    is_read: readSet.has(n.id),
  }));

  const unreadCount = items.filter((i: any) => !i.is_read).length;

  return NextResponse.json({ items, unreadCount });
}

// POST — Mark notifications as read
export async function POST(req: Request) {
  const user = await getUserFromBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.action) return NextResponse.json({ error: "Invalid body." }, { status: 400 });

  const admin = getSupabaseAdmin();

  if (body.action === "mark_read") {
    // Mark specific notification as read
    if (body.notification_id) {
      await admin
        .from("notification_reads")
        .upsert(
          { notification_id: body.notification_id, user_id: user.id },
          { onConflict: "notification_id,user_id" }
        );
      return NextResponse.json({ success: true });
    }

    // Mark ALL as read
    if (body.all === true) {
      // Get all unread notification IDs for this user
      const { data: notifications } = await admin
        .from("notifications")
        .select("id")
        .eq("is_active", true)
        .or(`target_user_id.is.null,target_user_id.eq.${user.id}`);

      const allIds = (notifications ?? []).map((n: any) => n.id);
      if (allIds.length === 0) return NextResponse.json({ success: true });

      // Get already read
      const { data: existing } = await admin
        .from("notification_reads")
        .select("notification_id")
        .eq("user_id", user.id)
        .in("notification_id", allIds);

      const existingSet = new Set((existing ?? []).map((r: any) => r.notification_id));
      const toInsert = allIds
        .filter((id: string) => !existingSet.has(id))
        .map((id: string) => ({ notification_id: id, user_id: user.id }));

      if (toInsert.length > 0) {
        await admin.from("notification_reads").insert(toInsert);
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Provide notification_id or all=true." }, { status: 400 });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
