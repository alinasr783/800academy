"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import BackButton from "@/components/BackButton";
import Breadcrumbs from "@/components/Breadcrumbs";
import MathText from "@/components/MathText";
import LoadingAnimation from "@/components/LoadingAnimation";

type Asset = {
  id: string;
  url: string | null;
  bucket: string | null;
  storage_path: string | null;
};

type Option = {
  id: string;
  option_number: number;
  text: string | null;
  url: string | null;
  bucket: string | null;
  storage_path: string | null;
  is_correct: boolean;
};

type Passage = {
  id: string;
  title: string | null;
  body_html: string;
  kind: "reading" | "reference";
};

type Question = {
  id: string;
  question_number: number;
  type: "mcq" | "fill";
  prompt_text: string | null;
  explanation_text: string | null;
  points: number;
  allow_multiple: boolean;
  correct_text: string | null;
  prompt_assets: Asset[];
  explanation_assets: Asset[];
  options: Option[];
  passage_id: string | null;
  subjectTitle: string;
  examTitle: string;
  mistakeId: string;
};

function assetUrl(a: Asset | null) {
  if (!a) return null;
  if (a.url) return a.url;
  if (a.storage_path) {
    return supabase.storage.from(a.bucket ?? "assets").getPublicUrl(a.storage_path).data.publicUrl;
  }
  return null;
}

function normalizeText(v: string) {
  return v.trim().toLowerCase();
}

