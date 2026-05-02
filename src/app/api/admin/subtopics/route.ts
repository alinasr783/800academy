import { NextResponse } from "next/server";
import { requireAdminFromBearer } from "@/lib/adminGuard";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type SubtopicRow = {
  id: string;
  topic_id: string;
  subject_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
  is_free: boolean;
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
  const topicId = url.searchParams.get("topic_id");
  const subjectId = url.searchParams.get("subject_id");

  let query = admin
    .from("subtopics")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  if (topicId) {
    query = query.eq("topic_id", topicId);
  }
  if (subjectId) {
    query = query.eq("subject_id", subjectId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ items: data as SubtopicRow[] });
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const body = (await req.json().catch(() => null)) as {
    topic_id: string;
    subject_id: string;
    title: string;
    description?: string;
    image_url?: string;
    category?: string;
    is_free?: boolean;
  } | null;

  if (!body?.topic_id || !body?.subject_id || !body?.title) {
    return NextResponse.json({ error: "Missing required fields (topic_id, subject_id, title)." }, { status: 400 });
  }

  const { admin, error: adminErr } = getAdminOrFail();
  if (!admin) return NextResponse.json({ error: adminErr }, { status: 500 });

  const { data, error } = await admin
    .from("subtopics")
    .insert({
      topic_id: body.topic_id,
      subject_id: body.subject_id,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      image_url: body.image_url || null,
      category: body.category || null,
      is_free: body.is_free || false,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ subtopic: data as SubtopicRow });
}

export async function PATCH(req: Request) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID is required." }, { status: 400 });

  const body = (await req.json().catch(() => null)) as Partial<{
    title: string;
    description: string | null;
    image_url: string | null;
    category: string | null;
    is_free: boolean;
    sort_order: number;
  }> | null;

  if (!body) return NextResponse.json({ error: "Invalid body." }, { status: 400 });

  const { admin, error: adminErr } = getAdminOrFail();
  if (!admin) return NextResponse.json({ error: adminErr }, { status: 500 });

  const patch: Record<string, any> = {};
  if ("title" in body) patch.title = body.title?.trim();
  if ("description" in body) patch.description = body.description?.trim() || null;
  if ("image_url" in body) patch.image_url = body.image_url;
  if ("category" in body) patch.category = body.category;
  if ("is_free" in body) patch.is_free = body.is_free;
  if ("sort_order" in body && typeof body.sort_order === "number") patch.sort_order = body.sort_order;

  const { data, error } = await admin
    .from("subtopics")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ subtopic: data as SubtopicRow });
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

  const { error } = await admin.from("subtopics").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
