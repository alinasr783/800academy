import { NextResponse } from "next/server";
import { requireAdminFromBearer } from "@/lib/adminGuard";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type SubjectRow = {
  id: string;
  slug: string;
  title: string;
  track: string | null;
  card_description: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 100), 1), 200);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  let query = admin
    .from("subjects")
    .select("id,slug,title,track,card_description,description,created_at,updated_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (q) {
    query = query.or(`slug.ilike.%${q}%,title.ilike.%${q}%,track.ilike.%${q}%`);
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ items: (data ?? []) as SubjectRow[], count: count ?? 0 });
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const body = (await req.json().catch(() => null)) as
    | {
        slug: string;
        title: string;
        track?: string | null;
        card_description?: string | null;
        description?: string | null;
      }
    | null;

  if (!body?.slug?.trim() || !body?.title?.trim()) {
    return NextResponse.json({ error: "Missing slug/title." }, { status: 400 });
  }

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { data, error } = await admin
    .from("subjects")
    .insert({
      slug: body.slug.trim(),
      title: body.title.trim(),
      track: body.track ?? null,
      card_description: body.card_description ?? null,
      description: body.description ?? null,
    })
    .select("id,slug,title,track,card_description,description,created_at,updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ subject: data as SubjectRow });
}
