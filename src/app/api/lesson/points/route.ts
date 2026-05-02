import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const subtopicId = searchParams.get("subtopic_id");

  if (!subtopicId) return NextResponse.json({ error: "subtopic_id is required" }, { status: 400 });

  try {
    const { data, error } = await supabase
      .from("subtopic_points")
      .select(`
        *,
        subtopic_point_assets(*),
        subtopic_point_questions(
          id, point_id, question_id, sort_order,
          question_bank(*, question_bank_options(*))
        )
      `)
      .eq("subtopic_id", subtopicId)
      .order("sort_order", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ points: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
