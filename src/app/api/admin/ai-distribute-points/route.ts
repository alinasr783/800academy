import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromBearer } from "@/lib/adminGuard";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  try {
    const body = await req.json();
    const { exam_id, total_points } = body as { exam_id: string; total_points: number };

    if (!exam_id || !total_points) {
      return NextResponse.json({ error: "exam_id and total_points required" }, { status: 400 });
    }

    console.log("[AI-Points] Processing exam:", exam_id, "target:", total_points);

    const admin = getSupabaseAdmin();

    // 1. Fetch exam questions
    const { data: questions, error: qErr } = await admin
      .from("exam_questions")
      .select("id, prompt_text, type, points, question_number")
      .eq("exam_id", exam_id)
      .eq("type", "mcq")
      .order("question_number");

    if (qErr) throw qErr;
    if (!questions || questions.length === 0) {
      return NextResponse.json({ error: "No MCQ questions found in this exam" }, { status: 400 });
    }

    const questionCount = questions.length;
    console.log("[AI-Points] Found", questionCount, "MCQ questions");

    // 2. Build system prompt
    const questionsList = questions.map((q, i) =>
      `  [${i + 1}] id: "${q.id}", prompt: "${(q.prompt_text || "no text").replace(/"/g, '\\"').substring(0, 250)}"`
    ).join("\n");

    const systemPrompt = `You are an expert EST exam designer. Your task is to distribute points across exam questions based on difficulty.

=== CONTEXT ===
- Total points to distribute: ${total_points}
- Number of questions: ${questionCount}
- All questions are MCQ (Multiple Choice) type
- Points per question must be integers (whole numbers)
- The sum of all points must EXACTLY equal ${total_points} — no more, no less

=== DIFFICULTY RULES ===
- EASY questions: 1-3 points (basic recall, simple calculations, vocabulary identification)
- MEDIUM questions: 4-7 points (application, multi-step reasoning, grammar analysis)
- HARD questions: 8-12 points (complex analysis, synthesis, advanced problem-solving, inference)

=== QUESTIONS TO ANALYZE ===
${questionsList}

=== OUTPUT FORMAT ===
Return ONLY a valid JSON object with no markdown, no code fences:
{
  "distributions": [
    { "question_id": "<uuid>", "points": <integer>, "difficulty": "easy|medium|hard", "reason": "short reason" }
  ],
  "sum": <must equal ${total_points}>,
  "distribution_summary": {
    "easy": { "count": N, "total_points": N },
    "medium": { "count": N, "total_points": N },
    "hard": { "count": N, "total_points": N }
  }
}

IMPORTANT: Verify that sum of all points equals ${total_points}. DOUBLE CHECK before returning.`;

    // 3. Call DeepSeek
    console.log("[AI-Points] Calling DeepSeek...");
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
          { role: "user", content: `Distribute exactly ${total_points} points across these ${questionCount} questions based on their difficulty. Return only JSON. Double check the sum.` },
        ],
        temperature: 0.1,
        max_tokens: 16384,
        response_format: { type: "json_object" },
      }),
    });

    if (!deepseekRes.ok) {
      const errText = await deepseekRes.text();
      console.error("[AI-Points] DeepSeek error:", errText);
      return NextResponse.json({ error: "AI service error: " + errText.substring(0, 200) }, { status: 502 });
    }

    const deepseekJson = await deepseekRes.json();
    const content = deepseekJson.choices?.[0]?.message?.content;
    console.log("[AI-Points] DeepSeek responded, usage:", JSON.stringify(deepseekJson.usage), "content length:", content?.length);

    if (!content) {
      return NextResponse.json({ error: "Empty AI response" }, { status: 502 });
    }

    // 4. Parse AI response
    let distributions: { question_id: string; points: number; difficulty: string; reason: string }[] = [];
    let aiSum = 0;

    try {
      const parsed = JSON.parse(content);
      distributions = parsed.distributions || [];
      aiSum = parsed.sum || 0;
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          distributions = parsed.distributions || [];
          aiSum = parsed.sum || 0;
        } catch {}
      }
    }

    if (distributions.length === 0) {
      return NextResponse.json({ error: "AI returned no distributions", raw: content.substring(0, 300) }, { status: 502 });
    }

    // Force all points to integers (AI might return strings)
    distributions = distributions.map(d => ({
      ...d,
      points: Math.round(Number(d.points)) || 1,
      difficulty: d.difficulty || "medium",
    }));

    // Compute actual sum
    let actualSum = distributions.reduce((s, d) => s + d.points, 0);
    console.log("[AI-Points] Parsed", distributions.length, "distributions. Actual sum:", actualSum, "target:", total_points);

    // 5. Proportional adjustment to match target exactly
    if (actualSum !== total_points) {
      const ratio = total_points / actualSum;
      // Scale all points proportionally
      distributions = distributions.map(d => ({
        ...d,
        points: Math.round(d.points * ratio),
      }));
      
      // Fix rounding errors: add/subtract 1 point at a time from random questions
      let adjustedSum = distributions.reduce((s, d) => s + d.points, 0);
      let safety = 0;
      while (adjustedSum !== total_points && safety < 1000) {
        safety++;
        if (adjustedSum < total_points) {
          // Add 1 to a random question
          const i = Math.floor(Math.random() * distributions.length);
          distributions[i].points += 1;
        } else {
          // Remove 1 from a random question (but keep at least 1)
          const eligible = distributions.map((d, i) => d.points > 1 ? i : -1).filter(i => i >= 0);
          if (eligible.length > 0) {
            const i = eligible[Math.floor(Math.random() * eligible.length)];
            distributions[i].points -= 1;
          } else {
            // Can't reduce further, break
            break;
          }
        }
        adjustedSum = distributions.reduce((s, d) => s + d.points, 0);
      }
      
      console.log("[AI-Points] Adjusted sum:", adjustedSum, "after", safety, "iterations");
      actualSum = adjustedSum;
    }

    // Final sanity check
    if (actualSum !== total_points) {
      return NextResponse.json({
        error: `Could not balance points. AI provided: ${aiSum}, after adjustment: ${actualSum}, target: ${total_points}`,
        sample: distributions.slice(0, 5),
      }, { status: 500 });
    }

    console.log("[AI-Points] Sum verified:", actualSum);

    // 6. Update database
    const updates = distributions.map(d => ({
      id: d.question_id,
      points: d.points,
    }));

    let updatedCount = 0;
    for (const update of updates) {
      const { error: updateErr } = await admin
        .from("exam_questions")
        .update({ points: update.points })
        .eq("id", update.id);

      if (updateErr) {
        console.error(`[AI-Points] Failed to update question ${update.id}:`, updateErr);
      } else {
        updatedCount++;
      }
    }

    console.log("[AI-Points] Updated", updatedCount, "/", updates.length, "questions in DB");

    const summary = {
      easy: distributions.filter(d => d.difficulty === "easy"),
      medium: distributions.filter(d => d.difficulty === "medium"),
      hard: distributions.filter(d => d.difficulty === "hard"),
    };

    return NextResponse.json({
      success: true,
      distributions,
      sum: actualSum,
      summary: {
        easy: { count: summary.easy.length, points: summary.easy.reduce((s, d) => s + d.points, 0) },
        medium: { count: summary.medium.length, points: summary.medium.reduce((s, d) => s + d.points, 0) },
        hard: { count: summary.hard.length, points: summary.hard.reduce((s, d) => s + d.points, 0) },
      },
      usage: deepseekJson.usage,
    });

  } catch (err: any) {
    console.error("[AI Distribute Points] Error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
