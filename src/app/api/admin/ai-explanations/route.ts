import { NextRequest, NextResponse } from "next/server";
import { requireAdminFromBearer } from "@/lib/adminGuard";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const DEEPSEEK_KEY = "sk-88def493360844168b01364f68a263d2";
const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const guard = await requireAdminFromBearer(auth);
  if (!guard.ok) return new NextResponse(null, { status: guard.status });

  try {
    const body = await req.json();
    const { question_ids, source = "exam_questions" } = body as {
      question_ids: string[];
      source?: "exam_questions" | "question_bank";
    };

    if (!question_ids?.length) {
      return NextResponse.json({ error: "question_ids required" }, { status: 400 });
    }

    console.log("[AI-Explain] Processing", question_ids.length, "questions from", source);

    const admin = getSupabaseAdmin();
    const table = source === "question_bank" ? "question_bank" : "exam_questions";

    // 1. Fetch questions with options
    const { data: questions, error: qErr } = await admin
      .from(table)
      .select(`id, prompt_text, type, correct_text`)
      .in("id", question_ids);

    if (qErr || !questions?.length) {
      return NextResponse.json({ error: qErr?.message || "No questions found" }, { status: 400 });
    }

    console.log("[AI-Explain] Loaded", questions.length, "questions, fetching options...");

    // Fetch options separately
    // Fetch options separately (different table per source)
    const optsTable = source === "question_bank" ? "question_bank_options" : "exam_question_options";
    const { data: allOpts } = await admin
      .from(optsTable)
      .select("*")
      .in("question_id", question_ids)
      .order("option_number");

    const optsByQuestion: Record<string, any[]> = {};
    (allOpts || []).forEach((opt: any) => {
      if (!optsByQuestion[opt.question_id]) optsByQuestion[opt.question_id] = [];
      optsByQuestion[opt.question_id].push(opt);
    });

    const allQuestions = questions.map((q: any) => ({
      ...q,
      question_bank_options: optsByQuestion[q.id] || [],
    }));

    console.log("[AI-Explain] Options mapped, question_bank_options sample:", Object.keys(optsByQuestion).length, "questions with options");

    // 2. Build the system prompt with explicit MathText/LaTeX rules
    const systemPrompt = `You are a concise EST tutor. Write short, simple explanations.

=== CRITICAL NOTATION RULES ===
NEVER write math symbols as plain text. ALWAYS use LaTeX inside dollar signs.

CORRECT examples (use EXACTLY like this):
- pi → $\\pi$
- 2π → $2\\pi$
- πr² → $\\pi r^{2}$
- x squared → $x^{2}$
- x cubed → $x^{3}$
- x to the power of n → $x^{n}$
- square root of x → $\\sqrt{x}$
- cube root of x → $\\sqrt[3]{x}$
- a over b (fraction) → $\\frac{a}{b}$
- x greater than or equal to 5 → $x \\geq 5$
- x less than or equal to 3 → $x \\leq 3$
- x not equal to y → $x \\neq y$
- x approximately equal to y → $x \\approx y$
- plus or minus → $\\pm$
- infinity → $\\infty$
- times → $\\times$
- dot product → $\\cdot$
- degrees → $90^{\\circ}$
- angle → $\\angle$
- perpendicular → $\\perp$
- alpha → $\\alpha$
- beta → $\\beta$
- theta → $\\theta$
- sigma → $\\sigma$
- delta → $\\Delta$
- lambda → $\\lambda$
- absolute value of x → $|x|$
- limit as x approaches 0 → $\\lim_{x \\to 0}$
- sum from 1 to n → $\\sum_{i=1}^{n}$
- integral from a to b → $\\int_{a}^{b}$
- log base 10 → $\\log_{10}$
- natural log → $\\ln$
- sin, cos, tan → $\\sin$, $\\cos$, $\\tan$
- therefore → $\\therefore$
- because → $\\because$
- set notation → $\\in$, $\\notin$, $\\subset$, $\\cup$, $\\cap$
- arrows → $\\rightarrow$, $\\Rightarrow$, $\\leftarrow$

FULL EXPRESSION EXAMPLES:
- $\\frac{-b \\pm \\sqrt{b^{2}-4ac}}{2a}$
- $a^{2} + b^{2} = c^{2}$
- $A = \\pi r^{2}$
- $\\sqrt{16} = 4$
- $\\frac{3}{4} + \\frac{1}{2} = \\frac{5}{4}$
- $\\log_{2}(8) = 3$
- $\\sin(30^{\\circ}) = \\frac{1}{2}`;

    // 3. Process questions one by one for better quality
    const results: any[] = [];
    let totalSuccess = 0;
    let totalFail = 0;

    for (const q of allQuestions) {
      try {
        const options = (q.question_bank_options || [])
          .map((o: any) => `    [${o.is_correct ? "✓" : " "}] ${o.text || ""}`)
          .join("\n");

        const userMsg = `Write a SHORT explanation for this ${q.type.toUpperCase()} question.

Question: ${q.prompt_text || "No prompt"}
${q.type === "mcq" ? `Options:\n${options}` : `Correct answer: ${q.correct_text || "N/A"}`}

RULES:
1. Maximum 3-4 short sentences
2. ALL math must use LaTeX: $\\pi$ not "pi", $x^{2}$ not "x^2", $\\frac{a}{b}$ not "a/b"
3. Explain WHY the correct answer is right and WHY wrong answers are wrong
4. Use simple English for EST students
5. NO prefix like "Explanation:" — just the text`;

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
              { role: "user", content: userMsg },
            ],
            temperature: 0.3,
            max_tokens: 1024,
          }),
        });

        if (!deepseekRes.ok) {
          console.error(`[AI-Explain] DeepSeek error for question ${q.id}`);
          totalFail++;
          results.push({ id: q.id, status: "failed", error: "AI service error" });
          continue;
        }

        const json = await deepseekRes.json();
        const explanation = json.choices?.[0]?.message?.content?.trim();

        if (!explanation) {
          console.error(`[AI-Explain] Empty response for question ${q.id}`);
          totalFail++;
          results.push({ id: q.id, status: "failed", error: "Empty response" });
          continue;
        }

        // Clean up explanation: remove any "Explanation:" prefix
        const cleaned = explanation
          .replace(/^explanation:?\s*/i, "")
          .replace(/^here'?s?\s*(the\s*)?explanation:?\s*/i, "")
          .trim();

        const { error: updateErr } = await admin
          .from(table)
          .update({ explanation_text: cleaned })
          .eq("id", q.id);

        if (updateErr) {
          console.error(`[AI-Explain] DB update error for ${q.id}:`, updateErr);
          totalFail++;
          results.push({ id: q.id, status: "failed", error: "DB update error" });
        } else {
          totalSuccess++;
          results.push({ id: q.id, status: "success", length: cleaned.length });
          console.log(`[AI-Explain] Updated question ${q.id} (${cleaned.length} chars)`);
        }
      } catch (e: any) {
        console.error(`[AI-Explain] Error processing question ${q.id}:`, e);
        totalFail++;
        results.push({ id: q.id, status: "failed", error: e.message });
      }
    }

    console.log(`[AI-Explain] Done: ${totalSuccess} success, ${totalFail} failed`);

    return NextResponse.json({
      success: true,
      total: allQuestions.length,
      updated: totalSuccess,
      failed: totalFail,
      results,
    });

  } catch (err: any) {
    console.error("[AI-Explain] Fatal error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
