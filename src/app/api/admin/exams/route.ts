import { NextResponse } from "next/server";
import { requireAdminFromBearer } from "@/lib/adminGuard";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type ExamRow = {
  id: string;
  subject_id: string;
  exam_number: number;
  title: string;
  is_free: boolean;
  duration_seconds: number;
  pass_percent: number;
  max_attempts: number | null;
  min_score: number;
  total_points: number;
  created_at: string;
  updated_at: string;
};

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const url = new URL(req.url);
  const subjectId = url.searchParams.get("subject_id")?.trim() ?? "";
  if (!subjectId) return NextResponse.json({ error: "Missing subject_id." }, { status: 400 });

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { data, error } = await admin
    .from("exams")
    .select(
      "id,subject_id,exam_number,title,is_free,duration_seconds,pass_percent,max_attempts,min_score,total_points,created_at,updated_at",
    )
    .eq("subject_id", subjectId)
    .order("exam_number", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: (data ?? []) as ExamRow[] });
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const body = (await req.json().catch(() => null)) as
    | {
        subject_id: string;
        exam_number: number;
        title: string;
        is_free?: boolean;
        duration_seconds?: number;
        pass_percent?: number;
        max_attempts?: number | null;
        min_score?: number;
        total_points?: number;
      }
    | null;

  if (!body?.subject_id || typeof body.exam_number !== "number" || !body.title?.trim()) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const payload: Record<string, unknown> = {
    subject_id: body.subject_id,
    exam_number: Math.max(1, Math.trunc(body.exam_number)),
    title: body.title.trim(),
  };
  if ("is_free" in body) payload.is_free = !!body.is_free;
  if (typeof body.duration_seconds === "number") payload.duration_seconds = Math.max(1, Math.trunc(body.duration_seconds));
  if (typeof body.pass_percent === "number") payload.pass_percent = Math.max(0, Math.min(100, Math.trunc(body.pass_percent)));
  if ("max_attempts" in body) {
    payload.max_attempts =
      body.max_attempts === null ? null : typeof body.max_attempts === "number" ? Math.max(1, Math.trunc(body.max_attempts)) : null;
  }
  if (typeof body.min_score === "number") payload.min_score = Math.max(0, Math.min(800, Math.trunc(body.min_score)));
  if (typeof body.total_points === "number") payload.total_points = Math.max(1, Math.trunc(body.total_points));

  const { data, error } = await admin
    .from("exams")
    .insert(payload)
    .select(
      "id,subject_id,exam_number,title,is_free,duration_seconds,pass_percent,max_attempts,min_score,total_points,created_at,updated_at",
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ exam: data as ExamRow });
}