function hashString(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffleWithSeed<T>(arr: T[], seed: number) {
  const a = [...arr];
  let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i -= 1) {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    const j = s % (i + 1);
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

function secondsToClock(total: number) {
  const s = Math.max(0, Math.floor(total));
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = Math.floor(s % 60)
    .toString()
    .padStart(2, "0");
  return `${mm}:${ss}`;
}

type QuestionState = {
  seen: boolean;
  marked: boolean;
  selectedOptionIds: string[];
  fillText: string;
};

type SubmitResult = {
  correctQuestions: number;
  totalQuestions: number;
  accuracy: number;
  score: number;
  passed: boolean;
  durationSeconds: number;
};

function buildInitialQState(questions: Question[]) {
  const map = new Map<string, QuestionState>();
  for (const q of questions) {
    map.set(q.id, { seen: false, marked: false, selectedOptionIds: [], fillText: "" });
  }
  return map;
}

import { recordStreakActivity } from "@/lib/streak";

export default function MistakeBankClient() {
  const router = useRouter();
  const [tab, setTab] = useState<"test" | "reference">("test");
  const [started, setStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const questionTopRef = useRef<HTMLDivElement | null>(null);

  const [contentLoading, setContentLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [referenceSheets, setReferenceSheets] = useState<Asset[]>([]);
  const [passagesById, setPassagesById] = useState<Map<string, Passage>>(new Map());

  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const [qState, setQState] = useState<Map<string, QuestionState>>(new Map());

  // Timer states
  const [sessionMinutes, setSessionMinutes] = useState(30);
  const [targetAccuracy, setTargetAccuracy] = useState(80);
  const [showStartConfig, setShowStartConfig] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function loadContent() {
      setContentLoading(true);
      try {
        const { data: sess } = await supabase.auth.getSession();
        if (!sess.session?.user) {
          router.replace("/join");
          return;
        }

        const userId = sess.session.user.id;

        const { data: mistakesData } = await supabase
          .from("mistake_bank")
          .select(`
            id,
            question_id,
            difficulty_score,
            exam_questions (
              id, question_number, type, prompt_text, explanation_text, 
              points, allow_multiple, correct_text, passage_id,
              exam_id,
              exam_question_options (
                id, question_id, option_number, text, bucket, storage_path, url, is_correct
              ),
              exam_question_assets (
                id, bucket, storage_path, url, sort_order, kind, question_id
              ),
              exams (
                title,
                subjects ( title )
              )
            )
          `)
          .eq("user_id", userId)
          .limit(5000)
          .returns<any[]>();

        if (!mistakesData || mistakesData.length === 0) {
          if (mounted) {
            setQuestions([]);
            setContentLoading(false);
          }
          return;
        }

        const examIds = Array.from(new Set(mistakesData.map(m => m.exam_questions?.exam_id).filter(id => !!id)));
        const passageIds = Array.from(new Set(mistakesData.map(m => m.exam_questions?.passage_id).filter(id => !!id)));

        let passages: any[] = [];
        if (passageIds.length > 0) {
          const { data: pRows } = await supabase
            .from("exam_passages")
            .select("id, title, body_html, kind")
            .in("id", passageIds);
          passages = pRows || [];
        }

        let sheets: any[] = [];
        if (examIds.length > 0) {
          const { data: sheetRows } = await supabase
            .from("exam_assets")
            .select("id, url, bucket, storage_path")
            .in("exam_id", examIds)
            .order("sort_order", { ascending: true });
          sheets = sheetRows || [];
        }

        // Deduplicate and clean questions
        const uniqueQs = new Map<string, Question>();
        for (const m of mistakesData) {
          const eq = m.exam_questions;
          if (!eq || !eq.id) continue;
          
          // Only keep one instance of each question
          if (uniqueQs.has(eq.id)) continue;

          const allAssets = (eq.exam_question_assets || []).filter((a: any) => !!a);
          const prompt_assets = allAssets
            .filter((a: any) => (a.kind ?? "prompt") === "prompt")
            .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
          const explanation_assets = allAssets
            .filter((a: any) => a.kind === "explanation")
            .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
          
          const options = (eq.exam_question_options || [])
            .filter((o: any) => !!o && !!o.id) // Strict filtering
            .sort((a: any, b: any) => (a.option_number ?? 0) - (b.option_number ?? 0));

          uniqueQs.set(eq.id, {
            id: eq.id,
            question_number: eq.question_number,
            type: eq.type,
            prompt_text: eq.prompt_text,
            explanation_text: eq.explanation_text,
            points: eq.points,
            allow_multiple: eq.allow_multiple,
            correct_text: eq.correct_text,
            passage_id: eq.passage_id,
            prompt_assets,
            explanation_assets,
            options,
            subjectTitle: eq.exams?.subjects?.title ?? "Subject",
            examTitle: eq.exams?.title ?? "Exam",
            mistakeId: m.id
          });
        }

        const qs = Array.from(uniqueQs.values()).sort(() => Math.random() - 0.5);

        const pMap = new Map<string, Passage>();
        for (const p of passages) {
          pMap.set(p.id, { id: p.id, title: p.title, body_html: p.body_html, kind: p.kind ?? "reading" });
        }

        if (mounted) {
          console.log("[MistakeBank] Syncing Questions:", qs.map(q => ({ id: q.id, options: q.options.length })));
          setQuestions(qs);
          setPassagesById(pMap);
          setReferenceSheets(sheets);
        }
      } catch (err) {
        console.error("[MistakeBank] Load Error:", err);
      } finally {
        if (mounted) setContentLoading(false);
      }
    }

    loadContent();
    return () => { mounted = false; };
  }, [router]);

  // Removed global KaTeX effect to avoid conflicts with MathText's internal lifecycle.
  // We now rely on MathText everywhere.

  // Timer Effect
  useEffect(() => {
    if (!started || !!result || timeLeft <= 0) return;
    const t = setInterval(() => {
      setTimeLeft((v) => {
        if (v <= 1) {
          clearInterval(t);
          onSubmit(true);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [started, result, timeLeft]);

  useEffect(() => {
    setQState(buildInitialQState(questions));
    setCurrentIndex(0);
    setStarted(false);
    setResult(null);
    setError(null);
    setSubmitting(false);
  }, [questions]);

  const currentQuestion = questions[currentIndex] ?? null;

  useEffect(() => {
    if (!started) return;
    if (!currentQuestion) return;
    setQState((prev) => {
      const next = new Map(prev);
      const st = next.get(currentQuestion.id);
      if (!st) return prev;
      if (st.seen) return prev;
      next.set(currentQuestion.id, { ...st, seen: true });
      return next;
    });
  }, [currentQuestion, started]);

  const answeredCount = useMemo(() => {
    let count = 0;
    for (const q of questions) {
      const st = qState.get(q.id);
      if (!st) continue;
      const answered =
        q.type === "fill"
          ? !!st.fillText.trim()
          : st.selectedOptionIds.length > 0;
      if (answered) count += 1;
    }
    return count;
  }, [qState, questions]);

  const progressRatio = useMemo(() => {
    return sessionMinutes ? timeLeft / (sessionMinutes * 60) : 0;
  }, [timeLeft, sessionMinutes]);

  const overview = useMemo(() => {
    return questions.map((q) => {
      const st = qState.get(q.id);
      const seen = !!st?.seen;
      const marked = !!st?.marked;
      const answered =
        q.type === "fill"
          ? !!st?.fillText.trim()
          : (st?.selectedOptionIds?.length ?? 0) > 0;
      return { q, seen, marked, answered };
    });
  }, [qState, questions]);

  const timerWarn = timeLeft < 300;
  const timerUrgent = timeLeft < 60;

  function computeQuestionCorrectness() {
    let correct = 0;
    const correctQuestionIds: string[] = [];

    for (const q of questions) {
      const st = qState.get(q.id);
      if (!st) continue;

      let isCorrect = false;
      const selected = new Set(st.selectedOptionIds);
      const correctFill = (q.correct_text ?? "").trim();
      const fill = st.fillText.trim();
      
      if (q.type === "fill") {
        if (correctFill && normalizeText(fill) === normalizeText(correctFill)) isCorrect = true;
      } else {
        const correctIds = new Set(q.options.filter((o) => o.is_correct).map((o) => o.id));
        if (selected.size > 0) {
          if (q.allow_multiple) {
            if (selected.size === correctIds.size) {
              let ok = true;
              for (const id of selected) if (!correctIds.has(id)) ok = false;
              if (ok) isCorrect = true;
            }
          } else {
            if (selected.size === 1) {
              for (const id of selected) {
                if (correctIds.has(id)) isCorrect = true;
              }
            }
          }
        }
      }

      if (isCorrect) {
        correct += 1;
        correctQuestionIds.push(q.id);
      }
    }
    const total = questions.length;
    const accuracy = total ? Math.round((correct / total) * 100) : 0;
    const score = Math.round(800 * (accuracy / 100));
    return { correct, total, accuracy, score, correctQuestionIds };
  }

  async function onSubmit(isTimeUp = false) {
    if (submitting) return;
    if (result) return;
    if (!started) return;

    setSubmitting(true);
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session?.user) return;
      const userId = sess.session.user.id;

      const correctness = computeQuestionCorrectness();

      if (correctness.correctQuestionIds.length > 0) {
        await supabase
          .from("mistake_bank")
          .delete()
          .eq("user_id", userId)
          .in("question_id", correctness.correctQuestionIds);
      }

      const durationSeconds = (sessionMinutes * 60) - timeLeft;

      setResult({
        correctQuestions: correctness.correct,
        totalQuestions: correctness.total,
        accuracy: correctness.accuracy,
        score: correctness.score,
        passed: correctness.accuracy >= targetAccuracy,
        durationSeconds
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function start() {
    if (contentLoading) return;
    if (!questions.length) return;
    setStarted(true);
    setTab("test");
    setCurrentIndex(0);
    setTimeLeft(sessionMinutes * 60);
    const startedAt = Date.now();
    startedAtRef.current = startedAt;
  }

  const breadcrumbs = useMemo(
    () => [
      { label: "Home", href: "/" },
      { label: "Profile", href: "/profile" },
      { label: "Mistake Bank" },
    ],
    []
  );

  if (contentLoading) {
    return <LoadingAnimation fullScreen variant="portal" />;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* HEADER SECTION */}
      <div className="border-b border-outline/30 bg-gradient-to-r from-slate-50 to-white">
        <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 flex flex-col gap-3 sm:gap-4">
          <div className="flex items-center justify-between gap-4 sm:gap-6">
            <BackButton fallbackHref="/profile" />
            <Breadcrumbs items={breadcrumbs} />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.2em] font-black text-on-surface-variant">
                Mistake Bank Review
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-primary mt-1 sm:mt-2 tracking-tight truncate uppercase">Mistake Bank Session</div>
              
              {!result && (
                <div className="mt-3 sm:mt-4 flex flex-wrap gap-2">
                  <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-blue-50 border border-blue-200 text-[10px] sm:text-xs font-extrabold text-blue-700 rounded-lg">
                    <span className="material-symbols-outlined text-[14px] sm:text-[16px] text-blue-500">quiz</span>
                    {questions.length} questions
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-purple-50 border border-purple-200 text-[10px] sm:text-xs font-extrabold text-purple-700 rounded-lg">
                    <span className="material-symbols-outlined text-[14px] sm:text-[16px] text-purple-500">repeat</span>
                    Unlimited
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-emerald-50 border border-emerald-200 text-[10px] sm:text-xs font-extrabold text-emerald-700 rounded-lg">
                    <span className="material-symbols-outlined text-[14px] sm:text-[16px]">lock_open</span>
                    Free
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-indigo-50 border border-indigo-200 text-[10px] sm:text-xs font-extrabold text-indigo-700 rounded-lg">
                    <span className="material-symbols-outlined text-[14px] sm:text-[16px] text-indigo-500">timer</span>
                    {sessionMinutes} min
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-amber-50 border border-amber-200 text-[10px] sm:text-xs font-extrabold text-amber-700 rounded-lg">
                    <span className="material-symbols-outlined text-[14px] sm:text-[16px] text-amber-500">task_alt</span>
                    Pass {targetAccuracy}%
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {!started ? (
                <button
                  onClick={() => setShowStartConfig(true)}
                  className="bg-secondary text-white px-5 sm:px-6 py-2.5 sm:py-3 font-bold text-sm hover:brightness-110 transition-all rounded-lg active:scale-95 uppercase tracking-widest"
                >
                  Setup Practice
                </button>
              ) : !result ? (
                <button
                  onClick={() => onSubmit()}
                  disabled={submitting}
                  className="bg-secondary text-white px-5 sm:px-6 py-2.5 sm:py-3 font-bold text-sm hover:brightness-110 transition-all rounded-lg disabled:opacity-60 active:scale-95 uppercase tracking-widest"
                >
                  Submit
                </button>
              ) : (
                <button
                  onClick={() => router.push("/profile")}
                  className="bg-slate-100 text-primary px-5 sm:px-6 py-2.5 sm:py-3 font-bold text-sm hover:bg-slate-200 transition-all rounded-lg active:scale-95 uppercase tracking-widest"
                >
                  Close
                </button>
              )}
            </div>
          </div>

          {started && !result && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-6">
              <div className={[
                "flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-3 rounded-xl border-2 transition-colors",
                timerUrgent ? "bg-rose-50 border-rose-300" : timerWarn ? "bg-amber-50 border-amber-300" : "bg-blue-50 border-blue-200",
              ].join(" ")}>
                <span className={[
                  "material-symbols-outlined text-[18px]",
                  timerUrgent ? "text-rose-500" : timerWarn ? "text-amber-500" : "text-blue-500",
                ].join(" ")}>timer</span>
                <div className={[
                  "text-sm font-extrabold",
                  timerUrgent ? "text-rose-700" : timerWarn ? "text-amber-700" : "text-blue-700",
                ].join(" ")}>{secondsToClock(timeLeft)}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="h-2.5 bg-slate-100 border border-outline/30 overflow-hidden rounded-full">
                  <div
                    className="h-full bg-gradient-to-r from-secondary to-primary rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(0, Math.min(100, progressRatio * 100))}%` }}
                  />
                </div>
                <div className="mt-1.5 text-[10px] sm:text-xs text-on-surface-variant font-medium">
                  Answered {answeredCount}/{questions.length}
                </div>
              </div>
              <div className="flex bg-slate-100 p-1.5 rounded-xl border border-outline/30">
                <button
                  type="button"
                  onClick={() => setTab("test")}
                  className={
                    tab === "test"
                      ? "bg-white text-primary px-4 py-1.5 rounded-lg shadow-sm font-extrabold text-xs transition-all"
                      : "text-on-surface-variant hover:text-primary px-4 py-1.5 rounded-lg font-bold text-xs transition-all"
                  }
                >
                  Questions
                </button>
                <button
                  type="button"
                  onClick={() => setTab("reference")}
                  className={
                    tab === "reference"
                      ? "bg-white text-primary px-4 py-1.5 rounded-lg shadow-sm font-extrabold text-xs transition-all"
                      : "text-on-surface-variant hover:text-primary px-4 py-1.5 rounded-lg font-bold text-xs transition-all"
                  }
                >
                  Reference
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ERROR DISPLAY */}
      {error && (
        <div className="px-4 sm:px-8 py-4 bg-rose-50 border-b border-rose-200 text-rose-700 text-sm font-bold flex items-center gap-3">
          <span className="material-symbols-outlined text-rose-500">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="max-w-7xl mx-auto">
        {!started && !result ? (
          <div className="p-8 sm:p-12 md:p-16 flex flex-col items-center max-w-2xl mx-auto">
            <div className="w-24 h-24 bg-primary/5 text-primary rounded-[32px] flex items-center justify-center mb-10 transform rotate-3 shadow-sm border border-primary/5">
              <span className="material-symbols-outlined text-5xl">inventory_2</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-primary font-headline tracking-tighter mb-4 text-center">Practice your Mistakes</h1>
            <p className="text-on-surface-variant font-medium text-lg leading-relaxed mb-10 text-center">
              Go through the {questions.length} questions you answered incorrectly. Correct answers will be permanently removed from the bank.
            </p>
            
            <div className="w-full bg-slate-50 border-2 border-outline/30 rounded-3xl p-6 sm:p-8 mb-10">
              <div className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.3em] mb-4 text-center">Customize Session</div>
              <div className="space-y-8">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-black text-primary uppercase tracking-widest">Practice Duration</label>
                    <div className="text-lg font-black text-secondary">{sessionMinutes} min</div>
                  </div>
                  <input 
                    type="range" 
                    min="5" 
                    max="120" 
                    step="5"
                    value={sessionMinutes}
                    onChange={(e) => setSessionMinutes(parseInt(e.target.value))}
                    className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-secondary"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-black text-primary uppercase tracking-widest">Target Accuracy (Pass %)</label>
                    <div className="text-lg font-black text-amber-600">{targetAccuracy}%</div>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="100" 
                    step="5"
                    value={targetAccuracy}
                    onChange={(e) => setTargetAccuracy(parseInt(e.target.value))}
                    className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={start}
              className="bg-primary text-white w-full py-5 text-lg font-extrabold shadow-soft-xl hover:shadow-soft-2xl transition-all rounded-2xl active:scale-[0.98] uppercase tracking-[0.2em]"
            >
              Begin Session
            </button>
          </div>
        ) : result ? (
          /* RESULT VIEW */
          <div className="p-4 sm:p-6 md:p-10">
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-12">
                   <div className="text-secondary font-black text-[12px] uppercase tracking-[0.4em] mb-4">Practice Over</div>
                   <h2 className="font-headline text-5xl sm:text-7xl font-extrabold text-primary tracking-tighter mb-4">Results</h2>
                   <div className="text-on-surface-variant text-lg sm:text-xl font-medium max-w-2xl leading-relaxed">
                     You successfully cleared {result.correctQuestions} out of {result.totalQuestions} questions. Accuracy: {result.accuracy}%.
                   </div>
                </div>

                <div className="lg:col-span-7">
                  <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-3xl p-6 shadow-sm">
                      <div className="text-[10px] uppercase tracking-[0.3em] text-blue-600 font-black mb-1">Accuracy</div>
                      <div className="text-4xl font-black text-blue-700">{result.accuracy}%</div>
                    </div>
                    <div className="bg-indigo-50 border-2 border-indigo-200 rounded-3xl p-6 shadow-sm">
                      <div className="text-[10px] uppercase tracking-[0.3em] text-indigo-600 font-black mb-1">Duration</div>
                      <div className="text-4xl font-black text-indigo-700">{secondsToClock(result.durationSeconds)}</div>
                    </div>
                  </div>

                </div>

                <div className="lg:col-span-5">
                   <div className="bg-gradient-to-br from-slate-50 to-blue-50 border-2 border-outline/30 shadow-soft-xl rounded-[48px] p-8">
                     <div className="text-xs font-black text-primary uppercase tracking-widest mb-10 text-center">Accuracy Analysis</div>
                     <div className="flex flex-col items-center gap-8">
                        <div className="relative w-48 h-48 sm:w-56 sm:h-56">
                           <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(#3e5e95 ${result.accuracy}%, #e2e8f0 0)` }} />
                           <div className="absolute inset-2 rounded-full bg-white shadow-inner" />
                           <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                               <div className="text-4xl font-black text-primary tracking-tighter">{result.accuracy}%</div>
                               <div className="text-[10px] text-on-surface-variant font-black uppercase tracking-[0.3em] mt-1">Accuracy</div>
                           </div>
                        </div>
                     </div>
                   </div>
                </div>
             </div>

             {/* Review Matrix - Full Width */}
             <div className="mt-8 sm:mt-12 w-full bg-slate-50 border-2 border-outline/10 rounded-[40px] p-6 sm:p-10 mb-12 shadow-sm">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8">
                  <div className="text-sm font-black text-primary uppercase tracking-[0.2em]">Review Matrix</div>
                  <div className="flex flex-wrap items-center justify-center gap-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">
                    <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-emerald-400 bg-emerald-50 rounded-md" /> Correct</div>
                    <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-rose-400 bg-rose-50 rounded-md" /> Incorrect</div>
                    <div className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-outline/40 bg-slate-100 rounded-md" /> Skipped</div>
                  </div>
                </div>
                <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-15 lg:grid-cols-20 xl:grid-cols-25 gap-2.5">
                   {questions.map((q, idx) => {
                      const st = qState.get(q.id);
                      const selected = new Set(st?.selectedOptionIds ?? []);
                      const fill = (st?.fillText ?? "").trim();
                      const correctFill = (q.correct_text ?? "").trim();
                      const correctOptionIds = new Set(q.options.filter((o) => o.is_correct).map((o) => o.id));
                      const hasAnswer = q.type === "fill" ? !!fill : selected.size > 0;
                      const isCorrect = q.type === "fill" 
                        ? normalizeText(fill) === normalizeText(correctFill) && !!correctFill
                        : (() => {
                            if (selected.size === 0) return false;
                            if (q.allow_multiple) {
                              if (selected.size !== correctOptionIds.size) return false;
                              for (const id of selected) if (!correctOptionIds.has(id)) return false;
                              return true;
                            }
                            return selected.size === 1 && correctOptionIds.has(Array.from(selected)[0]);
                          })();
                      const border = !hasAnswer ? "border-outline/40" : isCorrect ? "border-emerald-400" : "border-rose-400";
                      const bg = !hasAnswer ? "bg-slate-100" : isCorrect ? "bg-emerald-50" : "bg-rose-50";
                      return (
                        <button 
                          key={q.id} 
                          type="button"
                          onClick={() => {
                            setCurrentReviewIndex(idx);
                            const el = document.getElementById('detailed-analysis-top');
                            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                          }}
                          className={`h-8 sm:h-10 border-2 ${border} ${bg} font-bold text-xs sm:text-sm text-primary flex items-center justify-center rounded-lg transition-all active:scale-95`}
                        >
                          {idx + 1}
                        </button>
                      );
                   })}
                </div>
             </div>

             {/* Detailed Analysis */}
             <div id="detailed-analysis-top" className="mt-20 space-y-12">
               <div className="text-secondary font-black text-[12px] uppercase tracking-[0.5em] mb-10">Detailed Analysis</div>
               {(() => {
                  const idx = currentReviewIndex;
                  const q = questions[idx];
                  if (!q) return null;

                  const st = qState.get(q.id);
                  const selected = new Set(st?.selectedOptionIds ?? []);
                  const fill = (st?.fillText ?? "").trim();
                  const correctFill = (q.correct_text ?? "").trim();
                  const correctOptionIds = new Set(q.options.filter((o) => o.is_correct).map((o) => o.id));
                  const hasAnswer = q.type === "fill" ? !!fill : selected.size > 0;
                  const isCorrect = q.type === "fill" 
                    ? normalizeText(fill) === normalizeText(correctFill) && !!correctFill
                    : (() => {
                        if (selected.size === 0) return false;
                        if (q.allow_multiple) {
                          if (selected.size !== correctOptionIds.size) return false;
                          for (const id of selected) if (!correctOptionIds.has(id)) return false;
                          return true;
                        }
                        return selected.size === 1 && correctOptionIds.has(Array.from(selected)[0]);
                      })();

                  const passage = q.passage_id ? passagesById.get(q.passage_id) : null;
                  const isReference = passage?.kind === "reference";

                  const questionCard = (
                    <div id={`analysis-q-${idx}`} className="bg-white border-2 border-outline/30 shadow-soft-md rounded-[40px] overflow-hidden scroll-mt-32">
                      <div className="p-6 border-b border-outline/30 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-primary/10 text-primary font-black rounded-xl flex items-center justify-center">{idx + 1}</div>
                          <div className="text-sm font-black text-primary uppercase tracking-widest">{q.subjectTitle}</div>
                        </div>
                        <span className={`px-4 py-1.5 text-[10px] font-black tracking-[0.2em] uppercase rounded-xl border-2 ${!hasAnswer ? "bg-slate-100 border-outline/40 text-on-surface-variant" : isCorrect ? "bg-emerald-50 border-emerald-400 text-emerald-700" : "bg-rose-50 border-rose-400 text-rose-700"}`}>
                           {!hasAnswer ? "Skipped" : isCorrect ? "Correct" : "Incorrect"}
                        </span>
                      </div>
                      <div className="p-6 sm:p-10 space-y-8">
                         {q.prompt_text && <div className="text-on-surface font-medium leading-loose text-lg prose max-w-none"><MathText text={q.prompt_text} /></div>}
                         {q.prompt_assets.map(a => <div key={a.id} className="border-2 border-outline/30 bg-slate-50 overflow-hidden rounded-3xl max-w-2xl"><img src={assetUrl(a)!} className="w-full h-auto" /></div>)}
                         
                         {q.type === "fill" ? (
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="border-2 border-outline/30 bg-slate-50 p-6 rounded-2xl"><div className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-2">You</div><div className="text-lg font-black text-primary">{fill || "—"}</div></div>
                              <div className="border-2 border-emerald-300 bg-emerald-50 p-6 rounded-2xl"><div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Correct</div><div className="text-lg font-black text-emerald-700">{correctFill || "—"}</div></div>
                           </div>
                         ) : (
                           <div className="space-y-3">
                             {q.options.map(o => {
                                const isSelected = selected.has(o.id);
                                const isCorrectOpt = o.is_correct;
                                const border = isCorrectOpt ? "border-emerald-500 shadow-md shadow-emerald-100" : isSelected ? "border-rose-400" : "border-outline/20";
                                const bg = isCorrectOpt ? "bg-emerald-50/50" : isSelected ? "bg-rose-50/50" : "bg-white";
                                return (
                                  <div key={o.id} className={`w-full p-5 rounded-2xl border-2 flex items-start gap-5 ${border} ${bg} transition-all`}>
                                     <div className="flex-1 min-w-0 pt-1 text-base font-bold text-on-surface prose max-w-none"><MathText text={o.text || ""} /></div>
                                     {isCorrectOpt && <span className="material-symbols-outlined text-emerald-600">check_circle</span>}
                                     {isSelected && !isCorrectOpt && <span className="material-symbols-outlined text-rose-600">cancel</span>}
                                  </div>
                                );
                             })}
                           </div>
                         )}

                         {q.explanation_text && (
                           <div className="mt-8 p-6 sm:p-10 bg-blue-50/30 border-2 border-blue-100 rounded-[32px]">
                              <div className="text-[10px] font-black text-blue-800 uppercase tracking-[0.4em] mb-4 flex items-center gap-2 font-headline"><span className="material-symbols-outlined text-xl">lightbulb</span>Evaluation</div>
                              <div className="text-base leading-relaxed text-blue-900 font-medium prose max-w-none"><MathText text={q.explanation_text} /></div>
                              {q.explanation_assets.map(a => <img key={a.id} src={assetUrl(a)!} className="mt-6 rounded-2xl max-h-80" />)}
                           </div>
                         )}

                         {/* Analysis Navigation Buttons */}
                         <div className="mt-12 flex items-center justify-between gap-6 pt-8 border-t border-outline/20">
                            <button 
                              onClick={() => { setCurrentReviewIndex(v => Math.max(0,v-1)); document.getElementById('detailed-analysis-top')?.scrollIntoView({behavior:'smooth'}); }} 
                              disabled={currentReviewIndex === 0}
                              className="bg-white text-primary border-2 border-outline/40 px-5 sm:px-8 py-2.5 sm:py-3 font-bold uppercase tracking-wider text-xs sm:text-sm rounded-xl disabled:opacity-20 transition-all hover:bg-slate-50 active:scale-95"
                            >
                              Previous Analysis
                            </button>
                            <button 
                              onClick={() => { setCurrentReviewIndex(v => Math.min(questions.length-1, v+1)); document.getElementById('detailed-analysis-top')?.scrollIntoView({behavior:'smooth'}); }}
                              disabled={currentReviewIndex === questions.length - 1}
                              className="bg-primary text-white border-2 border-primary px-6 sm:px-10 py-2.5 sm:py-3 font-bold uppercase tracking-wider text-xs sm:text-sm rounded-xl transition-all hover:bg-slate-800 active:scale-95 shadow-md flex items-center gap-2"
                            >
                              Next Analysis
                              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                            </button>
                         </div>

                         {/* Retake Session Button */}
                         <div className="mt-20 pt-10 border-t border-outline/30 flex justify-center pb-20">
                            <button
                              onClick={() => {
                                setResult(null);
                                setStarted(false);
                                setShowStartConfig(true);
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                              className="bg-secondary text-white px-10 py-4 font-black uppercase tracking-[0.2em] text-sm rounded-2xl hover:bg-primary transition-all active:scale-[0.98] shadow-lg shadow-secondary/20 flex items-center gap-3"
                            >
                              <span className="material-symbols-outlined">restart_alt</span>
                              Retake Mistake Session
                            </button>
                         </div>
                      </div>
                    </div>
                  );

                  if (!passage) return <div key={q.id}>{questionCard}</div>;
                  const passagePanel = (
                    <div className={`border-2 ${isReference ? 'border-sky-200 bg-gradient-to-br from-sky-50 to-white' : 'border-violet-200 bg-gradient-to-br from-violet-50 to-white'} rounded-[32px] overflow-hidden flex flex-col shadow-sm`}>
                       <div className={`px-4 py-3 ${isReference ? 'bg-sky-100/60 border-b border-sky-200' : 'bg-violet-100/60 border-b border-violet-200'} flex items-center gap-2`}>
                         <span className={`material-symbols-outlined ${isReference ? 'text-sky-600' : 'text-violet-600'} text-lg`}>{isReference ? 'view_cozy' : 'menu_book'}</span>
                         <div className={`text-xs font-black uppercase tracking-[0.15em] ${isReference ? 'text-sky-700' : 'text-violet-700'}`}>{isReference ? 'Reference Block' : 'Passage'}</div>
                       </div>
                       <div className={`p-6 prose prose-sm max-w-none text-on-surface leading-loose break-words ${isReference ? '' : 'overflow-y-auto max-h-[50vh]'}`} dangerouslySetInnerHTML={{ __html: passage.body_html }} />
                    </div>
                  );

                  return (
                    <div key={q.id}>
                       <div className="lg:hidden space-y-6">{passagePanel}{questionCard}</div>
                       <div className="hidden lg:grid lg:grid-cols-2 gap-8">{passagePanel}{questionCard}</div>
                    </div>
                  );
               })()}
             </div>
          </div>
        ) : (
          /* ACTIVE PRACTICE VIEW */
          <div>
            {/* Overview grid */}
            <div className="px-4 sm:px-6 md:px-8 py-5 border-b border-outline/30 bg-slate-50/50">
               <div className="flex flex-col sm:flex-row items-baseline justify-between gap-4 mb-4">
                  <div className="text-xs font-black text-primary uppercase tracking-widest">Questions Overview</div>
                  <div className="flex flex-wrap gap-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">
                     <div className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 border-2 border-outline/40 bg-slate-100 rounded-md" /> Unseen</div>
                     <div className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 border-2 border-emerald-400 bg-emerald-50 rounded-md" /> Answered</div>
                     <div className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 border-2 border-amber-400 bg-amber-50 rounded-md" /> Marked</div>
                  </div>
               </div>
               <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 lg:grid-cols-16 xl:grid-cols-20 gap-2">
                 {overview.map(({ q, seen, answered, marked }, idx) => {
                    const isCurrent = idx === currentIndex;
                    const border = marked ? "border-amber-400" : answered ? "border-emerald-400" : "border-outline/40";
                    const bg = marked ? "bg-amber-50" : answered ? "bg-emerald-50" : "bg-slate-100";
                    const ring = isCurrent ? "ring-2 ring-primary/30" : "";
                    return (
                      <button 
                        key={q.id} 
                        type="button" 
                        onClick={() => { 
                          setCurrentIndex(idx); 
                          setTimeout(() => questionTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 10);
                        }} 
                        className={`h-8 sm:h-10 border-2 ${border} ${bg} ${ring} font-bold text-xs sm:text-sm text-primary rounded-lg transition-all`}
                      >
                         {idx + 1}
                       </button>
                    );
                 })}
               </div>
            </div>

            {/* Test Content */}
            <div className="p-4 sm:p-6 md:p-10">
               {tab === "reference" ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   {referenceSheets.map(a => <div key={a.id} className="border-2 border-outline/30 bg-slate-50 overflow-hidden rounded-[32px] shadow-sm"><img src={assetUrl(a)!} className="w-full h-auto" /></div>)}
                 </div>
               ) : (
                 currentQuestion && (
                   <>
                     <div ref={questionTopRef} className="flex items-start justify-between gap-6 mb-8">
                        <div className="text-secondary font-black text-[11px] uppercase tracking-[0.4em]">Question {currentIndex + 1} of {questions.length}</div>
                        <button 
                          type="button" 
                          onClick={() => setQState(p => { const n=new Map(p); const s=n.get(currentQuestion.id); if(s) n.set(currentQuestion.id, {...s, marked:!s.marked}); return n; })}
                          className={`px-5 py-2.5 font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all border-2 flex items-center gap-2 active:scale-95 ${qState.get(currentQuestion.id)?.marked ? "bg-amber-100 border-amber-300 text-amber-800" : "bg-white border-outline/40 text-on-surface-variant"}`}
                        >
                           <span className="material-symbols-outlined text-[18px]">flag</span>
                           Mark for review
                        </button>
                     </div>

                     {(() => {
                        const passage = currentQuestion.passage_id ? passagesById.get(currentQuestion.passage_id) : null;
                        const isReference = passage?.kind === "reference";

                        const questionBody = (
                          <div className="space-y-4 sm:space-y-6 bg-gradient-to-br from-white to-slate-50 border-2 border-outline/30 shadow-sm rounded-2xl p-4 sm:p-6 md:p-8">
                             {passage && !isReference && <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-violet-50 border border-violet-200 text-[10px] sm:text-xs font-extrabold text-violet-700 rounded-lg">
                               <span className="material-symbols-outlined text-[14px] sm:text-[16px] text-violet-500">menu_book</span>
                               Related to passage
                             </div>}
                             {currentQuestion.prompt_text && <div className="text-base sm:text-lg text-on-surface leading-relaxed font-medium"><MathText text={currentQuestion.prompt_text} /></div>}
                             {currentQuestion.prompt_assets.map(a => <div key={a.id} className="border-2 border-outline/30 bg-slate-50 overflow-hidden rounded-xl max-w-full"><img src={assetUrl(a)!} className="w-full h-auto" /></div>)}
                             
                             {currentQuestion.type === "fill" ? (
                               <div className="max-w-xl">
                                  <div className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.3em] mb-4">Input Solution</div>
                                  <input 
                                    className="h-14 w-full px-6 border-2 border-outline/40 rounded-2xl outline-none focus:border-primary transition-all font-bold text-xl"
                                    value={qState.get(currentQuestion.id)?.fillText ?? ""}
                                    onChange={e => setQState(p => { const n=new Map(p); const s=n.get(currentQuestion.id); if(s) n.set(currentQuestion.id, {...s, fillText: e.target.value}); return n; })}
                                    placeholder="Enter numerical answer..."
                                  />
                               </div>
                             ) : (
                               <div className="grid grid-cols-1 gap-4">
                                 {(() => {
                                   const displayOptions = currentQuestion.options;
                                   if (displayOptions.length === 0) {
                                      console.warn(`[MistakeBank] Warning: Question ${currentQuestion.id} has NO options!`);
                                   }
                                   
                                   return displayOptions.map((opt, oIdx) => {
                                     if (!opt) {
                                       console.error(`[MistakeBank] Error: Option at index ${oIdx} is null/undefined for question ${currentQuestion.id}`);
                                       return null;
                                     }
                                     const sel = qState.get(currentQuestion.id)?.selectedOptionIds.includes(opt.id);
                                     return (
                                       <button 
                                         key={opt.id} type="button" 
                                        onClick={() => setQState(p => {
                                          const n=new Map(p); const s=n.get(currentQuestion.id); if(!s) return p;
                                          let sl = currentQuestion.allow_multiple ? (s.selectedOptionIds.includes(opt.id) ? s.selectedOptionIds.filter(i=>i!==opt.id) : [...s.selectedOptionIds, opt.id]) : [opt.id];
                                          n.set(currentQuestion.id, {...s, selectedOptionIds: sl}); return n;
                                        })}
                                        className={`w-full text-left border-2 px-4 sm:px-6 py-3 sm:py-4 transition-all rounded-xl active:scale-[0.97] ${sel ? "border-primary bg-primary/5 text-primary" : "border-outline/30 bg-white text-on-surface hover:bg-primary/5 hover:border-primary/30"}`}
                                      >
                                         <div className="flex items-start gap-5">
                                            <div className="flex-1 min-w-0 pt-1 text-sm sm:text-base font-bold prose max-w-none"><MathText text={opt.text || ""} /></div>
                                         </div>
                                         {opt.url && <img src={opt.url} className="mt-4 mx-auto max-h-56 rounded-2xl" />}
                                      </button>
                                    );
                                   });
                                 })()}
                               </div>
                             )}
                          </div>
                        );

                        if (!passage) return <div className="mt-8">{questionBody}</div>;
                        const passagePanel = (
                          <div className={`border-2 ${isReference ? 'border-sky-200 bg-gradient-to-br from-sky-50 to-white' : 'border-violet-200 bg-gradient-to-br from-violet-50 to-white'} rounded-[40px] overflow-hidden flex flex-col shadow-sm`}>
                             <div className={`px-6 py-4 ${isReference ? 'bg-sky-100/60 border-b border-sky-200' : 'bg-violet-100/60 border-b border-violet-200'} flex items-center gap-3`}>
                               <span className={`material-symbols-outlined ${isReference ? 'text-sky-600' : 'text-violet-600'} text-2xl`}>{isReference ? 'view_cozy' : 'menu_book'}</span>
                               <div className={`text-xs font-black uppercase tracking-[0.2em] ${isReference ? 'text-sky-700' : 'text-violet-700'}`}>{isReference ? 'Reference' : 'Passage'}</div>
                             </div>
                             <div className={`p-8 prose prose-slate max-w-none text-on-surface leading-loose break-words ${isReference ? '' : 'overflow-y-auto lg:max-h-[60vh] max-h-[40vh]'}`}>
                               <MathText text={passage.body_html} />
                             </div>
                          </div>
                        );

                        return (
                          <div className="mt-8">
                             <div className="lg:hidden space-y-8">{passagePanel}{questionBody}</div>
                             <div className="hidden lg:grid lg:grid-cols-2 gap-10">{passagePanel}{questionBody}</div>
                          </div>
                        );
                     })()}

                     {/* SEQUENTIAL BUTTONS */}
                     <div className="mt-12 flex items-center justify-between gap-6 pb-20">
                        <button 
                          onClick={() => { 
                            setCurrentIndex(v => Math.max(0,v-1)); 
                            setTimeout(() => questionTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 10);
                          }} 
                          disabled={currentIndex === 0}
                          className="bg-white text-primary border-2 border-outline/40 px-8 py-4 font-black uppercase tracking-widest text-xs rounded-2xl disabled:opacity-20 transition-all hover:bg-slate-50 active:scale-95"
                        >
                          Previous
                        </button>
                        <button 
                          onClick={() => { 
                            recordStreakActivity(); // Record streak activity
                            if(currentIndex === questions.length-1) onSubmit(); 
                            else { 
                              setCurrentIndex(v => Math.min(questions.length-1, v+1)); 
                              setTimeout(() => questionTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 10);
                            } 
                          }}
                          disabled={submitting}
                          className="bg-primary text-white border-2 border-primary px-10 py-4 font-black uppercase tracking-widest text-xs rounded-2xl transition-all hover:bg-slate-800 active:scale-95 shadow-lg shadow-primary/10"
                        >
                          {currentIndex === questions.length - 1 ? "Submit Portal" : "Next Question"}
                        </button>
                     </div>
                   </>
                 )
               )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
