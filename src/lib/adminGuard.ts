import { createClient } from "@supabase/supabase-js";

export async function requireAdminFromBearer(bearer: string | null) {
  const token = bearer?.startsWith("Bearer ") ? bearer.slice(7).trim() : null;
  if (!token) return { ok: false as const, status: 401 as const };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const client = createClient(supabaseUrl, supabaseAnonKey);

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return { ok: false as const, status: 401 as const };

  let adminRow: { user_id: string } | null = null;

  if (supabaseServiceRoleKey) {
    const service = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: row, error: adminErr } = await service
      .from("admin_users")
      .select("user_id")
      .eq("user_id", data.user.id)
      .maybeSingle<{ user_id: string }>();

    if (adminErr) {
      console.error("[adminGuard] service-role admin_users query failed:", adminErr.message);
    } else {
      adminRow = row ?? null;
    }
  }

  if (!adminRow) {
    const authed = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: row, error: adminErr } = await authed
      .from("admin_users")
      .select("user_id")
      .eq("user_id", data.user.id)
      .maybeSingle<{ user_id: string }>();

    if (adminErr) {
      console.error("[adminGuard] authed admin_users query failed:", adminErr.message);
    }

    adminRow = row ?? null;
  }

  if (!adminRow?.user_id) {
    return { ok: false as const, status: 403 as const, userId: data.user.id };
  }

  return { ok: true as const, userId: data.user.id };
}
