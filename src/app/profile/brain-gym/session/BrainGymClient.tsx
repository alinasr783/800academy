"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import BackButton from "@/components/BackButton";
import Breadcrumbs from "@/components/Breadcrumbs";
import MathText from "@/components/MathText";
import LoadingAnimation from "@/components/LoadingAnimation";

// --- Types ---
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
  subtopic_id: string | null;
  topic_id: string | null;
  passage?: Passage | null;
  subjectTitle?: string;
};

type QuestionState = {
  seen: boolean;
  marked: boolean;
  selectedOptionIds: string[];
  fillText: string;
};

type SubmitResult = {
  sessionId: string;
  correct: number;
  total: number;
  percent: number;
  passed: boolean;
  target: number;
  durationSeconds: number;
  topicResults: { 
    topicId: string; 
    title: string; 
    correct: number; 
    total: number; 
    percent: number;
    subtopicResults: { subtopicId: string; title: string; correct: number; total: number; percent: number }[]
  }[];
};

// --- Helpers ---
function secondsToClock(total: number) {
  const s = Math.max(0, Math.floor(total));
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = Math.floor(s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function normalizeText(t: string) {
  return t.trim().toLowerCase();
}

function assetUrl(a: Asset) {
  if (a.url) return a.url;
  if (!a.bucket || !a.storage_path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${a.bucket}/${a.storage_path}`;
}

import { recordStreakActivity } from "@/lib/streak";

export default function BrainGymClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const topicIds = useMemo(() => searchParams.get("topic_ids")?.split(",") ?? [], [searchParams]);
  const subtopicIds = useMemo(() => searchParams.get("subtopic_ids")?.split(",") ?? [], [searchParams]);
  const limit = useMemo(() => Number(searchParams.get("limit") || 20), [searchParams]);
  const timeMin = useMemo(() => Number(searchParams.get("time") || 15), [searchParams]);
  const targetAcc = useMemo(() => Number(searchParams.get("target") || 80), [searchParams]);

  const [contentLoading, setContentLoading] = useState(true);
  const [topicsById, setTopicsById] = useState<Map<string, string>>(new Map());
  const [subtopicsById, setSubtopicsById] = useState<Map<string, { title: string; topicId: string }>>(new Map());
  const [questions, setQuestions] = useState<Question[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [qState, setQStat] = useState<Map<string, QuestionState>>(new Map());
  const [timeLeft, setTimeLeft] = useState(timeMin * 60);
  const [started, setStarted] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<"test" | "reference">("test");

  const questionTopRef = useRef<HTMLDivElement>(null);

  const sessionIdParam = searchParams.get("session_id");

  useEffect(() => {
    if (sessionIdParam) {
      loadPastSession(sessionIdParam);
      return;
    }
    if (topicIds.length === 0) {
      router.push("/profile");
      return;
    }
    load();
  }, [topicIds, limit, router, sessionIdParam]);

  async function loadPastSession(sid: string) {
    setContentLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/join?mode=login");
        return;
      }
      setUser(user);

      const { data: session, error: sErr } = await supabase
        .from("practice_sessions")
        .select("*")
        .eq("id", sid)
        .single();
      
      if (sErr || !session) throw new Error("Session not found");

      // Load specific questions
      const { data: qData, error: qErr } = await supabase
        .from("exam_questions")
        .select(`
          *,
          prompt_assets:exam_question_assets(*),
          explanation_assets:exam_question_assets(*),
          options:exam_question_options(*),
          passage:exam_passages(*)
        `)
        .in("id", session.question_ids);

      if (qErr) throw qErr;

      // Filter assets by kind
      const formattedQuestions: Question[] = (qData || []).map((q: any) => ({
        ...q,
        prompt_assets: q.prompt_assets.filter((a: any) => a.kind === 'prompt'),
        explanation_assets: q.explanation_assets.filter((a: any) => a.kind === 'explanation'),
        options: q.options.sort((a: any, b: any) => a.option_number - b.option_number)
      }));

      // Sort questions based on the original session.question_ids order
      const sortedQuestions = session.question_ids.map((id: string) => (formattedQuestions as Question[]).find((q: Question) => q.id === id)).filter((q: Question | undefined): q is Question => !!q);

      setQuestions(sortedQuestions);

      // Reconstruct qState from saved answers
      const savedAnswers = session.answers || {};
      const newQState = new Map<string, QuestionState>();
      sortedQuestions.forEach((q: Question) => {
        const ans = savedAnswers[q.id] || { selectedOptionIds: [], fillText: "" };
        newQState.set(q.id, { seen: true, marked: false, ...ans });
      });
      setQStat(newQState);

      // Fetch titles for topics and subtopics
      const [{ data: topicData }, { data: stData }] = await Promise.all([
        supabase.from('topics').select('id, title'),
        supabase.from('subtopics').select('id, title, topic_id')
      ]);

      const tMap = new Map<string, string>();
      topicData?.forEach(t => tMap.set(t.id, t.title));
      setTopicsById(tMap);

      const stMap = new Map<string, { title: string; topicId: string }>();
      stData?.forEach(st => stMap.set(st.id, { title: st.title, topicId: st.topic_id }));
      setSubtopicsById(stMap);

      // Set results
      const subtopicStats = new Map<string, { correct: number; total: number }>();

      sortedQuestions.forEach((q: Question) => {
        const sid = q.subtopic_id || "none";
        const stats = subtopicStats.get(sid) || { correct: 0, total: 0 };
        stats.total += 1;
        
        const ans = savedAnswers[q.id];
        let isC = false;
        if (q.type === 'mcq') {
          const cIds = q.options.filter((o: Option) => o.is_correct).map((o: Option) => o.id);
          const sel = ans?.selectedOptionIds || [];
          isC = cIds.length === sel.length && cIds.every((id: string) => sel.includes(id));
        } else {
          isC = normalizeText(ans?.fillText || "") === normalizeText(q.correct_text || "");
        }
        if (isC) stats.correct++;
        subtopicStats.set(sid, stats);
      });

      // Group subtopics into topics
      const topicsGroupMap = new Map<string, { correct: number; total: number; subtopics: any[] }>();
      subtopicStats.forEach((stats, sid) => {
        const info = stMap.get(sid);
        const tid = info?.topicId || "none";
        const tStats = topicsGroupMap.get(tid) || { correct: 0, total: 0, subtopics: [] };
        tStats.correct += stats.correct;
        tStats.total += stats.total;
        tStats.subtopics.push({
          subtopicId: sid,
          title: info?.title || 'General',
          correct: stats.correct,
          total: stats.total,
          percent: Math.round((stats.correct / stats.total) * 100)
        });
        topicsGroupMap.set(tid, tStats);
      });

      const topicResults = Array.from(topicsGroupMap.entries()).map(([tid, s]) => ({
        topicId: tid,
        title: tMap.get(tid) || (tid === 'none' ? 'General' : 'Other'),
        correct: s.correct,
        total: s.total,
        percent: Math.round((s.correct / s.total) * 100),
        subtopicResults: s.subtopics.sort((a, b) => a.title.localeCompare(b.title))
      })).sort((a, b) => a.title.localeCompare(b.title));

      setResult({
        sessionId: sid,
        correct: session.correct_questions,
        total: session.total_questions,
        percent: session.percent_correct,
        passed: session.percent_correct >= session.target_accuracy,
        target: session.target_accuracy,
        durationSeconds: session.duration_seconds,
        topicResults
      });
      setStarted(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setContentLoading(false);
    }
  }

  async function load() {
    setContentLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/join?mode=login");
        return;
      }
      setUser(user);

      // Fetch titles
      const { data: topicData } = await supabase.from('topics').select('id, title');
      const tMap = new Map<string, string>();
      topicData?.forEach(t => tMap.set(t.id, t.title));
      setTopicsById(tMap);

      const { data: stData } = await supabase.from('subtopics').select('id, title, topic_id');
      const stMap = new Map<string, { title: string; topicId: string }>();
      stData?.forEach(st => stMap.set(st.id, { title: st.title, topicId: st.topic_id }));
      setSubtopicsById(stMap);

      const params = new URLSearchParams({
        topic_ids: topicIds.join(","),
        subtopic_ids: subtopicIds.join(","),
        limit: limit.toString()
      });
      const res = await fetch(`/api/practice/questions?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load questions");
      
      const qs = (json.items || []).map((q: any, idx: number) => ({ ...q, question_number: idx + 1 }));
      if (qs.length === 0) throw new Error("No questions found for the selected topics. Try selecting different topics.");
      
      setQuestions(qs);
      const states = new Map<string, QuestionState>();
      qs.forEach((q: Question) => {
        states.set(q.id, { seen: false, marked: false, selectedOptionIds: [], fillText: "" });
      });
      setQStat(states);
      
      if (qs.length > 0) {
        states.get(qs[0].id)!.seen = true;
        setQStat(new Map(states));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setContentLoading(false);
    }
  }

  // Timer logic - Match Mistake Bank
  useEffect(() => {
    if (!started || !!result || timeLeft <= 0) return;
    const t = setInterval(() => {
      setTimeLeft((v) => {
        if (v <= 1) {
          clearInterval(t);
          onSubmit();
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [started, result, timeLeft]);

  const currentQuestion = questions[currentIndex] ?? null;

  useEffect(() => {
    if (!started || !currentQuestion) return;
    setQStat((prev) => {
      const next = new Map(prev);
      const st = next.get(currentQuestion.id);
      if (!st || st.seen) return prev;
      next.set(currentQuestion.id, { ...st, seen: true });
      return next;
    });
  }, [currentQuestion, started]);

  const answeredCount = useMemo(() => {
    let count = 0;
    for (const q of questions) {
      const st = qState.get(q.id);
      if (!st) continue;
      if (q.type === "fill" ? !!st.fillText.trim() : st.selectedOptionIds.length > 0) count++;
    }
    return count;
  }, [qState, questions]);

  const progressRatio = useMemo(() => {
    return timeMin ? timeLeft / (timeMin * 60) : 0;
  }, [timeLeft, timeMin]);

  const overview = useMemo(() => {
    return questions.map((q) => {
      const st = qState.get(q.id);
      return { q, seen: !!st?.seen, marked: !!st?.marked, answered: q.type === "fill" ? !!st?.fillText.trim() : (st?.selectedOptionIds?.length ?? 0) > 0 };
    });
  }, [qState, questions]);

  async function onSubmit() {
    if (submitting || result) return;
    setSubmitting(true);
    try {
      let correct = 0;
      const subtopicStats = new Map<string, { correct: number; total: number }>();

      questions.forEach((q) => {
        const st = qState.get(q.id);
        const sid = q.subtopic_id || "none";
        const cur = subtopicStats.get(sid) ?? { correct: 0, total: 0 };
        cur.total += 1;

        let isCorrect = false;
        if (st) {
          if (q.type === "mcq") {
            const correctIds = q.options.filter(o => o.is_correct).map(o => o.id);
            const sel = new Set(st.selectedOptionIds);
            isCorrect = correctIds.length === sel.size && correctIds.every(id => sel.has(id));
          } else {
            isCorrect = normalizeText(st.fillText) === normalizeText(q.correct_text || "") && (q.correct_text || "").trim() !== "";
          }
        }
        if (isCorrect) {
           correct += 1;
           cur.correct += 1;
        }
        subtopicStats.set(sid, cur);
      });

      // Group subtopics into topics
      const topicsGroupMap = new Map<string, { correct: number; total: number; subtopics: any[] }>();
      subtopicStats.forEach((stats, sid) => {
        const info = subtopicsById.get(sid);
        const tid = info?.topicId || "none";
        const tStats = topicsGroupMap.get(tid) || { correct: 0, total: 0, subtopics: [] };
        tStats.correct += stats.correct;
        tStats.total += stats.total;
        tStats.subtopics.push({
          subtopicId: sid,
          title: info?.title || 'General',
          correct: stats.correct,
          total: stats.total,
          percent: Math.round((stats.correct / stats.total) * 100)
        });
        topicsGroupMap.set(tid, tStats);
      });

      const topicResults = Array.from(topicsGroupMap.entries()).map(([tid, s]) => ({
        topicId: tid,
        title: topicsById.get(tid) || (tid === 'none' ? 'General' : 'Other'),
        correct: s.correct,
        total: s.total,
        percent: Math.round((s.correct / s.total) * 100),
        subtopicResults: s.subtopics.sort((a, b) => a.title.localeCompare(b.title))
      })).sort((a, b) => a.title.localeCompare(b.title));

      const duration = Math.floor((timeMin * 60) - timeLeft);
      const percent = Math.round((correct / questions.length) * 100);

      const answers: Record<string, { selectedOptionIds: string[], fillText: string }> = {};
      questions.forEach(q => {
        const st = qState.get(q.id);
        answers[q.id] = { selectedOptionIds: st?.selectedOptionIds || [], fillText: st?.fillText || "" };
      });

      await fetch("/api/practice/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id, 
          topic_ids: topicIds, 
          subtopic_ids: subtopicIds,
          total_questions: questions.length, 
          correct_questions: correct,
          duration_seconds: duration, 
          target_accuracy: targetAcc, 
          percent_correct: percent,
          question_ids: questions.map(q => q.id),
          answers
        })
      });

      setResult({ sessionId: 'gym', correct, total: questions.length, percent, passed: percent >= targetAcc, target: targetAcc, durationSeconds: duration, topicResults });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  const breadcrumbs = useMemo(() => [
    { label: "Home", href: "/" }, { label: "Profile", href: "/profile" }, { label: "Question Bank" },
  ], []);

  const timerWarn = timeLeft < 300;
  const timerUrgent = timeLeft < 60;

  if (contentLoading) {
    return <LoadingAnimation fullScreen variant="portal" />;
  }

  if (error) {
    return (
     <div className="min-h-screen bg-white flex flex-col items-center justify-center p-10 text-center">
       <span className="material-symbols-outlined text-rose-500 text-6xl mb-6">error</span>
       <div className="text-2xl font-black text-primary mb-3">Workout Interrupted</div>
       <div className="text-on-surface-variant font-medium mb-8 max-w-sm">{error}</div>
       <button onClick={() => router.push('/profile')} className="bg-primary text-white px-10 py-3.5 rounded-xl font-bold uppercase tracking-widest text-xs">Back to Profile</button>
     </div>
   );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* HEADER SECTION - EXACT PARITY WITH MISTAKE BANK */}
      <div className="border-b border-outline/30 bg-gradient-to-r from-slate-50 to-white">
        <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 flex flex-col gap-3 sm:gap-4">
          <div className="flex items-center justify-between gap-4 sm:gap-6">
            <BackButton fallbackHref="/profile" />
            <Breadcrumbs items={breadcrumbs} />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.2em] font-black text-on-surface-variant">
                Question Bank Workout
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-primary mt-1 sm:mt-2 tracking-tight truncate uppercase">Practice Session</div>
              
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
                    {timeMin} min
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-amber-50 border border-amber-200 text-[10px] sm:text-xs font-extrabold text-amber-700 rounded-lg">
                    <span className="material-symbols-outlined text-[14px] sm:text-[16px] text-amber-500">task_alt</span>
                    Pass {targetAcc}%
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {!started ? (
                <button
                  onClick={() => setStarted(true)}
                  className="bg-secondary text-white px-5 sm:px-6 py-2.5 sm:py-3 font-bold text-sm hover:brightness-110 transition-all rounded-lg active:scale-95 uppercase tracking-widest"
                >
                  Start Workout
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
                <button type="button" onClick={() => setTab("test")} className={tab === "test" ? "bg-white text-primary px-4 py-1.5 rounded-lg shadow-sm font-extrabold text-xs transition-all" : "text-on-surface-variant hover:text-primary px-4 py-1.5 rounded-lg font-bold text-xs transition-all"}>Questions</button>
                <button type="button" onClick={() => setTab("reference")} className={tab === "reference" ? "bg-white text-primary px-4 py-1.5 rounded-lg shadow-sm font-extrabold text-xs transition-all" : "text-on-surface-variant hover:text-primary px-4 py-1.5 rounded-lg font-bold text-xs transition-all"}>Reference</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="max-w-7xl mx-auto">
        {!started && !result ? (
          <div className="p-8 sm:p-12 md:p-16 flex flex-col items-center max-w-2xl mx-auto text-center">
             <div className="w-24 h-24 bg-primary/5 text-primary rounded-[32px] flex items-center justify-center mb-10 transform rotate-3 shadow-sm border border-primary/5">
                <span className="material-symbols-outlined text-5xl">fitness_center</span>
             </div>
             <h1 className="text-3xl sm:text-4xl font-extrabold text-primary font-headline tracking-tighter mb-4">Start your Brain Workout</h1>
             <p className="text-on-surface-variant font-medium text-lg leading-relaxed mb-10">
               Practice the {questions.length} questions you selected. Complete them with at least {targetAcc}% accuracy to meet your goal.
             </p>
             <button onClick={() => setStarted(true)} className="bg-primary text-white w-full py-5 text-lg font-extrabold shadow-soft-xl hover:shadow-soft-2xl transition-all rounded-2xl active:scale-[0.98] uppercase tracking-[0.2em]">Begin Workout</button>
          </div>
        ) : result ? (
          /* RESULT VIEW - EXACT PARITY */
          <div className="p-4 sm:p-6 md:p-10">
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
               <div className="lg:col-span-12">
                  <div className="text-secondary font-black text-[12px] uppercase tracking-[0.4em] mb-4">Workout Over</div>
                  <h2 className="font-headline text-5xl sm:text-7xl font-extrabold text-primary tracking-tighter mb-4">Results</h2>
                  <div className="text-on-surface-variant text-lg sm:text-xl font-medium max-w-2xl leading-relaxed">
                    You completed the session with {result.percent}% accuracy. {result.passed ? "Success!" : "Try again!"}
                  </div>
               </div>
               <div className="lg:col-span-12 flex flex-wrap gap-4 mt-8">
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6 shadow-sm flex-1 min-w-[150px]">
                    <div className="text-[10px] uppercase tracking-[0.3em] text-blue-600 font-black mb-1">Accuracy</div>
                    <div className="text-4xl font-black text-blue-700">{result.percent}%</div>
                  </div>
                  <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-6 shadow-sm flex-1 min-w-[150px]">
                    <div className="text-[10px] uppercase tracking-[0.3em] text-indigo-600 font-black mb-1">Duration</div>
                    <div className="text-4xl font-black text-indigo-700">{secondsToClock(result.durationSeconds)}</div>
                  </div>
                  <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6 shadow-sm flex-1 min-w-[150px]">
                    <div className="text-[10px] uppercase tracking-[0.3em] text-emerald-600 font-black mb-1">Goal Status</div>
                    <div className="text-2xl font-black text-emerald-700">{result.passed ? 'TARGET MET' : 'NOT MET'}</div>
                  </div>
               </div>
             </div>

             {/* Topic analysis - hierarchical expandable view */}
             <div className="mt-12 bg-white border border-outline/30 shadow-sm rounded-xl overflow-hidden space-y-0">
                <div className="p-6 sm:p-8 border-b border-outline/20 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-[20px]">analytics</span>
                    <h3 className="text-xs font-black uppercase tracking-widest text-primary">Topic Analysis</h3>
                  </div>
                  <div className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest opacity-60">Workout Breakdown</div>
                </div>
                <div className="p-4 sm:p-8">
                  <div className="flex flex-col gap-4">
                    {result.topicResults?.map(tr => (
                      <div key={tr.topicId} className="group bg-white border border-outline/20 rounded-lg overflow-hidden transition-all hover:border-primary/20 hover:shadow-sm">
                          <div className="p-4 flex items-center justify-between cursor-pointer select-none" onClick={(e) => {
                            const content = e.currentTarget.nextElementSibling;
                            if (content) content.classList.toggle('hidden');
                            const icon = e.currentTarget.querySelector('.expand-icon');
                            if (icon) icon.classList.toggle('rotate-180');
                          }}>
                            <div className="flex items-center gap-5">
                              <div className={`w-14 h-14 rounded flex flex-col items-center justify-center font-black ${tr.percent >= targetAcc ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                <span className="text-lg leading-none">{tr.percent}%</span>
                                <span className="text-[8px] uppercase mt-1 opacity-70">Accuracy</span>
                              </div>
                              <div>
                                <div className="text-[13px] font-black text-primary uppercase tracking-wide">{tr.title}</div>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <div className="w-24 h-1 bg-slate-100 rounded-full overflow-hidden">
                                     <div className={`h-full ${tr.percent >= targetAcc ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${tr.percent}%` }} />
                                  </div>
                                  <span className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-tighter">{tr.correct}/{tr.total} Correct</span>
                                </div>
                              </div>
                            </div>
                            <span className="expand-icon material-symbols-outlined text-[20px] text-slate-300 transition-transform">expand_more</span>
                          </div>
                          
                          <div className="hidden px-5 pb-5 pt-1 border-t border-outline/5 bg-slate-50/20 space-y-5 animate-slide-up">
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mt-3 flex items-center gap-2">
                               <div className="w-4 h-[1px] bg-slate-200"></div> Subtopics
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-5">
                              {tr.subtopicResults.map(st => (
                                <div key={st.subtopicId} className="space-y-2">
                                  <div className="flex justify-between text-[11px] font-bold uppercase tracking-tight">
                                    <span className="text-primary/70">{st.title}</span>
                                    <span className={`flex items-center gap-1.5 ${st.percent >= targetAcc ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      {st.percent}%
                                      <span className="text-[9px] opacity-40">({st.correct}/{st.total})</span>
                                    </span>
                                  </div>
                                  <div className="h-1 bg-slate-200/50 rounded-full overflow-hidden">
                                    <div className={`h-full transition-all duration-700 ${st.percent >= targetAcc ? 'bg-emerald-400' : 'bg-rose-400'}`} style={{ width: `${st.percent}%` }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                      </div>
                    ))}
                  </div>
                </div>
             </div>

             {/* Review Matrix - EXACT PARITY */}
             <div className="mt-8 sm:mt-12 w-full bg-slate-50 border-2 border-outline/10 rounded-2xl p-6 sm:p-10 mb-12 shadow-sm">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8 text-center sm:text-left">
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
                      const sel = new Set(st?.selectedOptionIds ?? []);
                      const fill = (st?.fillText ?? "").trim();
                      const hasAns = q.type === "fill" ? !!fill : sel.size > 0;
                      let isC = false;
                      if (hasAns) {
                        if (q.type === 'mcq') {
                          const cIds = q.options.filter(o => o.is_correct).map(o => o.id);
                          isC = cIds.length === sel.size && cIds.every(id => sel.has(id));
                        } else isC = normalizeText(fill) === normalizeText(q.correct_text || "");
                      }
                      const b = !hasAns ? "border-outline/40" : isC ? "border-emerald-400" : "border-rose-400";
                      const bg = !hasAns ? "bg-slate-100" : isC ? "bg-emerald-50" : "bg-rose-50";
                      return (
                        <button key={q.id} onClick={() => { setCurrentReviewIndex(idx); document.getElementById('detailed-analysis-top')?.scrollIntoView({ behavior: "smooth" }); }} className={`h-8 sm:h-10 border-2 ${b} ${bg} font-bold text-xs sm:text-sm text-primary flex items-center justify-center rounded-lg transition-all`}>{idx + 1}</button>
                      );
                   })}
                </div>
             </div>

             {/* Detailed Analysis */}
             <div id="detailed-analysis-top" className="mt-20 space-y-12">
               <div className="text-secondary font-black text-[12px] uppercase tracking-[0.5em] mb-10">Detailed Analysis</div>
               {(() => {
                  const idx = currentReviewIndex; const q = questions[idx]; if (!q) return null;
                  const st = qState.get(q.id); const sel = new Set(st?.selectedOptionIds ?? []);
                  const fill = (st?.fillText ?? "").trim();
                  const hasAns = q.type === "fill" ? !!fill : sel.size > 0;
                  let isC = false;
                  if (hasAns) {
                    if (q.type === 'mcq') {
                      const cIds = q.options.filter(o => o.is_correct).map(o => o.id);
                      isC = cIds.length === sel.size && cIds.every(id => sel.has(id));
                    } else isC = normalizeText(fill) === normalizeText(q.correct_text || "");
                  }
                  const card = (
                    <div className="bg-white border-2 border-outline/30 shadow-soft-md rounded-2xl overflow-hidden scroll-mt-32">
                      <div className="p-6 border-b border-outline/30 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-primary/10 text-primary font-black rounded-xl flex items-center justify-center">{idx + 1}</div>
                          <div className="text-sm font-black text-primary uppercase tracking-widest">{q.subjectTitle || "Workout"}</div>
                        </div>
                        <span className={`px-4 py-1.5 text-[10px] font-black tracking-[0.2em] uppercase rounded-xl border-2 ${!hasAns ? "bg-slate-100 border-outline/40" : isC ? "bg-emerald-50 border-emerald-400 text-emerald-700" : "bg-rose-50 border-rose-400 text-rose-700"}`}>{!hasAns ? "Skipped" : isC ? "Correct" : "Incorrect"}</span>
                      </div>
                      <div className="p-6 sm:p-10 space-y-8">
                         {q.prompt_text && <div className="text-on-surface font-medium leading-loose text-lg prose max-w-none"><MathText text={q.prompt_text} /></div>}
                         {q.prompt_assets?.map(a => <div key={a.id} className="border-2 border-outline/30 bg-slate-50 overflow-hidden rounded-3xl max-w-2xl"><img src={assetUrl(a)!} className="w-full h-auto" /></div>)}
                         {q.type === "fill" ? (
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="border-2 border-outline/30 bg-slate-50 p-6 rounded-2xl"><div className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-2">You</div><div className="text-lg font-black text-primary">{fill || "—"}</div></div>
                              <div className="border-2 border-emerald-300 bg-emerald-50 p-6 rounded-2xl"><div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Correct</div><div className="text-lg font-black text-emerald-700">{q.correct_text || "—"}</div></div>
                           </div>
                         ) : (
                           <div className="space-y-3">
                             {q.options?.map(o => {
                                const isS = sel.has(o.id); const isCr = o.is_correct;
                                const b = isCr ? "border-emerald-500 shadow-md shadow-emerald-100" : isS ? "border-rose-400" : "border-outline/20";
                                const bg = isCr ? "bg-emerald-50/50" : isS ? "bg-rose-50/50" : "bg-white";
                                return (
                                  <div key={o.id} className={`w-full p-5 rounded-2xl border-2 flex items-start gap-5 ${b} ${bg} transition-all`}>
                                     <div className="flex-1 min-w-0 pt-1 text-base font-bold text-on-surface prose max-w-none"><MathText text={o.text || ""} /></div>
                                     {isCr && <span className="material-symbols-outlined text-emerald-600">check_circle</span>}
                                     {isS && !isCr && <span className="material-symbols-outlined text-rose-600">cancel</span>}
                                  </div>
                                );
                             })}
                           </div>
                         )}
                         {q.explanation_text && (
                           <div className="mt-8 p-6 sm:p-10 bg-blue-50/30 border-2 border-blue-100 rounded-2xl">
                              <div className="text-[10px] font-black text-blue-800 uppercase tracking-[0.4em] mb-4 flex items-center gap-2 font-headline"><span className="material-symbols-outlined text-xl">lightbulb</span>Explanation</div>
                              <div className="text-base leading-relaxed text-blue-900 font-medium prose max-w-none"><MathText text={q.explanation_text} /></div>
                              {q.explanation_assets?.map(a => <img key={a.id} src={assetUrl(a)!} className="mt-6 rounded-2xl max-h-80" />)}
                           </div>
                         )}
                         <div className="mt-12 flex items-center justify-between gap-6 pt-8 border-t border-outline/20">
                            <button onClick={() => setCurrentReviewIndex(v => Math.max(0,v-1))} disabled={currentReviewIndex===0} className="bg-white text-primary border-2 border-outline/40 px-5 sm:px-8 py-2.5 sm:py-3 font-bold uppercase tracking-wider text-xs sm:text-sm rounded-xl disabled:opacity-20 transition-all hover:bg-slate-50">Previous</button>
                            <button onClick={() => setCurrentReviewIndex(v => Math.min(questions.length-1, v+1))} disabled={currentReviewIndex===questions.length-1} className="bg-primary text-white border-2 border-primary px-6 sm:px-10 py-2.5 sm:py-3 font-bold uppercase tracking-wider text-xs sm:text-sm rounded-xl transition-all hover:bg-slate-800 shadow-md flex items-center gap-2">Next Analysis <span className="material-symbols-outlined text-[18px]">chevron_right</span></button>
                         </div>
                      </div>
                    </div>
                  );
                  const p = q.passage;
                  if (!p) return <div key={q.id}>{card}</div>;
                  const panel = (
                    <div className={`border-2 ${p.kind === 'reference' ? 'border-sky-200 bg-gradient-to-br from-sky-50 to-white' : 'border-violet-200 bg-gradient-to-br from-violet-50 to-white'} rounded-2xl overflow-hidden flex flex-col shadow-sm`}>
                       <div className={`px-4 py-3 ${p.kind === 'reference' ? 'bg-sky-100/60 border-b border-sky-200' : 'bg-violet-100/60 border-b border-violet-200'} flex items-center gap-2`}><span className={`material-symbols-outlined ${p.kind === 'reference' ? 'text-sky-600' : 'text-violet-600'} text-lg`}>{p.kind === 'reference' ? 'view_cozy' : 'menu_book'}</span><div className={`text-xs font-black uppercase tracking-[0.15em] ${p.kind === 'reference' ? 'text-sky-700' : 'text-violet-700'}`}>{p.kind === 'reference' ? 'Reference' : 'Passage'}</div></div>
                       <div className={`p-6 prose prose-sm max-w-none text-on-surface leading-loose break-words lg:max-h-[50vh] overflow-y-auto`} dangerouslySetInnerHTML={{ __html: p.body_html }} />
                    </div>
                  );
                  return (
                    <div key={q.id} className="lg:grid lg:grid-cols-2 gap-8">{panel}{card}</div>
                  );
               })()}
             </div>
          </div>
        ) : (
          /* ACTIVE PRACTICE VIEW - EXACT PARITY */
          <div>
            <div className="px-4 sm:px-6 md:px-8 py-5 border-b border-outline/30 bg-slate-50/50">
               <div className="flex flex-col sm:flex-row items-baseline justify-between gap-4 mb-4">
                  <div className="text-xs font-black text-primary uppercase tracking-widest">Questions Overview</div>
                  <div className="flex flex-wrap gap-4 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">
                     <div className="flex items-center gap-1.5 font-black text-[9px] sm:text-[10px]"><span className="w-3.5 h-3.5 border-2 border-outline/40 bg-slate-100 rounded-md" /> Unseen</div>
                     <div className="flex items-center gap-1.5 font-black text-[9px] sm:text-[10px]"><span className="w-3.5 h-3.5 border-2 border-emerald-400 bg-emerald-50 rounded-md" /> Answered</div>
                     <div className="flex items-center gap-1.5 font-black text-[9px] sm:text-[10px]"><span className="w-3.5 h-3.5 border-2 border-amber-400 bg-amber-50 rounded-md" /> Marked</div>
                  </div>
               </div>
               <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 lg:grid-cols-16 xl:grid-cols-20 gap-2">
                 {overview.map(({ q, seen, answered, marked }, idx) => {
                    const isC = idx === currentIndex;
                    const b = marked ? "border-amber-400" : answered ? "border-emerald-400" : "border-outline/40";
                    const bg = marked ? "bg-amber-50" : answered ? "bg-emerald-50" : "bg-slate-100";
                    const r = isC ? "ring-2 ring-primary/30" : "";
                    return (
                      <button key={q.id} onClick={() => { setCurrentIndex(idx); setTimeout(() => questionTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 10); }} className={`h-8 sm:h-10 border-2 ${b} ${bg} ${r} font-bold text-xs sm:text-sm text-primary rounded-lg transition-all`}>{idx + 1}</button>
                    );
                 })}
               </div>
            </div>

            <div className="p-4 sm:p-6 md:p-10">
               {tab === "reference" ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="bg-slate-50 border-2 border-outline/10 p-10 rounded-3xl text-center"><span className="material-symbols-outlined text-4xl text-primary mb-4">view_cozy</span><h3 className="font-bold">Reference Material</h3><p className="text-xs text-on-surface-variant">Switch to Questions to see workout items.</p></div>
                 </div>
               ) : (
                currentQuestion && (
                  <>
                    <div ref={questionTopRef} className="flex items-start justify-between gap-6 mb-8">
                        <div className="text-secondary font-black text-[11px] uppercase tracking-[0.4em]">Question {currentIndex + 1} of {questions.length}</div>
                        <button onClick={() => setQStat(p => { const n=new Map(p); const s=n.get(currentQuestion.id); if(s) n.set(currentQuestion.id, {...s, marked:!s.marked}); return n; })} className={`px-5 py-2.5 font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all border-2 flex items-center gap-2 active:scale-95 ${qState.get(currentQuestion.id)?.marked ? "bg-amber-100 border-amber-500 text-amber-800" : "bg-white border-outline/40 text-on-surface-variant"}`}><span className="material-symbols-outlined text-[18px]">flag</span>Mark for review</button>
                    </div>
                    {(() => {
                        const p = currentQuestion.passage;
                        const body = (
                          <div className="space-y-4 sm:space-y-6 bg-gradient-to-br from-white to-slate-50 border-2 border-outline/30 shadow-sm rounded-2xl p-4 sm:p-6 md:p-8">
                             {currentQuestion.prompt_text && <div className="text-base sm:text-lg text-on-surface leading-relaxed font-medium"><MathText text={currentQuestion.prompt_text} /></div>}
                             {currentQuestion.prompt_assets?.map(a => <div key={a.id} className="border-2 border-outline/30 bg-slate-50 overflow-hidden rounded-xl max-w-full"><img src={assetUrl(a)!} className="w-full h-auto" /></div>)}
                             {currentQuestion.type === "fill" ? (
                               <div className="max-w-xl"><div className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.3em] mb-4">Input Solution</div><input className="h-14 w-full px-6 border-2 border-outline/40 rounded-2xl outline-none focus:border-primary transition-all font-bold text-xl" value={qState.get(currentQuestion.id)?.fillText ?? ""} onChange={e => setQStat(p => { const n=new Map(p); const s=n.get(currentQuestion.id); if(s) n.set(currentQuestion.id, {...s, fillText: e.target.value}); return n; })} placeholder="Enter answer..." /></div>
                             ) : (
                               <div className="grid grid-cols-1 gap-4">
                                 {currentQuestion.options?.map((opt) => {
                                   const sel = qState.get(currentQuestion.id)?.selectedOptionIds.includes(opt.id);
                                   return (
                                     <button key={opt.id} onClick={() => setQStat(pw => { const n=new Map(pw); const s=n.get(currentQuestion.id); if(!s) return pw; let sl = currentQuestion.allow_multiple ? (s.selectedOptionIds.includes(opt.id) ? s.selectedOptionIds.filter(i=>i!==opt.id) : [...s.selectedOptionIds, opt.id]) : [opt.id]; n.set(currentQuestion.id, {...s, selectedOptionIds: sl}); return n; })} className={`w-full text-left border-2 px-4 sm:px-6 py-3 sm:py-4 transition-all rounded-xl active:scale-[0.97] ${sel ? "border-primary bg-primary/5 text-primary" : "border-outline/30 bg-white text-on-surface hover:bg-primary/5 hover:border-primary/30"}`}><div className="flex items-start gap-5"><div className="flex-1 min-w-0 pt-1 text-sm sm:text-base font-bold prose max-w-none"><MathText text={opt.text || ""} /></div></div></button>
                                   );
                                 })}
                               </div>
                             )}
                          </div>
                        );
                        if (!p) return <div className="mt-8">{body}</div>;
                        const panel = (
                          <div className={`border-2 ${p.kind === 'reference' ? 'border-sky-200 bg-gradient-to-br from-sky-50 to-white' : 'border-violet-200 bg-gradient-to-br from-violet-50 to-white'} rounded-[40px] overflow-hidden flex flex-col shadow-sm`}>
                             <div className={`px-6 py-4 ${p.kind === 'reference' ? 'bg-sky-100/60 border-b border-sky-200' : 'bg-violet-100/60 border-b border-violet-200'} flex items-center gap-3`}><span className={`material-symbols-outlined ${p.kind === 'reference' ? 'text-sky-600' : 'text-violet-600'} text-2xl`}>{p.kind === 'reference' ? 'view_cozy' : 'menu_book'}</span><div className={`text-xs font-black uppercase tracking-[0.2em] ${p.kind === 'reference' ? 'text-sky-700' : 'text-violet-700'}`}>{p.kind === 'reference' ? 'Reference' : 'Passage'}</div></div>
                             <div className={`p-8 prose prose-slate max-w-none text-on-surface leading-loose break-words lg:max-h-[60vh] overflow-y-auto`}><MathText text={p.body_html} /></div>
                          </div>
                        );
                        return (
                          <div className="mt-8 lg:grid lg:grid-cols-2 gap-10">{panel}{body}</div>
                        );
                    })()}

                    <div className="mt-12 flex items-center justify-between gap-6 pb-20">
                      <button onClick={() => { setCurrentIndex(v => Math.max(0,v-1)); setTimeout(() => questionTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 10); }} disabled={currentIndex === 0} className="bg-white text-primary border-2 border-outline/40 px-8 py-4 font-black uppercase tracking-widest text-xs rounded-2xl disabled:opacity-20 transition-all hover:bg-slate-50">Previous</button>
                      <button onClick={() => { recordStreakActivity(); if(currentIndex === questions.length-1) onSubmit(); else { setCurrentIndex(v => Math.min(questions.length-1, v+1)); setTimeout(() => questionTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 10); } }} disabled={submitting} className="bg-primary text-white px-10 py-4 font-black uppercase tracking-widest text-xs rounded-2xl transition-all hover:bg-slate-800 shadow-lg">{currentIndex === questions.length - 1 ? "Submit Workout" : "Next Question"}</button>
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
