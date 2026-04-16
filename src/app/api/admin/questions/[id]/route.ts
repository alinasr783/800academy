import { NextResponse } from "next/server";
import { requireAdminFromBearer } from "@/lib/adminGuard";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

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
  created_at: string;
  updated_at: string;
};

type QuestionAssetRow = {
  id: string;
  question_id: string;
  bucket: string;
  storage_path: string | null;
  url: string | null;
  alt: string | null;
  kind: "prompt" | "explanation";
  sort_order: number;
  created_at: string;
};

type OptionRow = {
  id: string;
  question_id: string;
  option_number: number;
  text: string | null;
  bucket: string;
  storage_path: string | null;
  url: string | null;
  is_correct: boolean;
  created_at: string;
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

  const { data: question, error } = await admin
    .from("exam_questions")
    .select(
      "id,exam_id,question_number,type,prompt_text,explanation_text,points,allow_multiple,correct_text,passage_id,created_at,updated_at",
    )
    .eq("id", id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  const { data: assets } = await admin
    .from("exam_question_assets")
    .select("id,question_id,bucket,storage_path,url,alt,kind,sort_order,created_at")
    .eq("question_id", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const { data: options } = await admin
    .from("exam_question_options")
    .select("id,question_id,option_number,text,bucket,storage_path,url,is_correct,created_at")
    .eq("question_id", id)
    .order("option_number", { ascending: true });

  return NextResponse.json({
    question: question as QuestionRow,
    assets: (assets ?? []) as QuestionAssetRow[],
    options: (options ?? []) as OptionRow[],
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Partial<
    Pick<
      QuestionRow,
      "type" | "prompt_text" | "explanation_text" | "points" | "allow_multiple" | "correct_text" | "passage_id"
    >
  > | null;
  if (!body) return NextResponse.json({ error: "Invalid body." }, { status: 400 });

  const { admin, error: adminErr } = getAdminOrFail();
  if (!admin) return NextResponse.json({ error: adminErr }, { status: 500 });

  const patch: Record<string, unknown> = {};
  if ("type" in body && (body.type === "mcq" || body.type === "fill")) patch.type = body.type;
  if ("prompt_text" in body) patch.prompt_text = body.prompt_text ?? null;
  if ("explanation_text" in body) patch.explanation_text = body.explanation_text ?? null;
  if ("points" in body && typeof body.points === "number") patch.points = Math.max(0, Math.trunc(body.points));
  if ("allow_multiple" in body) patch.allow_multiple = !!body.allow_multiple;
  if ("correct_text" in body) patch.correct_text = body.correct_text ?? null;
  if ("passage_id" in body) patch.passage_id = body.passage_id ?? null;

  const { data, error } = await admin
    .from("exam_questions")
    .update(patch)
    .eq("id", id)
    .select(
      "id,exam_id,question_number,type,prompt_text,explanation_text,points,allow_multiple,correct_text,passage_id,created_at,updated_at",
    )
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ question: data as QuestionRow });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const { id } = await params;
  const { admin, error: adminErr } = getAdminOrFail();
  if (!admin) return NextResponse.json({ error: adminErr }, { status: 500 });

  const { error } = await admin.from("exam_questions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  const { id: questionId } = await params;
  const body = (await req.json().catch(() => null)) as
    | (
        | {
            action: "create_option";
            option_number?: number;
            text?: string | null;
            bucket?: string;
            storage_path?: string | null;
            url?: string | null;
            is_correct?: boolean;
          }
        | {
            action: "update_option";
            option_id: string;
            option_number?: number;
            text?: string | null;
            bucket?: string;
            storage_path?: string | null;
            url?: string | null;
            is_correct?: boolean;
          }
        | { action: "delete_option"; option_id: string }
        | { action: "reorder_options"; option_ids_in_order: string[] }
        | {
            action: "create_asset";
            bucket?: string;
            storage_path?: string | null;
            url?: string | null;
            alt?: string | null;
            kind?: "prompt" | "explanation";
            sort_order?: number;
          }
        | {
            action: "update_asset";
            asset_id: string;
            bucket?: string;
            storage_path?: string | null;
            url?: string | null;
            alt?: string | null;
            kind?: "prompt" | "explanation";
            sort_order?: number;
          }
        | { action: "delete_asset"; asset_id: string }
      )
    | null;

  if (!body?.action) return NextResponse.json({ error: "Invalid body." }, { status: 400 });

  const { admin, error: adminErr } = getAdminOrFail();
  if (!admin) return NextResponse.json({ error: adminErr }, { status: 500 });

  if (body.action === "create_option") {
    let nextNum = body.option_number ? Math.max(1, Math.trunc(body.option_number)) : 0;
    if (!nextNum) {
      const { data: maxRows, error } = await admin
        .from("exam_question_options")
        .select("option_number")
        .eq("question_id", questionId)
        .order("option_number", { ascending: false })
        .limit(1);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      const max = (maxRows?.[0]?.option_number as number | undefined) ?? 0;
      nextNum = max + 1;
    }

    const { data, error } = await admin
      .from("exam_question_options")
      .insert({
        question_id: questionId,
        option_number: nextNum,
        text: body.text ?? null,
        bucket: body.bucket?.trim() || "assets",
        storage_path: body.storage_path ?? null,
        url: body.url ?? null,
        is_correct: !!body.is_correct,
      })
      .select("id,question_id,option_number,text,bucket,storage_path,url,is_correct,created_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ option: data as OptionRow });
  }

  if (body.action === "update_option") {
    const optionId = body.option_id;
    if (!optionId) return NextResponse.json({ error: "Missing option_id." }, { status: 400 });
    const patch: Record<string, unknown> = {};
    if ("option_number" in body && typeof body.option_number === "number") {
      patch.option_number = Math.max(1, Math.trunc(body.option_number));
    }
    if ("text" in body) patch.text = body.text ?? null;
    if ("bucket" in body && typeof body.bucket === "string") patch.bucket = body.bucket.trim() || "assets";
    if ("storage_path" in body) patch.storage_path = body.storage_path ?? null;
    if ("url" in body) patch.url = body.url ?? null;
    if ("is_correct" in body) patch.is_correct = !!body.is_correct;

    const { data, error } = await admin
      .from("exam_question_options")
      .update(patch)
      .eq("id", optionId)
      .eq("question_id", questionId)
      .select("id,question_id,option_number,text,bucket,storage_path,url,is_correct,created_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ option: data as OptionRow });
  }

  if (body.action === "delete_option") {
    const optionId = body.option_id;
    if (!optionId) return NextResponse.json({ error: "Missing option_id." }, { status: 400 });
    const { error } = await admin
      .from("exam_question_options")
      .delete()
      .eq("id", optionId)
      .eq("question_id", questionId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "reorder_options") {
    const ids = body.option_ids_in_order;
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Missing option_ids_in_order." }, { status: 400 });
    }
    const updates = ids.map((oid, idx) => ({
      id: oid,
      question_id: questionId,
      option_number: idx + 1,
    }));
    const { error } = await admin.from("exam_question_options").upsert(updates, { onConflict: "id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "create_asset") {
    const { data, error } = await admin
      .from("exam_question_assets")
      .insert({
        question_id: questionId,
        bucket: body.bucket?.trim() || "assets",
        storage_path: body.storage_path ?? null,
        url: body.url ?? null,
        alt: body.alt ?? null,
        kind: body.kind === "explanation" ? "explanation" : "prompt",
        sort_order: Math.trunc(body.sort_order ?? 0),
      })
      .select("id,question_id,bucket,storage_path,url,alt,kind,sort_order,created_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ asset: data as QuestionAssetRow });
  }

  if (body.action === "update_asset") {
    const assetId = body.asset_id;
    if (!assetId) return NextResponse.json({ error: "Missing asset_id." }, { status: 400 });
    const patch: Record<string, unknown> = {};
    if ("bucket" in body && typeof body.bucket === "string") patch.bucket = body.bucket.trim() || "assets";
    if ("storage_path" in body) patch.storage_path = body.storage_path ?? null;
    if ("url" in body) patch.url = body.url ?? null;
    if ("alt" in body) patch.alt = body.alt ?? null;
    if ("kind" in body) patch.kind = body.kind === "explanation" ? "explanation" : "prompt";
    if ("sort_order" in body && typeof body.sort_order === "number") patch.sort_order = Math.trunc(body.sort_order);

    const { data, error } = await admin
      .from("exam_question_assets")
      .update(patch)
      .eq("id", assetId)
      .eq("question_id", questionId)
      .select("id,question_id,bucket,storage_path,url,alt,kind,sort_order,created_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ asset: data as QuestionAssetRow });
  }

  if (body.action === "delete_asset") {
    const assetId = body.asset_id;
    if (!assetId) return NextResponse.json({ error: "Missing asset_id." }, { status: 400 });
    const { error } = await admin
      .from("exam_question_assets")
      .delete()
      .eq("id", assetId)
      .eq("question_id", questionId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
