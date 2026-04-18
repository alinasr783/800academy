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

type ExamAssetRow = {
  id: string;
  exam_id: string;
  bucket: string;
  storage_path: string | null;
  url: string | null;
  sort_order: number;
  created_at: string;
};

type QuestionRow = {
  id: string;
  exam_id: string;
  question_number: number;
  type: "mcq" | "fill";
  prompt_text: string | null;
  explanation_text: string | null;
  points: number;
  allow_multiple: boolean;
  correct_text: string | null;
  passage_id: string | null;
  topic_id: string | null;
  created_at: string;
  updated_at: string;
};

type PassageRow = {
  id: string;
  exam_id: string;
  sort_order: number;
  kind: "reading" | "reference";
  title: string | null;
  body_html: string;
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

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const { id } = await params;
  const { admin, error: adminErr } = getAdminOrFail();
  if (!admin) return NextResponse.json({ error: adminErr }, { status: 500 });

  const { data: exam, error } = await admin
    .from("exams")
    .select(
      "id,subject_id,exam_number,title,is_free,duration_seconds,pass_percent,max_attempts,min_score,total_points,created_at,updated_at",
    )
    .eq("id", id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  const { data: assets } = await admin
    .from("exam_assets")
    .select("id,exam_id,bucket,storage_path,url,sort_order,created_at")
    .eq("exam_id", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const { data: questions } = await admin
    .from("exam_questions")
    .select(
      "id,exam_id,question_number,type,prompt_text,explanation_text,points,allow_multiple,correct_text,passage_id,created_at,updated_at",
    )
    .eq("exam_id", id)
    .order("question_number", { ascending: true });

  const { data: passages } = await admin
    .from("exam_passages")
    .select("id,exam_id,sort_order,kind,title,body_html,created_at,updated_at")
    .eq("exam_id", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return NextResponse.json({
    exam: exam as ExamRow,
    assets: (assets ?? []) as ExamAssetRow[],
    questions: (questions ?? []) as QuestionRow[],
    passages: (passages ?? []) as PassageRow[],
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const body = (await req.json().catch(() => null)) as Partial<
    Pick<
      ExamRow,
      | "title"
      | "exam_number"
      | "is_free"
      | "duration_seconds"
      | "pass_percent"
      | "max_attempts"
      | "min_score"
      | "total_points"
    >
  > | null;
  if (!body) return NextResponse.json({ error: "Invalid body." }, { status: 400 });

  const { id } = await params;
  const { admin, error: adminErr } = getAdminOrFail();
  if (!admin) return NextResponse.json({ error: adminErr }, { status: 500 });

  const patch: Record<string, unknown> = {};
  if ("title" in body && typeof body.title === "string") patch.title = body.title.trim();
  if ("exam_number" in body && typeof body.exam_number === "number") {
    patch.exam_number = Math.max(1, Math.trunc(body.exam_number));
  }
  if ("is_free" in body) patch.is_free = !!body.is_free;
  if ("duration_seconds" in body && typeof body.duration_seconds === "number") {
    patch.duration_seconds = Math.max(1, Math.trunc(body.duration_seconds));
  }
  if ("pass_percent" in body && typeof body.pass_percent === "number") {
    patch.pass_percent = Math.max(0, Math.min(100, Math.trunc(body.pass_percent)));
  }
  if ("max_attempts" in body) {
    patch.max_attempts =
      body.max_attempts === null
        ? null
        : typeof body.max_attempts === "number"
          ? Math.max(1, Math.trunc(body.max_attempts))
          : null;
  }
  if ("min_score" in body && typeof body.min_score === "number") {
    patch.min_score = Math.max(0, Math.min(800, Math.trunc(body.min_score)));
  }
  if ("total_points" in body && typeof body.total_points === "number") {
    patch.total_points = Math.max(1, Math.trunc(body.total_points));
  }

  const { data, error } = await admin
    .from("exams")
    .update(patch)
    .eq("id", id)
    .select(
      "id,subject_id,exam_number,title,is_free,duration_seconds,pass_percent,max_attempts,min_score,total_points,created_at,updated_at",
    )
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ exam: data as ExamRow });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const { id } = await params;
  const { admin, error: adminErr } = getAdminOrFail();
  if (!admin) return NextResponse.json({ error: adminErr }, { status: 500 });

  const { error } = await admin.from("exams").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const { id: examId } = await params;
  const body = (await req.json().catch(() => null)) as
    | (
        | {
            action: "create_asset";
            bucket?: string;
            storage_path?: string | null;
            url?: string | null;
            sort_order?: number;
          }
        | {
            action: "update_asset";
            asset_id: string;
            bucket?: string;
            storage_path?: string | null;
            url?: string | null;
            sort_order?: number;
          }
        | { action: "delete_asset"; asset_id: string }
        | {
            action: "create_question";
            type: "mcq" | "fill";
            question_number?: number;
            passage_id?: string | null;
            prompt_text?: string | null;
            explanation_text?: string | null;
            points?: number;
            allow_multiple?: boolean;
            correct_text?: string | null;
            topic_id?: string | null;
          }
        | { action: "delete_question"; question_id: string }
        | { action: "reorder_questions"; question_ids_in_order: string[] }
        | {
            action: "create_passage";
            title?: string | null;
            body_html: string;
            sort_order?: number;
          }
        | {
            action: "update_passage";
            passage_id: string;
            title?: string | null;
            body_html?: string;
            sort_order?: number;
          }
        | { action: "delete_passage"; passage_id: string }
      )
    | null;

  if (!body?.action) return NextResponse.json({ error: "Invalid body." }, { status: 400 });

  const { admin, error: adminErr } = getAdminOrFail();
  if (!admin) return NextResponse.json({ error: adminErr }, { status: 500 });

  if (body.action === "create_asset") {
    const { data, error } = await admin
      .from("exam_assets")
      .insert({
        exam_id: examId,
        bucket: body.bucket?.trim() || "assets",
        storage_path: body.storage_path ?? null,
        url: body.url ?? null,
        sort_order: Math.trunc(body.sort_order ?? 0),
      })
      .select("id,exam_id,bucket,storage_path,url,sort_order,created_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ asset: data as ExamAssetRow });
  }

  if (body.action === "update_asset") {
    const assetId = body.asset_id;
    if (!assetId) return NextResponse.json({ error: "Missing asset_id." }, { status: 400 });

    const patch: Record<string, unknown> = {};
    if ("bucket" in body && typeof body.bucket === "string") patch.bucket = body.bucket.trim() || "assets";
    if ("storage_path" in body) patch.storage_path = body.storage_path ?? null;
    if ("url" in body) patch.url = body.url ?? null;
    if ("sort_order" in body && typeof body.sort_order === "number") patch.sort_order = Math.trunc(body.sort_order);

    const { data, error } = await admin
      .from("exam_assets")
      .update(patch)
      .eq("id", assetId)
      .eq("exam_id", examId)
      .select("id,exam_id,bucket,storage_path,url,sort_order,created_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ asset: data as ExamAssetRow });
  }

  if (body.action === "delete_asset") {
    const assetId = body.asset_id;
    if (!assetId) return NextResponse.json({ error: "Missing asset_id." }, { status: 400 });
    const { error } = await admin.from("exam_assets").delete().eq("id", assetId).eq("exam_id", examId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "create_question") {
    if (!body.type) return NextResponse.json({ error: "Missing type." }, { status: 400 });
    let nextNum = body.question_number ? Math.max(1, Math.trunc(body.question_number)) : 0;
    if (!nextNum) {
      const { data: maxRows, error } = await admin
        .from("exam_questions")
        .select("question_number")
        .eq("exam_id", examId)
        .order("question_number", { ascending: false })
        .limit(1);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      const max = (maxRows?.[0]?.question_number as number | undefined) ?? 0;
      nextNum = max + 1;
    }

    const { data, error } = await admin
      .from("exam_questions")
      .insert({
        exam_id: examId,
        question_number: nextNum,
        type: body.type,
        passage_id: body.passage_id ?? null,
        prompt_text: body.prompt_text ?? null,
        explanation_text: body.explanation_text ?? null,
        points: Math.max(0, Math.trunc(body.points ?? 0)),
        allow_multiple: !!body.allow_multiple,
        correct_text: body.type === "fill" ? (body.correct_text ?? null) : null,
        topic_id: body.topic_id ?? null,
      })
      .select(
        "id,exam_id,question_number,type,prompt_text,explanation_text,points,allow_multiple,correct_text,passage_id,topic_id,created_at,updated_at",
      )
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ question: data as QuestionRow });
  }

  if (body.action === "delete_question") {
    const qid = body.question_id;
    if (!qid) return NextResponse.json({ error: "Missing question_id." }, { status: 400 });
    const { error } = await admin.from("exam_questions").delete().eq("id", qid).eq("exam_id", examId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "reorder_questions") {
    const ids = body.question_ids_in_order;
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Missing question_ids_in_order." }, { status: 400 });
    }
    const updates = ids.map((qid, idx) => ({
      id: qid,
      exam_id: examId,
      question_number: idx + 1,
    }));

    const { error } = await admin.from("exam_questions").upsert(updates, { onConflict: "id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "create_passage") {
    const p = body as Partial<PassageRow>;
    if (typeof p.body_html !== "string" || !p.body_html.trim()) {
      return NextResponse.json({ error: "Passage body_html required." }, { status: 400 });
    }
    const kind = p.kind === "reference" ? "reference" : "reading";
    const { data, error } = await admin
      .from("exam_passages")
      .insert({
        exam_id: examId,
        title: p.title?.trim() || null,
        body_html: p.body_html.trim(),
        kind: kind,
        sort_order: typeof p.sort_order === "number" ? Math.trunc(p.sort_order) : 0,
      })
      .select("id,exam_id,sort_order,title,body_html,kind,created_at,updated_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ passage: data as PassageRow });
  }

  if (body.action === "update_passage") {
    const pid = body.passage_id;
    if (!pid) return NextResponse.json({ error: "Missing passage_id." }, { status: 400 });
    const p = body as Partial<PassageRow>;
    const patch: Record<string, unknown> = {};
    if ("title" in p) patch.title = typeof p.title === "string" ? p.title.trim() : null;
    if ("body_html" in p && typeof p.body_html === "string") patch.body_html = p.body_html.trim();
    if ("sort_order" in p && typeof p.sort_order === "number") patch.sort_order = Math.trunc(p.sort_order);
    if ("kind" in p && (p.kind === "reading" || p.kind === "reference")) patch.kind = p.kind;

    const { data, error } = await admin
      .from("exam_passages")
      .update(patch)
      .eq("id", pid)
      .eq("exam_id", examId)
      .select("id,exam_id,sort_order,title,body_html,kind,created_at,updated_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ passage: data as PassageRow });
  }

  if (body.action === "delete_passage") {
    const pid = body.passage_id;
    if (!pid) return NextResponse.json({ error: "Missing passage_id." }, { status: 400 });
    const { error } = await admin.from("exam_passages").delete().eq("id", pid).eq("exam_id", examId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
