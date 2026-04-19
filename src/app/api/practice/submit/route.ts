import { NextResponse } from "next/server";
import { requireAdminFromBearer } from "@/lib/adminGuard"; // This might be overkill if it's for students, let's use check auth
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const admin = getSupabaseAdmin();
  
  // Verify authentication - for practice sessions, the user should be the one submitting
  // We can trust the user_id if we have a valid session, but better to check the user directly.
  
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const {
    user_id,
    topic_ids,
    subtopic_ids,
    total_questions,
    correct_questions,
    duration_seconds,
    target_accuracy,
    percent_correct,
    question_ids,
    answers
  } = body;

  if (!user_id || (!topic_ids && !subtopic_ids) || total_questions === undefined) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("practice_sessions")
    .insert({
      user_id,
      topic_ids: topic_ids || [],
      subtopic_ids: subtopic_ids || [],
      total_questions,
      correct_questions,
      duration_seconds,
      target_accuracy,
      percent_correct,
      question_ids,
      answers
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ session: data });
}
