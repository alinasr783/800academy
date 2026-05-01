import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  try {
    const { data: question, error: qErr } = await supabase
      .from("question_bank")
      .select(`
        *,
        question_bank_options(*),
        question_bank_assets(*)
      `)
      .eq("id", id)
      .single();
    if (qErr) {
      console.error("[QuestionBank GET ID Error] Query failed:", qErr);
      throw qErr;
    }
    if (!question) {
      console.error("[QuestionBank GET ID Error] Question not found for ID:", id);
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    console.log("[QuestionBank GET ID Success] Loaded ID:", id);
    return NextResponse.json({ question });
  } catch (err: any) {
    console.error("[QuestionBank GET ID Crash]:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  try {
    const body = await req.json();
    const { data, error } = await supabase
      .from("question_bank")
      .update(body)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ question: data });
  } catch (err: any) {
    console.error("[QuestionBank PATCH ID Error]:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  try {
    console.log("[QuestionBank DELETE] Step 1: Deleting options and assets for main question:", id);
    const { error: optErr } = await supabase.from("question_bank_options").delete().eq("question_id", id);
    if (optErr) console.error("[QuestionBank DELETE] options delete error:", optErr);
    
    const { error: astErr } = await supabase.from("question_bank_assets").delete().eq("question_id", id);
    if (astErr) console.error("[QuestionBank DELETE] assets delete error:", astErr);

    console.log("[QuestionBank DELETE] Step 2: Finding sub-questions for parent:", id);
    const { data: children, error: childFetchErr } = await supabase
      .from("question_bank")
      .select("id")
      .eq("parent_id", id);
    
    if (childFetchErr) console.error("[QuestionBank DELETE] children fetch error:", childFetchErr);

    if (children && children.length > 0) {
      console.log(`[QuestionBank DELETE] Step 3: Deleting ${children.length} sub-questions...`);
      for (const child of children) {
        console.log(`[QuestionBank DELETE] Deleting child: ${child.id}`);
        await supabase.from("question_bank_options").delete().eq("question_id", child.id);
        await supabase.from("question_bank_assets").delete().eq("question_id", child.id);
        const { error: cDelErr } = await supabase.from("question_bank").delete().eq("id", child.id);
        if (cDelErr) console.error(`[QuestionBank DELETE] Failed to delete child ${child.id}:`, cDelErr);
      }
    }

    const { error: delErr } = await supabase.from("question_bank").delete().eq("id", id);
    if (delErr) {
      console.error("[QuestionBank DELETE ID Error] Final delete failed:", delErr);
      throw delErr;
    }
    
    console.log("[QuestionBank DELETE ID Success] Deleted ID:", id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[QuestionBank DELETE ID Crash]:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
