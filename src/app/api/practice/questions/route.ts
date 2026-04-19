import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const topicIdsRaw = searchParams.get("topic_ids");
  const subtopicIdsRaw = searchParams.get("subtopic_ids");
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 20), 1), 100);

  if (!topicIdsRaw && !subtopicIdsRaw) {
    return NextResponse.json({ error: "No topics or subtopics provided." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  let questions: any[] = [];
  let error: any = null;

  if (subtopicIdsRaw) {
    const subtopicIds = subtopicIdsRaw.split(",");
    console.log("API Practice Questions: Requesting for subtopics:", subtopicIds);
    const { data, error: stErr } = await admin.rpc("get_random_questions_by_subtopics", {
      p_subtopic_ids: subtopicIds,
      p_limit: limit
    });
    questions = data || [];
    error = stErr;
  } else {
    // Fallback or Topic-only legacy support
    const topicIds = topicIdsRaw!.split(",");
    console.log("API Practice Questions: Requesting for topics (legacy):", topicIds);
    const { data, error: tErr } = await admin.rpc("get_random_questions_by_topics", {
      p_topic_ids: topicIds,
      p_limit: limit
    });
    questions = data || [];
    error = tErr;
  }

  if (error) {
    console.error("API Practice Questions: RPC Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  console.log("API Practice Questions: RPC found items count:", (questions as any[]).length);

  // Fetch options and assets for these questions
  const qIds = (questions as any[]).map(q => q.id);
  
  const { data: options } = await admin
    .from("exam_question_options")
    .select("*")
    .in("question_id", qIds);

  const { data: promptAssets } = await admin
    .from("exam_question_prompt_assets")
    .select("*")
    .in("question_id", qIds);

  const { data: passages } = await admin
    .from("exam_passages")
    .select("*")
    .in("id", (questions as any[]).map(q => q.passage_id).filter(Boolean));

  // Assemble the complex question objects
  const enriched = (questions as any[]).map(q => ({
    ...q,
    options: (options || []).filter(o => o.question_id === q.id).sort((a, b) => a.option_number - b.option_number),
    prompt_assets: (promptAssets || []).filter(a => a.question_id === q.id),
    passage: (passages || []).find(p => p.id === q.passage_id) || null
  }));

  return NextResponse.json({ items: enriched });
}
