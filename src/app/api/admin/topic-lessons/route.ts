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
          question_bank(*)
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

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  try {
    const body = await req.json();
    const { action, ...payload } = body;

    if (action === "sync_subtopic_points") {
      const { subtopic_id, points } = payload;
      
      // 1. Get existing points
      const { data: existingPoints } = await supabase.from("subtopic_points").select("id").eq("subtopic_id", subtopic_id);
      const existingIds = new Set((existingPoints || []).map(p => p.id));

      const incomingIds = new Set(points.filter((p: any) => p.id).map((p: any) => p.id));

      // 2. Delete removed points
      const toDelete = Array.from(existingIds).filter(id => !incomingIds.has(id));
      if (toDelete.length > 0) {
        await supabase.from("subtopic_points").delete().in("id", toDelete);
      }

      // 3. Upsert points, assets, and questions
      for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        let pointId = pt.id;

        if (!pointId) {
          const { data, error } = await supabase
            .from("subtopic_points")
            .insert({ subtopic_id, content_html: pt.content_html, sort_order: i })
            .select().single();
          if (error) throw error;
          pointId = data.id;
        } else {
          await supabase
            .from("subtopic_points")
            .update({ content_html: pt.content_html, sort_order: i })
            .eq("id", pointId);
        }

        // Assets (Recreate all for simplicity)
        await supabase.from("subtopic_point_assets").delete().eq("point_id", pointId);
        if (pt.assets && pt.assets.length > 0) {
          await supabase.from("subtopic_point_assets").insert(
            pt.assets.map((a: any, aIdx: number) => ({ ...a, point_id: pointId, sort_order: aIdx }))
          );
        }

        // Questions (Recreate all)
        await supabase.from("subtopic_point_questions").delete().eq("point_id", pointId);
        if (pt.questions && pt.questions.length > 0) {
          await supabase.from("subtopic_point_questions").insert(
            pt.questions.map((qId: string, qIdx: number) => ({ point_id: pointId, question_id: qId, sort_order: qIdx }))
          );
        }
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
