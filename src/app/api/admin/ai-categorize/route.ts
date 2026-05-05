import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromBearer } from "@/lib/adminGuard";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";

type TopicRow = { id: string; title: string; subject_id: string };
type SubtopicRow = { id: string; title: string; topic_id: string; subject_id: string };
type QuestionRow = { id: string; prompt_text: string; type: string; topic_id: string | null; subtopic_id: string | null; parent_id: string | null };

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  try {
    const body = await req.json();
    const { exam_ids, question_ids, source = "exam_questions" } = body as {
      exam_ids?: string[];
      question_ids?: string[];
      source?: "exam_questions" | "question_bank";
    };

    if (!exam_ids?.length && !question_ids?.length) {
      return NextResponse.json({ error: "Provide exam_ids or question_ids" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // 1. Fetch all topics and subtopics
    const { data: topics } = await admin.from("topics").select("id, title, subject_id");
    const { data: subtopics } = await admin.from("subtopics").select("id, title, topic_id, subject_id");
    const { data: subjects } = await admin.from("subjects").select("id, title");

    // 2. Fetch questions
    let questions: QuestionRow[] = [];

    if (exam_ids?.length) {
      // Fetch all questions for the specified exams
      const { data: examQuestions } = await admin
        .from("exam_questions")
        .select("id, prompt_text, type, topic_id, subtopic_id, parent_id")
        .in("exam_id", exam_ids)
        .order("question_number");

      questions = (examQuestions || []).map(q => ({
        ...q,
        prompt_text: q.prompt_text?.substring(0, 500) || "(no prompt)",
      }));
    } else if (question_ids?.length) {
      const table = source === "question_bank" ? "question_bank" : "exam_questions";
      const { data: qs } = await admin
        .from(table)
        .select("id, prompt_text, type, topic_id, subtopic_id, parent_id")
        .in("id", question_ids);

      questions = (qs || []).map(q => ({
        ...q,
        prompt_text: q.prompt_text?.substring(0, 500) || "(no prompt)",
      }));
    }

    if (questions.length === 0) {
      return NextResponse.json({ error: "No questions found" }, { status: 400 });
    }

    // 3. Build the system prompt
    const topicsList = (topics as TopicRow[] || []).map(t =>
      `  { id: "${t.id}", title: "${t.title}", subject_id: "${t.subject_id}" }`
    ).join("\n");

    const subtopicsList = (subtopics as SubtopicRow[] || []).map(s =>
      `  { id: "${s.id}", title: "${s.title}", topic_id: "${s.topic_id}", subject_id: "${s.subject_id}" }`
    ).join("\n");

    const subjectsList = (subjects || []).map((s: any) =>
      `  { id: "${s.id}", title: "${s.title}" }`
    ).join("\n");

    const questionsList = questions.map(q =>
      `  { id: "${q.id}", prompt: "${q.prompt_text?.replace(/"/g, '\\"').substring(0, 300)}", type: "${q.type}" }`
    ).join("\n");

    const systemPrompt = `You are an expert educational content classifier specialized in the EST (Egyptian Scholastic Test) curriculum. Your task is to classify exam questions into their correct TOPIC and SUBTOPIC.

=== AVAILABLE SUBJECTS ===
${subjectsList}

=== AVAILABLE TOPICS ===
${topicsList}

=== AVAILABLE SUBTOPICS ===
${subtopicsList}

=== RULES ===
1. A subtopic belongs to exactly one topic (identified by topic_id).
2. A topic belongs to exactly one subject (identified by subject_id).
3. Each question must be assigned to a TOPIC and a SUBTOPIC.
4. If a question tests a concept that spans multiple topics, pick the MOST SPECIFIC / PRIMARY topic.
5. For "fill in the gap" or vocabulary questions, assign based on the CONTENT area being tested.
6. For "reference_block" type questions (reading comprehension), they typically belong to "Reading Comprehension" related topics.
7. If you are unsure, pick the closest matching topic/subtopic.

=== QUESTIONS TO CLASSIFY ===
${questionsList}

=== OUTPUT FORMAT ===
Return ONLY a valid JSON object with this exact structure (no markdown, no code fences, just raw JSON):
{
  "mappings": [
    { "question_id": "<uuid>", "topic_id": "<uuid>", "subtopic_id": "<uuid>", "confidence": "high|medium|low" }
  ]
}

Return a mapping for EVERY question in the list above.`;

    // 4. Call DeepSeek
    const deepseekRes = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Please classify the questions listed above into their correct topics and subtopics. Return only the JSON object." },
        ],
        temperature: 0.1,
        max_tokens: 16384,
        response_format: { type: "json_object" },
      }),
    });

    if (!deepseekRes.ok) {
      const errText = await deepseekRes.text();
      console.error("[AI Categorize] DeepSeek error:", errText);
      return NextResponse.json({ error: "AI service error: " + errText.substring(0, 200) }, { status: 502 });
    }

    const deepseekJson = await deepseekRes.json();
    const content = deepseekJson.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: "Empty AI response" }, { status: 502 });
    }

    // 5. Parse AI response
    let mappings: { question_id: string; topic_id: string; subtopic_id: string; confidence: string }[] = [];
    try {
      const parsed = JSON.parse(content);
      mappings = parsed.mappings || [];
    } catch {
      // Try extracting JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          mappings = parsed.mappings || [];
        } catch { }
      }
    }

    if (mappings.length === 0) {
      return NextResponse.json({ error: "AI returned no valid mappings", raw: content.substring(0, 500) }, { status: 502 });
    }

    // 6. Validate mappings (check topic_id and subtopic_id exist)
    const validTopicIds = new Set((topics as TopicRow[] || []).map(t => t.id));
    const validSubtopicIds = new Set((subtopics as SubtopicRow[] || []).map(s => s.id));
    const validQuestionIds = new Set(questions.map(q => q.id));

    const validMappings = mappings.filter(m =>
      validQuestionIds.has(m.question_id) &&
      validTopicIds.has(m.topic_id) &&
      validSubtopicIds.has(m.subtopic_id)
    );

    if (validMappings.length === 0) {
      return NextResponse.json({ error: "All AI mappings had invalid IDs", sample: mappings.slice(0, 3) }, { status: 502 });
    }

    // 7. Update database - build batch updates
    const updates = validMappings.map(m => ({
      id: m.question_id,
      topic_id: m.topic_id,
      subtopic_id: m.subtopic_id,
    }));

    const table = question_ids?.length && source === "question_bank" ? "question_bank" : "exam_questions";

    for (const update of updates) {
      const { error: updateErr } = await admin
        .from(table)
        .update({ topic_id: update.topic_id, subtopic_id: update.subtopic_id })
        .eq("id", update.id);

      if (updateErr) {
        console.error(`[AI Categorize] Failed to update question ${update.id}:`, updateErr);
      }
    }

    const skipped = mappings.length - validMappings.length;
    const high = validMappings.filter(m => m.confidence === "high").length;
    const medium = validMappings.filter(m => m.confidence === "medium").length;
    const low = validMappings.filter(m => m.confidence === "low").length;

    return NextResponse.json({
      success: true,
      total_questions: questions.length,
      updated: validMappings.length,
      skipped,
      confidence: { high, medium, low },
      details: validMappings.slice(0, 20),
      usage: deepseekJson.usage,
    });

  } catch (err: any) {
    console.error("[AI Categorize] Error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
