import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const topicId = searchParams.get("topic_id");
  const subtopicId = searchParams.get("subtopic_id");
  const type = searchParams.get("type");

  try {
    let query = supabase
      .from("question_bank")
      .select(`
        *,
        question_bank_options(*),
        question_bank_assets(*)
      `)
      .is("parent_id", null)
      .order("created_at", { ascending: false });

    if (topicId) query = query.eq("topic_id", topicId);
    if (subtopicId) query = query.eq("subtopic_id", subtopicId);
    if (type) query = query.eq("type", type);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ items: data });
  } catch (err: any) {
    console.error("[QuestionBank GET Error]:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  try {
    const body = await req.json();
    const { action, ...payload } = body;

    if (action === "create_question") {
      const { data, error } = await supabase
        .from("question_bank")
        .insert({
          type: payload.type,
          prompt_text: payload.prompt_text,
          explanation_text: payload.explanation_text,
          points: payload.points,
          allow_multiple: payload.allow_multiple,
          correct_text: payload.correct_text,
          topic_id: payload.topic_id,
          subtopic_id: payload.subtopic_id,
          parent_id: payload.parent_id
        })
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ question: data });
    }

    if (action === "batch_options") {
      const { question_id, options } = payload;
      // Delete old options first
      await supabase.from("question_bank_options").delete().eq("question_id", question_id);
      // Insert new ones
      const { data, error } = await supabase
        .from("question_bank_options")
        .insert(options.map((o: any) => ({ ...o, question_id })))
        .select();
      if (error) throw error;
      return NextResponse.json({ options: data });
    }

    if (action === "batch_assets") {
      const { question_id, assets } = payload;
      // Note: Usually we don't delete assets to avoid orphaned files, but for simplicity:
      await supabase.from("question_bank_assets").delete().eq("question_id", question_id);
      const { data, error } = await supabase
        .from("question_bank_assets")
        .insert(assets.map((a: any) => ({ ...a, question_id })))
        .select();
      if (error) throw error;
      return NextResponse.json({ assets: data });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("[QuestionBank POST Error]:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
