import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user ?? null;
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json();
    const { subtopic_id, subject_id } = body;
    if (!subtopic_id || !subject_id) {
      return NextResponse.json({ error: "subtopic_id and subject_id are required" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from("lesson_completions")
      .upsert(
        { user_id: user.id, subtopic_id, subject_id },
        { onConflict: "user_id, subtopic_id", ignoreDuplicates: true }
      );

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user ?? null;
    if (!user) return NextResponse.json({ completed: [] });

    const { searchParams } = new URL(req.url);
    const subjectId = searchParams.get("subject_id");

    const admin = getSupabaseAdmin();
    let query = admin
      .from("lesson_completions")
      .select("subtopic_id")
      .eq("user_id", user.id);

    if (subjectId) {
      query = query.eq("subject_id", subjectId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ completed: (data || []).map(d => d.subtopic_id) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
