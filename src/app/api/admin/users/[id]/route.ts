import { NextResponse } from "next/server";
import { requireAdminFromBearer } from "@/lib/adminGuard";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";

type EntitlementRow = {
  id: string;
  user_id: string;
  subject_id: string;
  access_expires_at: string;
  order_item_id: string | null;
  created_at: string;
  subjects: { id: string; slug: string; title: string; track: string | null } | null;
};

type ProgressRow = {
  subject_id: string;
  total_exams: number;
  passed_exams: number;
  percent: number;
};

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const { id } = await params;

  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,email,full_name,phone,bio,avatar_url,is_admin,banned_until,ban_reason,created_at,updated_at")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  const { data: entRows, error: entErr } = await supabaseAdmin
    .from("entitlements")
    .select(
      "id,user_id,subject_id,access_expires_at,order_item_id,created_at,subjects(id,slug,title,track)",
    )
    .eq("user_id", id)
    .order("access_expires_at", { ascending: false })
    .returns<EntitlementRow[]>();

  if (entErr) return NextResponse.json({ error: entErr.message }, { status: 400 });

  const subjectIds = Array.from(new Set((entRows ?? []).map((e) => e.subject_id))).filter(Boolean);

  let progress: ProgressRow[] = [];
  if (subjectIds.length) {
    const { data: exams, error: examsErr } = await supabaseAdmin
      .from("exams")
      .select("id,subject_id,pass_percent,min_score")
      .in("subject_id", subjectIds)
      .returns<{ id: string; subject_id: string; pass_percent: number; min_score: number }[]>();

    if (examsErr) return NextResponse.json({ error: examsErr.message }, { status: 400 });

    const examIds = (exams ?? []).map((e) => e.id);
    const examById = new Map(examIds.map((id, idx) => [id, exams?.[idx]!]));

    const totalBySubject = new Map<string, number>();
    for (const ex of exams ?? []) {
      totalBySubject.set(ex.subject_id, (totalBySubject.get(ex.subject_id) ?? 0) + 1);
    }

    let passedExamIds = new Set<string>();
    if (examIds.length) {
      const { data: attempts, error: attErr } = await supabaseAdmin
        .from("exam_attempts")
        .select("exam_id,score,percent_correct,submitted_at")
        .eq("user_id", id)
        .in("exam_id", examIds)
        .order("submitted_at", { ascending: false })
        .limit(5000)
        .returns<
          { exam_id: string; score: number; percent_correct: number; submitted_at: string }[]
        >();

      if (attErr) return NextResponse.json({ error: attErr.message }, { status: 400 });

      for (const a of attempts ?? []) {
        if (passedExamIds.has(a.exam_id)) continue;
        const ex = examById.get(a.exam_id);
        if (!ex) continue;
        const pass =
          typeof a.score === "number" &&
          typeof a.percent_correct === "number" &&
          a.score >= ex.min_score &&
          a.percent_correct >= ex.pass_percent;
        if (pass) passedExamIds.add(a.exam_id);
      }
    }

    const passedBySubject = new Map<string, number>();
    for (const examId of passedExamIds) {
      const ex = examById.get(examId);
      if (!ex) continue;
      passedBySubject.set(ex.subject_id, (passedBySubject.get(ex.subject_id) ?? 0) + 1);
    }

    progress = subjectIds.map((subjectId) => {
      const total = totalBySubject.get(subjectId) ?? 0;
      const passed = passedBySubject.get(subjectId) ?? 0;
      const percent = total ? Math.round((passed / total) * 100) : 0;
      return { subject_id: subjectId, total_exams: total, passed_exams: passed, percent };
    });
  }

  return NextResponse.json({ profile: data, entitlements: entRows ?? [], progress });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return new NextResponse(null, { status: 401 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as
    | {
        full_name?: string | null;
        phone?: string | null;
        bio?: string | null;
        ban_reason?: string | null;
      }
    | null;

  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if ("full_name" in body) patch.full_name = body.full_name ?? null;
  if ("phone" in body) patch.phone = body.phone ?? null;
  if ("bio" in body) patch.bio = body.bio ?? null;
  if ("ban_reason" in body) patch.ban_reason = body.ban_reason ?? null;

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", id)
    .select(
      "id,email,full_name,phone,bio,avatar_url,is_admin,banned_until,ban_reason,created_at,updated_at",
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ profile: data });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as
    | { action: "ban" | "unban"; ban_reason?: string | null; ban_until?: string | null }
    | null;

  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  if (body.action === "unban") {
    const supabaseAdmin = getSupabaseAdmin();
    await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: "none" });
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ banned_until: null, ban_reason: null })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const until = body.ban_until ? new Date(body.ban_until) : null;
  const banDuration =
    until && until.getTime() > Date.now()
      ? `${Math.ceil((until.getTime() - Date.now()) / (1000 * 60))}m`
      : "876000h";

  const supabaseAdmin = getSupabaseAdmin();
  await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: banDuration });

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ banned_until: until?.toISOString() ?? null, ban_reason: body.ban_reason ?? null })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const { id } = await params;

  const supabaseAdmin = getSupabaseAdmin();
  const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
