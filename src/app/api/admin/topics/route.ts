import { NextResponse } from "next/server";
import { requireAdminFromBearer } from "@/lib/adminGuard";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type TopicRow = {
  id: string;
  title: string;
  description: string | null;
  subject_id: string | null;
  created_at: string;
  updated_at: string;
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

  const { admin, error: adminErr } = getAdminOrFail();
  if (!admin) return NextResponse.json({ error: adminErr }, { status: 500 });

  const url = new URL(req.url);
  const subjectId = url.searchParams.get("subject_id");

  let query = admin
    .from("topics")
    .select("*")
    .order("title", { ascending: true });

  if (subjectId) {
    query = query.eq("subject_id", subjectId);
  }

  const { data: topics, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ items: topics as TopicRow[] });
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const body = (await req.json().catch(() => null)) as { title: string; description?: string; subject_id: string } | null;
  if (!body?.title) return NextResponse.json({ error: "Title is required." }, { status: 400 });

  const { admin, error: adminErr } = getAdminOrFail();
  if (!admin) return NextResponse.json({ error: adminErr }, { status: 500 });

  const { data, error } = await admin
    .from("topics")
    .insert({
      title: body.title.trim(),
      description: body.description?.trim() || null,
      subject_id: body.subject_id || null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ topic: data as TopicRow });
}

export async function DELETE(req: Request) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID is required." }, { status: 400 });

  const { admin, error: adminErr } = getAdminOrFail();
  if (!admin) return NextResponse.json({ error: adminErr }, { status: 500 });

  const { error } = await admin.from("topics").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
