"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import BackButton from "@/components/BackButton";
import Breadcrumbs from "@/components/Breadcrumbs";
import MathText from "@/components/MathText";
import LoadingAnimation from "@/components/LoadingAnimation";

// @ts-ignore
import renderMathInElement from 'katex/dist/contrib/auto-render';
import 'katex/dist/katex.min.css';

type Exam = {
  id: string;
  title: string;
  duration_seconds: number;
  pass_percent: number;
  min_score: number;
  total_points: number;
  is_free: boolean;
  max_attempts: number | null;
};

type ExamNavItem = {
  id: string;
  exam_number: number;
  title: string;
  is_free: boolean;
  pass_percent: number;
  min_score: number;
};

type Offer = {
  id: string;
  label: string;
  expires_at: string;
  price_cents: number;
  currency: string;
};

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
  type: "mcq" | "fill" | "reference_block";
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
  parent_id: string | null;
  sub_questions?: Question[];
};

type Props = {
  subjectId: string;
  subjectSlug: string;
  subjectTitle: string;
  subjectTrack: string | null;
  examNumber: number;
  exam: Exam;
  allExams: ExamNavItem[];
  offers: Offer[];
};

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

function assetUrl(a: Asset | null) {
  if (!a) return null;
  if (a.url) return a.url;
  if (a.storage_path) {
    return supabase.storage.from(a.bucket ?? "assets").getPublicUrl(a.storage_path).data
      .publicUrl;
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

function formatMoney(cents: number, currency: string) {
  const value = cents / 100;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function scoreMcq(question: Question, selected: Set<string>) {
  const correct = question.options.filter((o) => o.is_correct).map((o) => o.id);
  const correctSet = new Set(correct);
  const totalCorrect = correct.length || 1;

  if (!question.allow_multiple) {
    const picked = Array.from(selected);
    if (picked.length !== 1) return 0;
    return correctSet.has(picked[0]) ? question.points : 0;
  }

  let correctSelected = 0;
  let wrongSelected = 0;
  for (const id of selected) {
    if (correctSet.has(id)) correctSelected += 1;
    else wrongSelected += 1;
  }

  const raw = (correctSelected - wrongSelected) / totalCorrect;
  const ratio = Math.max(0, Math.min(1, raw));
  return Math.round(question.points * ratio);
}

function scoreFill(question: Question, input: string) {
  const expected = question.correct_text ?? "";
  if (!expected) return 0;
  return normalizeText(input) === normalizeText(expected) ? question.points : 0;
}

type QuestionState = {
  seen: boolean;
  marked: boolean;
  selectedOptionIds: string[];
  fillText: string;
};

type SubmitResult = {
  attemptId: string;
  score: number;
  percent: number;
  passed: boolean;
  earnedPoints: number;
  totalPoints: number;
  correctQuestions: number;
  totalQuestions: number;
  questionsPercent: number;
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

function buildInitialQState(questions: Question[]) {
  const map = new Map<string, QuestionState>();
  function init(qs: Question[]) {
     for (const q of qs) {
        map.set(q.id, { seen: false, marked: false, selectedOptionIds: [], fillText: "" });
        if (q.sub_questions && q.sub_questions.length > 0) init(q.sub_questions);
     }
  }
  init(questions);
  return map;
}

export default function ExamClient({
  subjectId,
  subjectSlug,
  subjectTitle,
  subjectTrack,
  examNumber,
  exam,
  allExams,
  offers,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const attemptIdParam = searchParams.get("attempt_id");
  const [navOpen, setNavOpen] = useState(true);
  const [tab, setTab] = useState<"test" | "reference">("test");
  const [started, setStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const questionTopRef = useRef<HTMLDivElement | null>(null);

  const [accessChecked, setAccessChecked] = useState(false);
  const [accessAllowed, setAccessAllowed] = useState(exam.is_free);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);

  const [contentLoading, setContentLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [referenceSheets, setReferenceSheets] = useState<Asset[]>([]);
  const [passagesById, setPassagesById] = useState<Map<string, Passage>>(new Map());
  const [topicsById, setTopicsById] = useState<Map<string, string>>(new Map());
  const [subtopicsById, setSubtopicsById] = useState<Map<string, { title: string; topicId: string }>>(new Map());

  const [currentIndex, setCurrentIndex] = useState(0);
  const [remaining, setRemaining] = useState(exam.duration_seconds);
  const startedAtRef = useRef<number | null>(null);
  const [optionOrder, setOptionOrder] = useState<Map<string, string[]>>(new Map());
  const [examStatus, setExamStatus] = useState<Map<string, { attempted: boolean; passed: boolean }>>(
    new Map(),
  );

  const [qState, setQState] = useState<Map<string, QuestionState>>(new Map());

  /* Past attempts for the donut history feature */
  const [pastAttempts, setPastAttempts] = useState<{ id: string; score: number; submitted_at: string }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(offers[0]?.id ?? null);
  const selectedOffer = useMemo(() => {
    return offers.find((o) => o.id === selectedOfferId) ?? offers[0] ?? null;
  }, [offers, selectedOfferId]);

  const flatQuestions = useMemo(() => {
    const list: Question[] = [];
    function walk(qs: Question[]) {
      for (const q of qs) {
        if (!q) continue;
        if (q.type === 'reference_block') {
          if (q.sub_questions && q.sub_questions.length > 0) walk(q.sub_questions);
          continue;
        }
        // Ensure the question has a valid ID and type to avoid phantom items
        if (q.id && q.type) {
           list.push(q);
        }
      }
    }
    walk(questions);
    return list;
  }, [questions]);

  const currentUnit = useMemo(() => {
    const targetId = flatQuestions[currentIndex]?.id;
    if (!targetId) return questions[0] ?? null;
    return questions.find(q => {
      if (q.id === targetId) return true;
      if (q.type === 'reference_block' && q.sub_questions) {
        return q.sub_questions.some(sub => sub.id === targetId);
      }
      return false;
    }) ?? questions[0] ?? null;
  }, [questions, flatQuestions, currentIndex]);

  const totalQuestionsCount = flatQuestions.length;

  useEffect(() => {
    setSelectedOfferId((prev) => prev ?? offers[0]?.id ?? null);
  }, [offers]);

  useEffect(() => {
    setRemaining(exam.duration_seconds);
  }, [exam.duration_seconds]);

  useEffect(() => {
    let mounted = true;
    async function checkAccess() {
      setAccessChecked(false);
      setAccessAllowed(!!exam.is_free);
      setSessionUserId(null);

      if (exam.is_free) {
        if (mounted) {
          setAccessAllowed(true);
          setAccessChecked(true);
        }
        return;
      }

      const { data } = await supabase.auth.getSession();
      const user = data.session?.user ?? null;
      if (mounted) setSessionUserId(user?.id ?? null);

      if (!user) {
        if (mounted) {
          setAccessAllowed(false);
          setAccessChecked(true);
        }
        return;
      }

      const nowIso = new Date().toISOString();
      const { data: entRows } = await supabase
        .from("entitlements")
        .select("id")
        .eq("user_id", user.id)
        .eq("subject_id", subjectId)
        .gte("access_expires_at", nowIso)
        .limit(1)
        .returns<{ id: string }[]>();

      if (!mounted) return;
      setAccessAllowed(!!entRows?.length);
      setAccessChecked(true);
    }
    checkAccess();
    return () => {
      mounted = false;
    };
  }, [exam.is_free, subjectId]);

  useEffect(() => {
    let mounted = true;
    async function loadContent() {
      setContentLoading(true);
      try {
        const { data: sheetRows } = await supabase
          .from("exam_assets")
          .select("id, url, bucket, storage_path")
          .eq("exam_id", exam.id)
          .order("sort_order", { ascending: true })
          .returns<Asset[]>();

        /* Fetch passages */
        const { data: passageRows } = await supabase
          .from("exam_passages")
          .select("id, title, body_html, kind")
          .eq("exam_id", exam.id)
          .order("sort_order", { ascending: true })
          .returns<{ id: string; title: string | null; body_html: string; kind: "reading" | "reference" }[]>();

        const { data: qRows } = await supabase
          .from("exam_questions")
          .select(
            "id, question_number, type, prompt_text, explanation_text, points, allow_multiple, correct_text, passage_id, topic_id, subtopic_id, parent_id",
          )
          .eq("exam_id", exam.id)
          .order("question_number", { ascending: true })
          .returns<
            {
              id: string;
              question_number: number;
              type: "mcq" | "fill" | "reference_block";
              prompt_text: string | null;
              explanation_text: string | null;
              points: number;
              allow_multiple: boolean;
              correct_text: string | null;
              passage_id: string | null;
              topic_id: string | null;
              subtopic_id: string | null;
              parent_id: string | null;
            }[]
          >();

        const questionIds = (qRows ?? []).map((q) => q.id);

        const { data: qAssets } = questionIds.length
          ? await supabase
              .from("exam_question_assets")
              .select("id, bucket, storage_path, url, sort_order, kind, question_id")
              .in("question_id", questionIds)
              .order("sort_order", { ascending: true })
              .returns<
                (Asset & {
                  sort_order: number;
                  kind?: "prompt" | "explanation" | null;
                  question_id: string;
                })[]
              >()
          : { data: [] as (Asset & { sort_order: number; kind?: "prompt" | "explanation" | null; question_id: string })[] };

        const { data: qOptions } = questionIds.length
          ? await supabase
              .from("exam_question_options")
              .select("id, question_id, option_number, text, bucket, storage_path, url, is_correct")
              .in("question_id", questionIds)
              .order("option_number", { ascending: true })
              .returns<
                {
                  id: string;
                  question_id: string;
                  option_number: number;
                  text: string | null;
                  bucket: string | null;
                  storage_path: string | null;
                  url: string | null;
                  is_correct: boolean;
                }[]
              >()
          : {
              data: [] as {
                id: string;
                question_id: string;
                option_number: number;
                text: string | null;
                bucket: string | null;
                storage_path: string | null;
                url: string | null;
                is_correct: boolean;
              }[],
            };

        const promptAssetsByQ = new Map<string, Asset[]>();
        const explanationAssetsByQ = new Map<string, Asset[]>();
        for (const a of qAssets ?? []) {
          const kind = a.kind ?? "prompt";
          const map = kind === "explanation" ? explanationAssetsByQ : promptAssetsByQ;
          const list = map.get(a.question_id) ?? [];
          list.push(a);
          map.set(a.question_id, list);
        }

        const optionsByQ = new Map<string, Option[]>();
        for (const o of qOptions ?? []) {
          const list = optionsByQ.get(o.question_id) ?? [];
          list.push({
            id: o.id,
            option_number: o.option_number,
            text: o.text,
            url: o.url,
            bucket: o.bucket,
            storage_path: o.storage_path,
            is_correct: o.is_correct,
          });
          optionsByQ.set(o.question_id, list);
        }

        const allQs: Question[] = (qRows || []).map((q) => ({
          ...q,
          prompt_assets: promptAssetsByQ.get(q.id) ?? [],
          explanation_assets: explanationAssetsByQ.get(q.id) ?? [],
          options: optionsByQ.get(q.id) ?? [],
          passage_id: q.passage_id ?? null,
          parent_id: q.parent_id ?? null,
        }));

        // Group into hierarchy
        const finalQs: Question[] = [];
        const byId = new Map<string, Question>();
        allQs.forEach(q => byId.set(q.id, { ...q, sub_questions: [] }));

        allQs.forEach(q => {
          if (q.parent_id && byId.has(q.parent_id)) {
             byId.get(q.parent_id)!.sub_questions!.push(byId.get(q.id)!);
          } else if (!q.parent_id) {
             finalQs.push(byId.get(q.id)!);
          }
        });

        const qs = finalQs;

        /* Build passages map */
        const pMap = new Map<string, Passage>();
        for (const p of passageRows ?? []) {
          pMap.set(p.id, { id: p.id, title: p.title, body_html: p.body_html, kind: p.kind ?? "reading" });
        }

        /* Fetch topics */
        const { data: topicRows } = await supabase
          .from("topics")
          .select("id, title")
          .returns<{ id: string; title: string }[]>();

        const tMap = new Map<string, string>();
        for (const t of topicRows ?? []) {
          tMap.set(t.id, t.title);
        }

        /* Fetch subtopics */
        const { data: subtopicRows } = await supabase
          .from("subtopics")
          .select("id, title, topic_id")
          .returns<{ id: string; title: string; topic_id: string }[]>();

        const stMap = new Map<string, { title: string; topicId: string }>();
        for (const st of subtopicRows ?? []) {
          stMap.set(st.id, { title: st.title, topicId: st.topic_id });
        }

        if (!mounted) return;
        setReferenceSheets(sheetRows ?? []);
        setQuestions(qs);
        setPassagesById(pMap);
        setTopicsById(tMap);
        setSubtopicsById(stMap);

        if (attemptIdParam) {
          loadPastAttempt(attemptIdParam, qs, tMap, stMap);
        }
      } finally {
        if (mounted) setContentLoading(false);
      }
    }

    if (!accessChecked) return;
    if (!accessAllowed) {
      setQuestions([]);
      setReferenceSheets([]);
      setContentLoading(false);
      return;
    }

    async function loadPastAttempt(aid: string, currentQuestions: Question[], topicTitles: Map<string, string>, subtopicInfo: Map<string, { title: string; topicId: string }>) {
      try {
        const { data: attempt, error: aErr } = await supabase
          .from("exam_attempts")
          .select("*")
          .eq("id", aid)
          .single();
        
        if (aErr || !attempt) throw new Error("Attempt not found");

        const savedAnswers = attempt.answers || {};
        const newQState = new Map<string, QuestionState>();
        
        currentQuestions.forEach(q => {
          const ans = savedAnswers[q.id] || { selectedOptionIds: [], fillText: "" };
          newQState.set(q.id, { seen: true, marked: false, ...ans });
        });
        setQState(newQState);

        // Recalculate topic results
        const subtopicsMap = new Map<string, { correct: number; total: number }>();
        currentQuestions.forEach(q => {
          const sid = q.subtopic_id || "general";
          const stats = subtopicsMap.get(sid) || { correct: 0, total: 0 };
          stats.total += 1;
          
          const ans = savedAnswers[q.id];
          const selected = new Set<string>(ans?.selectedOptionIds || []);
          const fill = (ans?.fillText || "").trim();
          
          let isCorrect = false;
          if (q.type === "mcq") {
            const correctOptionIds = new Set(q.options.filter(o => o.is_correct).map(o => o.id));
            if (selected.size > 0) {
              if (q.allow_multiple) {
                isCorrect = selected.size === correctOptionIds.size && Array.from(selected).every(id => correctOptionIds.has(id));
              } else {
                isCorrect = selected.size === 1 && correctOptionIds.has(Array.from(selected)[0]);
              }
            }
          } else {
            isCorrect = normalizeText(fill) === normalizeText(q.correct_text || "") && !!q.correct_text;
          }
          
          if (isCorrect) stats.correct++;
          subtopicsMap.set(sid, stats);
        });

        // Group subtopics into topics
        const topicsMap = new Map<string, { correct: number; total: number; subtopics: any[] }>();
        subtopicsMap.forEach((stats, sid) => {
          const info = subtopicInfo.get(sid);
          const tid = info?.topicId || "none";
          const tStats = topicsMap.get(tid) || { correct: 0, total: 0, subtopics: [] };
          tStats.correct += stats.correct;
          tStats.total += stats.total;
          tStats.subtopics.push({
            subtopicId: sid,
            title: info?.title || 'General',
            correct: stats.correct,
            total: stats.total,
            percent: Math.round((stats.correct / stats.total) * 100)
          });
          topicsMap.set(tid, tStats);
        });

        const topicResults = Array.from(topicsMap.entries()).map(([tid, s]) => ({
          topicId: tid,
          title: topicTitles.get(tid) || 'General',
          correct: s.correct,
          total: s.total,
          percent: Math.round((s.correct / s.total) * 100),
          subtopicResults: s.subtopics.sort((a, b) => a.title.localeCompare(b.title))
        })).sort((a, b) => a.title.localeCompare(b.title));

        setResult({
          attemptId: aid,
          score: attempt.score,
          percent: attempt.percent_correct,
          passed: attempt.score >= exam.min_score,
          earnedPoints: attempt.earned_points,
          totalPoints: attempt.total_points,
          correctQuestions: Math.round((attempt.percent_correct / 100) * currentQuestions.length),
          totalQuestions: currentQuestions.length,
          questionsPercent: attempt.percent_correct,
          durationSeconds: attempt.duration_seconds,
          topicResults
        });
        setStarted(true);
      } catch (e) {
        console.error("Error loading past attempt:", e);
      }
    }

    loadContent();
    return () => {
      mounted = false;
    };
  }, [accessAllowed, accessChecked, exam.id]);

  useEffect(() => {
    // Auto-render math in any element with class 'prose' after content loads
    const elements = document.querySelectorAll('.prose');
    elements.forEach(el => {
      renderMathInElement(el as HTMLElement, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
        ],
        throwOnError: false
      });
    });
  }, [contentLoading, currentIndex, qState, result]); // Re-run when navigation or state changes

  useEffect(() => {
    setQState(buildInitialQState(questions));
    setCurrentIndex(0);
    setStarted(false);
    setResult(null);
    setError(null);
    setSubmitting(false);
    setOptionOrder(new Map());
  }, [questions]);

  useEffect(() => {
    let mounted = true;
    async function loadExamStatus() {
      try {
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user;
        if (!user) {
          if (mounted) setExamStatus(new Map());
          return;
        }
        const examIds = allExams.map((e) => e.id);
        if (examIds.length === 0) {
          if (mounted) setExamStatus(new Map());
          return;
        }

        const { data: rows, error } = await supabase
          .from("exam_attempts")
          .select("exam_id,score,percent_correct,submitted_at")
          .eq("user_id", user.id)
          .in("exam_id", examIds)
          .order("submitted_at", { ascending: false })
          .limit(5000)
          .returns<{ exam_id: string; score: number; percent_correct: number; submitted_at: string }[]>();

        if (error) throw error;

        const byExam = new Map(allExams.map((e) => [e.id, e]));
        const status = new Map<string, { attempted: boolean; passed: boolean }>();

        for (const e of allExams) status.set(e.id, { attempted: false, passed: false });

        for (const r of rows ?? []) {
          const e = byExam.get(r.exam_id);
          if (!e) continue;
          const cur = status.get(r.exam_id) ?? { attempted: false, passed: false };
          cur.attempted = true;
          const passed = r.score >= e.min_score && r.percent_correct >= e.pass_percent;
          if (passed) cur.passed = true;
          status.set(r.exam_id, cur);
        }

        if (mounted) setExamStatus(status);
      } catch {
        if (mounted) setExamStatus(new Map());
      }
    }
    loadExamStatus();
    return () => {
      mounted = false;
    };
  }, [allExams]);

  /* Load past attempts for score history donut */
  useEffect(() => {
    if (!result) return;
    let mounted = true;
    async function loadPastAttempts() {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const user = sess.session?.user;
        if (!user) return;
        const { data: rows } = await supabase
          .from("exam_attempts")
          .select("id,score,submitted_at")
          .eq("user_id", user.id)
          .eq("exam_id", exam.id)
          .order("submitted_at", { ascending: false })
          .limit(100)
          .returns<{ id: string; score: number; submitted_at: string }[]>();
        if (mounted && rows) {
          setPastAttempts(rows);
          setHistoryIndex(0);
        }
      } catch { /* ignore */ }
    }
    loadPastAttempts();
    return () => { mounted = false; };
  }, [result, exam.id]);

  const currentQuestion = currentUnit;
  const currentSubQuestionId = flatQuestions[currentIndex]?.id;

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

  useEffect(() => {
    if (!started) return;
    if (result) return;
    const interval = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) return 0;
        return r - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [started, result]);

  useEffect(() => {
    if (!started) return;
    if (result) return;
    if (remaining > 0) return;
    onSubmit(true);
  }, [remaining, started, result]);

  useEffect(() => {
    if (result) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [result]);

  const answeredCount = useMemo(() => {
    let count = 0;
    function walk(qs: Question[]) {
       for (const q of qs) {
          if (q.type === 'reference_block') {
             if (q.sub_questions) walk(q.sub_questions);
             continue;
          }
          const st = qState.get(q.id);
          if (st) {
             const answered = q.type === "fill" ? !!st.fillText.trim() : st.selectedOptionIds.length > 0;
             if (answered) count += 1;
          }
       }
    }
    walk(questions);
    return count;
  }, [qState, questions]);

  const progressRatio = useMemo(() => {
    return exam.duration_seconds ? remaining / exam.duration_seconds : 0;
  }, [exam.duration_seconds, remaining]);

  const overview = useMemo(() => {
    const list: { q: Question; seen: boolean; marked: boolean; answered: boolean }[] = [];
    function walk(qs: Question[]) {
       for (const q of qs) {
          if (!q) continue;
          if (q.type === 'reference_block') {
             if (q.sub_questions && q.sub_questions.length > 0) walk(q.sub_questions);
             continue;
          }
          if (q.id && q.type) {
             const st = qState.get(q.id);
             const seen = !!st?.seen;
             const marked = !!st?.marked;
             const answered = q.type === "fill" ? !!st?.fillText.trim() : (st?.selectedOptionIds?.length ?? 0) > 0;
             list.push({ q, seen, marked, answered });
          }
       }
    }
    walk(questions);
    return list;
  }, [qState, questions]);

  async function requireAuth() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.push("/join?mode=login");
      return null;
    }
    return data.session.user;
  }

  function buildAnswersPayload() {
    const payload: Record<string, unknown> = {};
    function gather(qs: Question[]) {
       for (const q of qs) {
          const st = qState.get(q.id);
          if (st) {
             if (q.type === "fill") payload[q.id] = { type: "fill", value: st.fillText };
             else if (q.type === "mcq") payload[q.id] = { type: "mcq", selectedOptionIds: st.selectedOptionIds };
          }
          if (q.sub_questions && q.sub_questions.length > 0) gather(q.sub_questions);
       }
    }
    gather(questions);
    return payload;
  }

  function computeScore() {
    let earned = 0;
    let rawTotal = 0;

    function processQ(q: Question) {
       if (q.type === 'reference_block') {
          if (q.sub_questions) q.sub_questions.forEach(processQ);
          return;
       }
       rawTotal += q.points;
       const st = qState.get(q.id);
       if (!st) return;
       if (q.type === "fill") {
          earned += scoreFill(q, st.fillText);
       } else {
          earned += scoreMcq(q, new Set(st.selectedOptionIds));
       }
    }

    questions.forEach(processQ);

    const minScore = exam.min_score ?? 200;
    const totalPoints = (exam.total_points ?? rawTotal) || 600;
    const earnedPoints = Math.max(0, Math.min(totalPoints, earned));

    const score = Math.max(minScore, Math.min(800, minScore + earnedPoints));
    const percent = totalPoints ? (earnedPoints / totalPoints) * 100 : 0;
    
    // We'll calculate 'passed' in onSubmit using both score and accuracy for consistency
    return {
      score,
      percent,
      earnedPoints,
      totalPoints,
    };
  }

  function computeQuestionCorrectness() {
    let correct = 0;
    let totalQs = 0;
    const incorrectQuestionIds: string[] = [];

    function checkQ(q: Question) {
       if (q.type === 'reference_block') {
          if (q.sub_questions) q.sub_questions.forEach(checkQ);
          return;
       }
       totalQs += 1;
       const st = qState.get(q.id);
       if (!st) {
          incorrectQuestionIds.push(q.id);
          return;
       }
       let isCorrect = false;
       if (q.type === "fill") {
          isCorrect = scoreFill(q, st.fillText) === q.points;
       } else {
          isCorrect = scoreMcq(q, new Set(st.selectedOptionIds)) === q.points;
       }
       if (isCorrect) correct += 1;
       else incorrectQuestionIds.push(q.id);
    }

    questions.forEach(checkQ);
    const percent = totalQs ? (correct / totalQs) * 100 : 0;
    return { correct, total: totalQs, percent, incorrectQuestionIds };
  }

  async function onSubmit(auto: boolean) {
    if (submitting) return;
    if (result) return;
    if (!started) return;

    setSubmitting(true);
    setError(null);
    try {
      const user = await requireAuth();
      if (!user) return;

      const durationSeconds =
        startedAtRef.current ? Math.min(exam.duration_seconds, Math.floor((Date.now() - startedAtRef.current) / 1000)) : 0;

      const computed = computeScore();
      const correctness = computeQuestionCorrectness();
      const answers = buildAnswersPayload();

      // Performance Analysis (Recursive)
      const subtopicsMap = new Map<string, { correct: number; total: number }>();
      function analyze(qs: Question[]) {
         for (const q of qs) {
            if (q.type === 'reference_block') {
               if (q.sub_questions) analyze(q.sub_questions);
               continue;
            }
            const sid = q.subtopic_id || "none";
            const cur = subtopicsMap.get(sid) ?? { correct: 0, total: 0 };
            cur.total += 1;
            
            const st = qState.get(q.id);
            let isCorrect = false;
            if (st) {
               if (q.type === "fill") {
                  isCorrect = scoreFill(q, st.fillText) === q.points;
               } else {
                  isCorrect = scoreMcq(q, new Set(st.selectedOptionIds)) === q.points;
               }
            }
            if (isCorrect) cur.correct += 1;
            subtopicsMap.set(sid, cur);
         }
      }
      analyze(questions);

      // Group subtopics into topics
      const topicsGroupMap = new Map<string, { correct: number; total: number; subtopics: any[] }>();
      subtopicsMap.forEach((stats, sid) => {
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

      const topicResults = Array.from(topicsGroupMap.entries()).map(([topicId, stats]) => {
        return {
          topicId,
          title: topicsById.get(topicId) ?? (topicId === 'none' ? 'General' : 'Other'),
          correct: stats.correct,
          total: stats.total,
          percent: Math.round((stats.correct / stats.total) * 100),
          subtopicResults: stats.subtopics.sort((a, b) => a.title.localeCompare(b.title))
        };
      }).sort((a, b) => a.title.localeCompare(b.title));

      const { data, error: insErr } = await supabase
        .from("exam_attempts")
        .insert({
          user_id: user.id,
          exam_id: exam.id,
          score: computed.score,
          duration_seconds: durationSeconds,
          earned_points: computed.earnedPoints,
          total_points: computed.totalPoints,
          percent_correct: computed.percent,
          answers,
        })
        .select("id")
        .single<{ id: string }>();

      if (insErr) throw insErr;

      // Add to mistake bank silently
      if (correctness.incorrectQuestionIds.length > 0) {
        supabase.rpc('record_mistakes', {
          p_user_id: user.id,
          p_question_ids: correctness.incorrectQuestionIds
        }).then(({ error: rpcError }) => {
          if (rpcError) console.error("Mistake bank record error:", rpcError);
        });
      }

      const passed = correctness.percent >= exam.pass_percent && computed.score >= exam.min_score;

      setResult({
        attemptId: data.id,
        score: computed.score,
        percent: computed.percent,
        passed,
        earnedPoints: computed.earnedPoints,
        totalPoints: computed.totalPoints,
        correctQuestions: correctness.correct,
        totalQuestions: correctness.total,
        questionsPercent: correctness.percent,
        durationSeconds,
        topicResults,
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
    if (!exam.is_free && !accessAllowed) return;
    setStarted(true);
    setRemaining(exam.duration_seconds);
    setTab("test");
    setCurrentIndex(0);
    const startedAt = Date.now();
    startedAtRef.current = startedAt;
    const map = new Map<string, string[]>();
    for (const q of questions) {
      const ids = q.options.map((o) => o.id);
      const seed = hashString(`${q.id}:${startedAt}`);
      map.set(q.id, shuffleWithSeed(ids, seed));
    }
    setOptionOrder(map);
  }

  const breadcrumbs = useMemo(
    () => [
      { label: "Home", href: "/" },
      { label: subjectTitle, href: `/subjects/${subjectSlug}` },
      { label: "Exams", href: `/subjects/${subjectSlug}?focus=exams` },
      { label: `Exam ${examNumber}` },
    ],
    [examNumber, subjectSlug, subjectTitle],
  );

  const subjectNavTitle = useMemo(() => {
    const t = subjectTitle.trim();
    const track = (subjectTrack ?? "").trim();
    return track ? `${t} • ${track}` : t;
  }, [subjectTitle, subjectTrack]);

  const checkingAccess = !exam.is_free && !accessChecked;
  const showPaywall = !exam.is_free && accessChecked && !accessAllowed;
  const showNoQuestions = accessChecked && accessAllowed && !contentLoading && questions.length === 0;

  async function goToCheckout() {
    if (!selectedOffer) return;
    const user = await requireAuth();
    if (!user) return;
    await supabase.from("cart_items").upsert(
      { user_id: user.id, subject_offer_id: selectedOffer.id, quantity: 1 },
      { onConflict: "user_id,subject_offer_id" },
    );
    router.push(`/checkout?offer=${selectedOffer.id}`);
  }

  /* ── Timer urgency color ── */
  const timerUrgent = remaining <= 60;
  const timerWarn = remaining <= 300 && !timerUrgent;

  if (showNoQuestions) {
    return (
      <div className="bg-slate-50 border-2 border-outline/30 rounded-2xl p-10 text-on-surface-variant font-medium text-center">
        <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 block mb-3">quiz</span>
        No questions yet for this exam. Add questions in Supabase and refresh.
      </div>
    );
  }

  return (
    <div className="relative bg-white border-2 border-outline/30 rounded-2xl shadow-soft-xl overflow-hidden">
      {/* ── Checking access modal ── */}
      {(checkingAccess || contentLoading) ? (
        <LoadingAnimation fullScreen variant="portal" />
      ) : null}

      {/* ── Submitting loader ── */}
      {submitting ? (
        <LoadingAnimation fullScreen variant="result" />
      ) : null}

      {/* ── Paywall modal (ALL ENGLISH) ── */}
      {showPaywall ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white border-2 border-outline/30 rounded-2xl shadow-2xl p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                <span className="material-symbols-outlined text-amber-600 text-xl">lock</span>
              </div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant">
                Locked
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-primary mt-3 tracking-tight">
              This exam is for subscribers only
            </div>
            <div className="mt-4 text-on-surface-variant font-medium leading-relaxed text-sm sm:text-base">
              You don&apos;t have an active subscription for <span className="font-extrabold text-primary">{subjectTitle}</span>. Subscribe to unlock this exam.
            </div>
            {offers.length > 1 ? (
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {offers.map((offer) => {
                  const active = offer.id === selectedOfferId;
                  return (
                    <button
                      key={offer.id}
                      type="button"
                      onClick={() => setSelectedOfferId(offer.id)}
                      className={
                        active
                          ? "text-left bg-primary/5 border-2 border-primary rounded-xl px-4 py-4 transition-all"
                          : "text-left bg-slate-50 border-2 border-outline/30 rounded-xl px-4 py-4 hover:bg-primary/5 hover:border-primary/30 transition-all"
                      }
                      aria-pressed={active}
                    >
                      <div className="text-sm font-extrabold text-primary">{offer.label}</div>
                      <div className="text-sm text-on-surface-variant font-medium mt-1">
                        {formatMoney(offer.price_cents, offer.currency)}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}
            {selectedOffer ? (
              <div className="mt-5 bg-primary/5 border-2 border-primary/10 rounded-xl p-4">
                <div className="text-sm font-extrabold text-primary">{selectedOffer.label}</div>
                <div className="text-sm text-on-surface-variant font-medium mt-1">
                  {formatMoney(selectedOffer.price_cents, selectedOffer.currency)} • Expires{" "}
                  {new Date(selectedOffer.expires_at).toLocaleDateString()}
                </div>
              </div>
            ) : (
              <div className="mt-5 bg-slate-50 border-2 border-outline/30 rounded-xl p-4 text-on-surface-variant font-medium">
                No purchase offers are currently available for this package.
              </div>
            )}
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              {sessionUserId ? null : (
                <button
                  type="button"
                  onClick={() => router.push("/join?mode=login")}
                  className="flex-1 bg-white text-primary border-2 border-outline/40 px-6 sm:px-10 py-3 sm:py-4 font-bold text-sm sm:text-base hover:bg-primary/5 transition-all rounded-xl"
                >
                  Sign in
                </button>
              )}
              <button
                type="button"
                disabled={!selectedOffer}
                onClick={goToCheckout}
                className="flex-1 bg-secondary text-white px-6 sm:px-10 py-3 sm:py-4 font-bold text-sm sm:text-base hover:bg-primary transition-all rounded-xl disabled:opacity-60"
              >
                Buy now
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex relative">
        {/* ── Side navigation — hidden on mobile, collapsible on desktop ── */}
        {navOpen ? (
          <aside
            className="hidden lg:block w-80 border-r border-outline/30 bg-gradient-to-b from-slate-50 to-white transition-all"
          >
            <div className="p-4 flex items-center justify-between gap-3 border-b border-outline/30">
              <div className="min-w-0">
                <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-secondary/10 border border-secondary/20 text-[10px] font-black tracking-[0.2em] uppercase text-secondary">
                  Package
                </div>
                <div className="mt-2">
                  <div className="inline-flex max-w-full px-3 py-2 bg-white border-2 border-outline/30 rounded-lg shadow-sm">
                    <div className="text-sm font-extrabold text-primary truncate">{subjectNavTitle}</div>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNavOpen(false)}
                className="h-10 w-10 flex items-center justify-center bg-white border-2 border-outline/30 rounded-lg hover:bg-primary/5 transition-all"
                aria-label="Collapse"
              >
                <span className="material-symbols-outlined text-[18px] text-primary">
                  chevron_left
                </span>
              </button>
            </div>

            <div className="p-3">
              <div className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Exams</div>
              <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
                {allExams.map((e) => {
                  const st = examStatus.get(e.id);
                  const isCurrent = e.exam_number === examNumber;
                  const passed = !!st?.passed;
                  const attempted = !!st?.attempted;
                  const dot = passed ? "bg-emerald-500" : attempted ? "bg-amber-500" : "bg-slate-300";
                  const row = isCurrent
                    ? "border-2 border-primary bg-primary/5 rounded-lg"
                    : "border-2 border-outline/20 bg-white hover:bg-primary/5 hover:border-primary/30 rounded-lg";

                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => router.push(`/subjects/${subjectSlug}/exams/${e.exam_number}`)}
                      className={`w-full text-left px-3 py-3 ${row} transition-all`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex items-center gap-3">
                          <span className={`h-2.5 w-2.5 rounded-full ${dot} flex-shrink-0`} />
                          <div className="min-w-0">
                            <div className="text-sm font-extrabold text-primary truncate">
                              Exam {e.exam_number}
                            </div>
                            <div className="text-xs text-on-surface-variant font-medium mt-1 truncate">
                              {e.title}
                            </div>
                          </div>
                        </div>
                        <span
                          className={
                            e.is_free
                              ? "px-2 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black tracking-[0.15em] uppercase rounded-md"
                              : "px-2 py-1 bg-slate-50 border border-slate-200 text-slate-600 text-[10px] font-black tracking-[0.15em] uppercase rounded-md"
                          }
                        >
                          {e.is_free ? "Free" : "Paid"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        ) : (
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            className="hidden lg:flex absolute left-0 top-4 z-20 h-10 w-10 items-center justify-center bg-white border-2 border-outline/30 rounded-r-lg shadow-md hover:bg-primary/5 transition-all"
            aria-label="Expand navigation"
          >
            <span className="material-symbols-outlined text-[18px] text-primary">
              chevron_right
            </span>
          </button>
        )}

        {/* ── Main content area ── */}
        <div className="flex-1 min-w-0 bg-white">
          {/* Header */}
          <div className="border-b border-outline/30 bg-gradient-to-r from-slate-50 to-white">
            <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 flex flex-col gap-3 sm:gap-4">
              <div className="flex items-center justify-between gap-4 sm:gap-6">
                <BackButton fallbackHref={`/subjects/${subjectSlug}?focus=exams`} />
                <Breadcrumbs items={breadcrumbs} />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.2em] font-black text-on-surface-variant">
                    Exam {examNumber}
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold text-primary mt-1 sm:mt-2 tracking-tight truncate">{exam.title}</div>
                  <div className="mt-3 sm:mt-4 flex flex-wrap gap-2">
                    <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-blue-50 border border-blue-200 text-[10px] sm:text-xs font-extrabold text-blue-700 rounded-lg">
                      <span className="material-symbols-outlined text-[14px] sm:text-[16px] text-blue-500">quiz</span>
                      {totalQuestionsCount} questions
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-indigo-50 border border-indigo-200 text-[10px] sm:text-xs font-extrabold text-indigo-700 rounded-lg">
                      <span className="material-symbols-outlined text-[14px] sm:text-[16px] text-indigo-500">timer</span>
                      {Math.round(exam.duration_seconds / 60)} min
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-purple-50 border border-purple-200 text-[10px] sm:text-xs font-extrabold text-purple-700 rounded-lg">
                      <span className="material-symbols-outlined text-[14px] sm:text-[16px] text-purple-500">repeat</span>
                      {typeof exam.max_attempts === "number"
                        ? `Max ${exam.max_attempts}`
                        : "Unlimited"}
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-amber-50 border border-amber-200 text-[10px] sm:text-xs font-extrabold text-amber-700 rounded-lg">
                      <span className="material-symbols-outlined text-[14px] sm:text-[16px] text-amber-500">task_alt</span>
                      Pass {exam.pass_percent}%
                    </div>
                    <div
                      className={
                        exam.is_free
                          ? "inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-emerald-50 border border-emerald-200 text-[10px] sm:text-xs font-extrabold text-emerald-700 rounded-lg"
                          : "inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-slate-100 border border-slate-300 text-[10px] sm:text-xs font-extrabold text-slate-600 rounded-lg"
                      }
                    >
                      <span className="material-symbols-outlined text-[14px] sm:text-[16px]">
                        {exam.is_free ? "lock_open" : "lock"}
                      </span>
                      {exam.is_free ? "Free" : "Paid"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {!started ? (
                    <button
                      type="button"
                      onClick={start}
                      disabled={contentLoading}
                      className="bg-secondary text-white px-5 sm:px-6 py-2.5 sm:py-3 font-bold text-sm hover:bg-primary transition-all rounded-xl active:scale-[0.97]"
                    >
                      Start test
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSubmit(false)}
                      disabled={submitting || !!result}
                      className="bg-secondary text-white px-5 sm:px-6 py-2.5 sm:py-3 font-bold text-sm hover:bg-primary transition-all rounded-xl disabled:opacity-60 active:scale-[0.97]"
                    >
                      Submit
                    </button>
                  )}
                </div>
              </div>

              {started ? (
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
                    ].join(" ")}>{secondsToClock(remaining)}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="h-2.5 bg-slate-100 border border-outline/30 overflow-hidden rounded-full">
                      <div
                        className="h-full bg-gradient-to-r from-secondary to-primary rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(0, Math.min(100, progressRatio * 100))}%` }}
                      />
                    </div>
                    <div className="mt-1.5 text-[10px] sm:text-xs text-on-surface-variant font-medium">
                      Answered {answeredCount}/{totalQuestionsCount}
                    </div>
                  </div>
                  <div className="flex bg-slate-100 p-1.5 rounded-xl border border-outline/30">
                    <button
                      type="button"
                      onClick={() => setTab("test")}
                      className={
                        tab === "test"
                          ? "bg-white text-primary px-4 sm:px-6 py-2 font-bold text-xs shadow-sm border border-outline/30 rounded-lg"
                          : "text-on-surface-variant px-4 sm:px-6 py-2 font-bold text-xs hover:text-primary transition-all rounded-lg"
                      }
                    >
                      Test
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab("reference")}
                      className={
                        tab === "reference"
                          ? "bg-white text-primary px-4 sm:px-6 py-2 font-bold text-xs shadow-sm border border-outline/30 rounded-lg"
                          : "text-on-surface-variant px-4 sm:px-6 py-2 font-bold text-xs hover:text-primary transition-all rounded-lg"
                      }
                    >
                      Reference
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 sm:px-6 py-3 sm:py-4 text-sm text-blue-700 font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-500 text-lg">info</span>
                  When you start, the timer begins immediately and the attempt will auto-submit when time is over.
                </div>
              )}
            </div>
          </div>

      {error ? (
        <div className="px-4 sm:px-8 py-3 sm:py-4 bg-rose-50 border-b border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-rose-500 text-lg">error</span>
          {error}
        </div>
      ) : null}

      {/* ── Result screen ── */}
      {result ? (
        <div className="p-4 sm:p-6 md:p-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10 items-start">
          <div className="lg:col-span-7">
            <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
              Result
            </div>
            <div className="font-headline text-4xl sm:text-5xl font-extrabold text-primary tracking-tighter">
              {result.score}/800
            </div>
            <div className="text-on-surface-variant text-base sm:text-lg font-medium mt-3">
              {result.correctQuestions}/{result.totalQuestions} correct •{" "}
              {Math.round(result.questionsPercent)}% •{" "}
              <span className={result.passed ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                {result.passed ? "Passed ✓" : "Not passed"}
              </span>
            </div>

            <div className="mt-8 sm:mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 sm:p-6">
                <div className="text-xs uppercase tracking-widest text-blue-600 font-bold">
                  Accuracy
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-blue-700 mt-2">
                  {Math.round(result.questionsPercent)}%
                </div>
              </div>
              <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-4 sm:p-6">
                <div className="text-xs uppercase tracking-widest text-indigo-600 font-bold">
                  Time
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-indigo-700 mt-2">
                  {secondsToClock(result.durationSeconds)}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-gradient-to-br from-slate-50 to-blue-50 border-2 border-outline/30 shadow-soft-xl rounded-2xl p-6 sm:p-8">
              <div className="text-xs font-bold text-primary uppercase tracking-widest mb-6">
                Score breakdown
              </div>
              <div className="flex items-center justify-center py-6 sm:py-8">
                {(() => {
                  const displayAttempt = pastAttempts[historyIndex];
                  const displayScore = displayAttempt?.score ?? result.score;
                  const scorePercent = (displayScore / 800) * 100;
                  return (
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative w-36 h-36 sm:w-44 sm:h-44">
                        <div
                          className="absolute inset-0 rounded-full"
                          style={{
                            background: `conic-gradient(#3e5e95 ${scorePercent}%, #e2e8f0 0)`,
                          }}
                        />
                        <div className="absolute inset-2 rounded-full bg-white" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <div className="text-2xl sm:text-3xl font-extrabold text-primary">
                            {displayScore}
                          </div>
                          <div className="text-[10px] sm:text-xs text-on-surface-variant font-bold uppercase tracking-widest mt-1">
                            / 800
                          </div>
                        </div>
                      </div>
                      {pastAttempts.length > 1 ? (
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            disabled={historyIndex >= pastAttempts.length - 1}
                            onClick={() => setHistoryIndex((i) => Math.min(pastAttempts.length - 1, i + 1))}
                            className="w-9 h-9 flex items-center justify-center bg-white border-2 border-outline/30 rounded-lg hover:bg-primary/5 transition-all disabled:opacity-30"
                            aria-label="Older attempt"
                          >
                            <span className="material-symbols-outlined text-[18px] text-primary">chevron_left</span>
                          </button>
                          <div className="text-xs text-on-surface-variant font-medium text-center min-w-[60px]">
                            {historyIndex === 0 ? "Latest" : `#${pastAttempts.length - historyIndex}`}
                          </div>
                          <button
                            type="button"
                            disabled={historyIndex <= 0}
                            onClick={() => setHistoryIndex((i) => Math.max(0, i - 1))}
                            className="w-9 h-9 flex items-center justify-center bg-white border-2 border-outline/30 rounded-lg hover:bg-primary/5 transition-all disabled:opacity-30"
                            aria-label="Newer attempt"
                          >
                            <span className="material-symbols-outlined text-[18px] text-primary">chevron_right</span>
                          </button>
                        </div>
                      ) : null}
                      <div className="text-[10px] text-on-surface-variant font-medium">
                        {displayAttempt ? new Date(displayAttempt.submitted_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : ""}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
          </div>

          {/* Topic Performance Analysis */}
          {result.topicResults && result.topicResults.length > 0 && (
            <div className="mt-12 bg-white border border-outline/30 shadow-sm rounded-xl overflow-hidden animate-slide-up">
              <div className="p-6 sm:p-8 border-b border-outline/20 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-[20px]">analytics</span>
                  <h3 className="text-xs font-black uppercase tracking-widest text-primary">Performance Analysis</h3>
                </div>
                <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.2em] opacity-60">
                   Detailed Breakdown
                </div>
              </div>
              <div className="p-4 sm:p-8">
                <div className="flex flex-col gap-4">
                  {result.topicResults.map((tr) => (
                    <div key={tr.topicId} className="group bg-white border border-outline/20 rounded-lg overflow-hidden transition-all hover:border-primary/30 hover:shadow-sm">
                      <div className="p-4 flex items-center justify-between cursor-pointer select-none no-tap-highlight" onClick={(e) => {
                        const content = e.currentTarget.nextElementSibling;
                        if (content) content.classList.toggle('hidden');
                        const icon = e.currentTarget.querySelector('.expand-icon');
                        if (icon) icon.classList.toggle('rotate-180');
                      }}>
                        <div className="flex items-center gap-5">
                          <div className={`w-14 h-14 rounded-md flex flex-col items-center justify-center transition-all ${tr.percent >= 75 ? 'bg-emerald-50 text-emerald-700' : tr.percent >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
                            <span className="text-lg font-black leading-none">{tr.percent}%</span>
                            <span className="text-[8px] font-bold uppercase tracking-tighter mt-1 opacity-70">Accuracy</span>
                          </div>
                          <div>
                            <div className="text-[13px] font-black text-primary uppercase tracking-wide group-hover:text-secondary transition-colors">{tr.title}</div>
                            <div className="flex items-center gap-2 mt-1.5">
                               <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className={`h-full ${tr.percent >= 75 ? 'bg-emerald-500' : tr.percent >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${tr.percent}%` }} />
                               </div>
                               <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase">{tr.correct}/{tr.total} Items</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                           <span className="expand-icon material-symbols-outlined text-[20px] text-slate-300 transition-transform duration-300">expand_more</span>
                        </div>
                      </div>
                      
                      <div className="hidden border-t border-outline/10 bg-slate-50/30 p-5 animate-slide-up">
                        <div className="space-y-5">
                          <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3 flex items-center gap-2">
                             <div className="w-4 h-[1px] bg-slate-200"></div> Subtopics
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-5">
                            {tr.subtopicResults.map(st => (
                              <div key={st.subtopicId} className="flex flex-col gap-2">
                                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-tight">
                                  <span className="text-primary/70">{st.title}</span>
                                  <span className={`flex items-center gap-1.5 ${st.percent >= 75 ? 'text-emerald-600' : st.percent >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                                    {st.percent}%
                                    <span className="text-[9px] opacity-40">({st.correct}/{st.total})</span>
                                  </span>
                                </div>
                                <div className="h-1 bg-slate-200/50 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full transition-all duration-700 rounded-full ${st.percent >= 75 ? 'bg-emerald-400' : st.percent >= 50 ? 'bg-amber-400' : 'bg-rose-400'}`}
                                    style={{ width: `${st.percent}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-8 py-5 bg-slate-50/80 border-t border-outline/30 flex items-center gap-3">
                <span className="material-symbols-outlined text-blue-500 text-sm">info</span>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest leading-relaxed">
                  Use this analysis to focus your practice on topics where your accuracy is lower.
                </p>
              </div>
            </div>
          )}

          {/* Review overview grid */}
          <div className="mt-8 sm:mt-10 px-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-6 mb-4">
              <div className="text-xs font-bold text-primary uppercase tracking-widest">Review Overview</div>
              <div className="flex flex-wrap gap-3 sm:gap-4 text-[10px] sm:text-xs text-on-surface-variant font-medium">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-emerald-400 bg-emerald-50 rounded-sm" />
                  Correct
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-rose-400 bg-rose-50 rounded-sm" />
                  Wrong
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-outline/40 bg-slate-100 rounded-sm" />
                  Unanswered
                </div>
              </div>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 lg:grid-cols-16 xl:grid-cols-20 gap-1.5 sm:gap-2">
              {(() => {
                const allReviewQs: { id: string; num: number; type: string; isCorrect: boolean; hasAnswer: boolean }[] = [];
                function gatherReview(qs: Question[]) {
                   for (const q of qs) {
                      if (q.type === 'reference_block') {
                         if (q.sub_questions) gatherReview(q.sub_questions);
                         continue;
                      }
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
                      allReviewQs.push({ id: q.id, num: q.question_number, type: q.type, isCorrect, hasAnswer });
                   }
                }
                gatherReview(questions);
                return allReviewQs.map((item, idx) => {
                  const border = !item.hasAnswer ? "border-outline/40" : item.isCorrect ? "border-emerald-400" : "border-rose-400";
                  const bg = !item.hasAnswer ? "bg-slate-100" : item.isCorrect ? "bg-emerald-50" : "bg-rose-50";
                  return (
                    <button 
                      key={item.id} 
                      type="button"
                      onClick={() => {
                        const el = document.getElementById(`rev-q-${item.id}`);
                        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                      className={`h-8 sm:h-10 border-2 ${border} ${bg} font-bold text-xs sm:text-sm text-primary flex items-center justify-center rounded-lg hover:brightness-95 transition-all outline-none`}
                    >
                      {idx + 1}
                    </button>
                  );
                });
              })()}
            </div>
          </div>

          {/* Review section */}
          <div className="mt-8 sm:mt-12">
            <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
              Review
            </div>
            <div className="space-y-6 sm:space-y-8">
              {questions.map((q) => {
                 const renderReviewSingle = (reviewQ: Question, isSub = false) => {
                    const st = qState.get(reviewQ.id);
                    const selected = new Set(st?.selectedOptionIds ?? []);
                    const fill = (st?.fillText ?? "").trim();
                    const correctFill = (reviewQ.correct_text ?? "").trim();
                    const correctOptionIds = new Set(reviewQ.options.filter((o) => o.is_correct).map((o) => o.id));
                    const hasAnswer = reviewQ.type === "fill" ? !!fill : selected.size > 0;
                    const isCorrect = reviewQ.type === "fill" 
                       ? normalizeText(fill) === normalizeText(correctFill) && !!correctFill
                       : (() => {
                           if (selected.size === 0) return false;
                           if (reviewQ.allow_multiple) {
                              if (selected.size !== correctOptionIds.size) return false;
                              for (const id of selected) if (!correctOptionIds.has(id)) return false;
                              return true;
                           }
                           return selected.size === 1 && correctOptionIds.has(Array.from(selected)[0]);
                       })();

                    return (
                       <div id={`rev-q-${reviewQ.id}`} key={reviewQ.id} className={`${isSub ? 'border-l-4 border-primary/10 pl-6 py-6' : 'bg-white border-2 border-outline/30 shadow-sm rounded-2xl overflow-hidden'}`}>
                          {!isSub && (
                             <div className="p-4 sm:p-6 border-b border-outline/30 flex items-start justify-between gap-4 sm:gap-6 bg-slate-50">
                                <div className="text-xs font-bold text-primary uppercase tracking-widest">Question {reviewQ.question_number}</div>
                                <div className="flex gap-2">
                                   {!hasAnswer ? (
                                      <span className="px-3 py-1 bg-slate-200 text-slate-700 text-[10px] font-black tracking-[0.15em] uppercase rounded-lg">Unanswered</span>
                                   ) : isCorrect ? (
                                      <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black tracking-[0.15em] uppercase rounded-lg">Correct</span>
                                   ) : (
                                      <span className="px-3 py-1 bg-rose-100 text-rose-700 text-[10px] font-black tracking-[0.15em] uppercase rounded-lg">Wrong</span>
                                   )}
                                </div>
                             </div>
                          )}

                          <div className={`p-4 sm:p-6 space-y-6 ${!isSub ? '' : 'pt-0'}`}>
                             {isSub && (
                                <div className="flex items-center justify-between mb-4">
                                   <div className="text-[10px] font-black uppercase tracking-widest text-primary/40">Sub-Question Item</div>
                                    <div className="flex gap-2">
                                       {!hasAnswer ? (
                                          <span className="px-2 py-1 bg-slate-100 text-slate-500 text-[9px] font-black tracking-[0.15em] uppercase rounded-md">Unanswered</span>
                                       ) : isCorrect ? (
                                          <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[9px] font-black tracking-[0.15em] uppercase rounded-md">Correct</span>
                                       ) : (
                                          <span className="px-2 py-1 bg-rose-50 text-rose-600 text-[9px] font-black tracking-[0.15em] uppercase rounded-md">Wrong</span>
                                       )}
                                    </div>
                                </div>
                             )}

                             {reviewQ.prompt_text && (
                                <div className="text-on-surface font-medium leading-relaxed text-sm sm:text-base">
                                   <MathText text={reviewQ.prompt_text} />
                                </div>
                             )}

                             {reviewQ.prompt_assets.map(a => {
                                const url = assetUrl(a);
                                return url ? <img key={a.id} src={url} className="max-w-full h-auto rounded-xl border border-outline/20 mx-auto" alt="Prompt Asset" /> : null;
                             })}

                             {reviewQ.type === 'fill' ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                   <div className="bg-slate-50 p-4 rounded-xl border-2 border-outline/10">
                                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Your Answer</div>
                                      <div className="text-sm font-bold text-primary">{fill || '—'}</div>
                                   </div>
                                   <div className="bg-emerald-50 p-4 rounded-xl border-2 border-emerald-100">
                                      <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Correct Answer</div>
                                      <div className="text-sm font-bold text-emerald-700">{correctFill}</div>
                                   </div>
                                </div>
                             ) : (
                                <div className="space-y-2">
                                   {reviewQ.options.map(opt => {
                                      const isSelected = selected.has(opt.id);
                                      const isCorrectOpt = opt.is_correct;
                                      const border = isCorrectOpt ? 'border-emerald-400' : isSelected ? 'border-rose-400' : 'border-outline/30';
                                      const bg = isCorrectOpt ? 'bg-emerald-50' : isSelected ? 'bg-rose-50' : 'bg-slate-50';
                                      return (
                                         <div key={opt.id} className={`border-2 ${border} ${bg} px-4 py-3 rounded-xl flex items-center justify-between`}>
                                            <div className="text-sm font-bold text-primary flex-1">
                                               <MathText text={opt.text ?? `Option ${opt.option_number}`} />
                                            </div>
                                            <div className="flex gap-2">
                                               {isSelected && <span className="px-2 py-0.5 bg-primary/10 text-primary text-[9px] font-black uppercase rounded">Your Choice</span>}
                                               {isCorrectOpt && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase rounded">Correct</span>}
                                            </div>
                                         </div>
                                      );
                                   })}
                                </div>
                             )}

                             {(reviewQ.explanation_text || reviewQ.explanation_assets.length > 0) && (
                                <div className="mt-8 p-6 bg-blue-50 rounded-2xl border-2 border-blue-100/50">
                                   <div className="flex items-center gap-2 mb-4 text-blue-700">
                                      <span className="material-symbols-outlined text-sm">lightbulb</span>
                                      <span className="text-[10px] font-black uppercase tracking-widest">Explanation</span>
                                   </div>
                                   {reviewQ.explanation_text && <div className="text-sm font-medium text-blue-900 mb-4"><MathText text={reviewQ.explanation_text} /></div>}
                                   <div className="flex flex-col gap-4">
                                      {reviewQ.explanation_assets.map(a => {
                                         const url = assetUrl(a);
                                         return url ? <img key={a.id} src={url} className="max-w-full h-auto rounded-xl" alt="Explanation Asset" /> : null;
                                      })}
                                   </div>
                                </div>
                             )}
                          </div>
                       </div>
                    );
                 }

                 const passage = q.passage_id ? passagesById.get(q.passage_id) : null;
                 const isReference = passage?.kind === "reference";

                 const reviewBody = q.type === 'reference_block' ? (
                    <div id={`rev-q-${q.id}`} key={q.id} className="space-y-10">
                       <div className="bg-white border-2 border-outline/30 shadow-sm rounded-3xl overflow-hidden p-6 sm:p-10">
                          <div className="text-[10px] font-black text-primary/40 uppercase tracking-[0.3em] mb-4">Reference Block {q.question_number}</div>
                          <div className="text-sm sm:text-lg text-on-surface leading-relaxed font-medium">
                             <MathText text={q.prompt_text ?? ""} />
                          </div>
                          {q.prompt_assets.map(a => {
                             const url = assetUrl(a);
                             return url ? <img key={a.id} src={url} className="mt-6 max-w-full h-auto rounded-xl border border-outline/20" alt="Block Prompt" /> : null;
                          })}
                       </div>
                       <div className="space-y-12">
                          {q.sub_questions?.map(sub => renderReviewSingle(sub, true))}
                       </div>
                    </div>
                 ) : renderReviewSingle(q);

                 if (!passage) return reviewBody;

                 const revPassagePanel = (
                   <div key={`p-${passage.id}`} className={`border-2 ${isReference ? 'border-sky-200 bg-gradient-to-br from-sky-50 to-white' : 'border-violet-200 bg-gradient-to-br from-violet-50 to-white'} rounded-2xl overflow-hidden flex flex-col`}>
                     <div className={`px-4 py-3 ${isReference ? 'bg-sky-100/60 border-b border-sky-200' : 'bg-violet-100/60 border-b border-violet-200'} flex items-center gap-2`}>
                       <span className={`material-symbols-outlined ${isReference ? 'text-sky-600' : 'text-violet-600'} text-lg`}>
                         {isReference ? 'view_cozy' : 'menu_book'}
                       </span>
                       <div className={`text-xs font-black uppercase tracking-[0.15em] ${isReference ? 'text-sky-700' : 'text-violet-700'}`}>
                         {isReference ? 'Reference Block' : 'Passage'}
                       </div>
                       {passage.title ? (
                         <div className={`ml-2 text-sm font-extrabold ${isReference ? 'text-sky-900' : 'text-violet-900'} truncate`}>{passage.title}</div>
                       ) : null}
                     </div>
                     <div
                       className={`p-4 sm:p-6 prose prose-sm max-w-none text-on-surface leading-relaxed break-words [&_img]:mx-auto [&_img]:max-w-full [&_img]:h-auto [&_table]:mx-auto [&_table]:max-w-full [&_table]:w-auto [&_pre]:whitespace-pre-wrap ${isReference ? 'overflow-visible' : 'overflow-y-auto lg:max-h-[65vh] max-h-[40vh]'}`}
                       dangerouslySetInnerHTML={{ __html: passage.body_html }}
                     />
                   </div>
                 );

                 return (
                    <div key={`rev-container-${q.id}`}>
                       <div className="lg:hidden space-y-6">
                          {revPassagePanel}
                          {reviewBody}
                       </div>
                       <div className="hidden lg:grid lg:grid-cols-12 gap-8">
                          <div className="lg:col-span-5">{revPassagePanel}</div>
                          <div className="lg:col-span-7">{reviewBody}</div>
                       </div>
                    </div>
                 );
              })}
            </div>
          </div>

          {/* Action buttons at the very bottom */}
          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              type="button"
              className="bg-secondary text-white px-6 sm:px-8 py-3 sm:py-4 font-bold text-sm sm:text-base hover:bg-primary transition-all rounded-xl active:scale-[0.97]"
              onClick={() => {
                setResult(null);
                setError(null);
                setSubmitting(false);
                setQState(buildInitialQState(questions));
                setCurrentIndex(0);
                setTab("test");
                start();
              }}
            >
              Retake exam
            </button>
            <button
              type="button"
              className="bg-primary text-white px-6 sm:px-8 py-3 sm:py-4 font-bold text-sm sm:text-base hover:bg-slate-800 transition-all rounded-xl active:scale-[0.97]"
              onClick={() => router.push("/profile")}
            >
              Go to profile
            </button>
            <button
              type="button"
              className="bg-white text-primary border-2 border-outline/40 px-6 sm:px-8 py-3 sm:py-4 font-bold text-sm sm:text-base hover:bg-primary/5 transition-all rounded-xl active:scale-[0.97]"
              onClick={() => router.push(`/subjects/${subjectSlug}`)}
            >
              Back to subject
            </button>
          </div>
        </div>
      ) : started ? (
        tab === "reference" ? (
          <div className="p-4 sm:p-6 md:p-10">
            <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
              Reference sheet
            </div>
            {referenceSheets.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {referenceSheets.map((a) => {
                  const url = assetUrl(a);
                  return (
                    <div
                      key={a.id}
                      className="border-2 border-outline/30 bg-slate-50 overflow-hidden rounded-xl"
                    >
                      {url ? (
                        <img src={url} alt="Reference sheet" className="w-full h-auto" />
                      ) : (
                        <div className="h-64" />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="border-2 border-outline/30 bg-slate-50 px-6 py-10 text-on-surface-variant font-medium rounded-xl text-center">
                No reference sheet uploaded yet.
              </div>
            )}
          </div>
        ) : (
          <div>
            {/* Overview grid */}
            <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 border-b border-outline/30 bg-gradient-to-r from-slate-50 to-white">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-6">
                <div className="text-xs font-bold text-primary uppercase tracking-widest">Overview</div>
                <div className="flex flex-wrap gap-3 sm:gap-4 text-[10px] sm:text-xs text-on-surface-variant font-medium">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-outline/40 bg-slate-100 rounded-sm" />
                    Unseen
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-emerald-400 bg-emerald-50 rounded-sm" />
                    Answered
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-amber-400 bg-amber-50 rounded-sm" />
                    Marked
                  </div>
                </div>
              </div>

              <div className="mt-4 sm:mt-5 grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 lg:grid-cols-16 xl:grid-cols-20 gap-1.5 sm:gap-2">
                {overview.map(({ q, seen, answered, marked }, idx) => {
                  const isCurrent = idx === currentIndex;
                  const border = marked
                    ? "border-amber-400"
                    : answered
                      ? "border-emerald-400"
                      : "border-outline/40";
                  const bg = marked
                    ? "bg-amber-50"
                    : answered
                      ? "bg-emerald-50"
                      : "bg-slate-100";
                  const currentRing = isCurrent ? "ring-2 ring-primary/30" : "";
                  return (
                    <button
                      key={`${q.id}-${idx}`}
                      type="button"
                      onClick={() => {
                        setCurrentIndex(idx);
                        setTimeout(() => {
                          const el = document.getElementById(`q-item-${q.id}`);
                          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                          else questionTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }, 100);
                      }}
                      className={`h-8 sm:h-10 border-2 ${border} ${bg} ${currentRing} font-bold text-xs sm:text-sm text-primary hover:brightness-[0.96] transition-all rounded-lg`}
                      aria-label={`Question ${idx + 1}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Current question */}
            <div className="p-4 sm:p-6 md:p-10">
              {currentQuestion ? (
                <>
                  <div ref={questionTopRef} className="flex items-start justify-between gap-4 sm:gap-6">
                    <div>
                      <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-3 sm:mb-4">
                        Question {currentIndex + 1} of {totalQuestionsCount}
                      </div>
                    </div>
                    {currentQuestion.type !== 'reference_block' && (
                       <button
                         type="button"
                         onClick={() => {
                           setQState((prev) => {
                             const next = new Map(prev);
                             const st = next.get(currentQuestion.id);
                             if (!st) return prev;
                             next.set(currentQuestion.id, { ...st, marked: !st.marked });
                             return next;
                           });
                         }}
                         className={[
                           "px-3 sm:px-5 py-2 sm:py-2.5 font-bold text-xs transition-all rounded-xl flex items-center gap-1.5 flex-shrink-0 active:scale-[0.97]",
                           qState.get(currentQuestion.id)?.marked
                             ? "bg-amber-50 text-amber-700 border-2 border-amber-300"
                             : "bg-white text-primary border-2 border-outline/40 hover:bg-primary/5",
                         ].join(" ")}
                       >
                         <span className="material-symbols-outlined text-[18px]">flag</span>
                         {qState.get(currentQuestion.id)?.marked ? "Marked" : "Mark"}
                       </button>
                    )}
                  </div>
                  <div key={currentIndex} className="animate-question-slide">
                  {(() => {
                    const passage = currentQuestion.passage_id ? passagesById.get(currentQuestion.passage_id) : null;
                    const isReference = passage?.kind === "reference";

                    const renderSingleQuestion = (q: Question, isSub = false) => {
                       const st = qState.get(q.id);
                       const selected = new Set(st?.selectedOptionIds ?? []);
                       const order = optionOrder.get(q.id);
                       const byId = new Map(q.options.map((o) => [o.id, o]));
                       const ordered = (order ?? []).map((id) => byId.get(id)).filter((o): o is Option => !!o);
                       const seen = new Set(ordered.map((o) => o.id));
                       const leftovers = q.options.filter((o) => !seen.has(o.id));
                       const list = [...ordered, ...leftovers];

                       return (
                          <div id={`q-item-${q.id}`} key={q.id} className={`${isSub ? 'border-l-4 border-primary/20 pl-4 sm:pl-6 py-4' : 'bg-gradient-to-br from-white to-slate-50 border-2 border-outline/30 shadow-sm rounded-2xl p-4 sm:p-6 md:p-8'}`}>
                             {isSub && (
                                <div className="flex items-center justify-between mb-4">
                                   <div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">Question Item</div>
                                   <button
                                     type="button"
                                     onClick={() => {
                                       setQState((prev) => {
                                         const next = new Map(prev);
                                         const st = next.get(q.id);
                                         if (!st) return prev;
                                         next.set(q.id, { ...st, marked: !st.marked });
                                         return next;
                                       });
                                     }}
                                     className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${st?.marked ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-400 hover:text-primary"}`}
                                   >
                                      <span className="material-symbols-outlined text-[18px]">flag</span>
                                   </button>
                                </div>
                             )}

                             {q.prompt_text && (
                                <div className="text-base sm:text-lg text-on-surface leading-relaxed font-medium mb-6">
                                   <MathText text={q.prompt_text} />
                                </div>
                             )}

                             {q.prompt_assets.length > 0 && (
                                <div className="flex flex-col items-center gap-4 mb-6">
                                   {q.prompt_assets.map(a => {
                                      const url = assetUrl(a);
                                      return url ? <img key={a.id} src={url} className="max-w-full h-auto rounded-xl" alt="Asset" /> : null;
                                   })}
                                </div>
                             )}

                             {q.type === 'fill' ? (
                                <div className="border-2 border-outline/30 bg-white p-4 rounded-xl">
                                   <input
                                      value={st?.fillText ?? ""}
                                      onChange={(e) => {
                                         const v = e.target.value;
                                         setQState(prev => {
                                            const next = new Map(prev);
                                            const s = next.get(q.id);
                                            if (!s) return prev;
                                            next.set(q.id, { ...s, fillText: v });
                                            return next;
                                         });
                                      }}
                                      className="h-11 w-full px-4 outline-none font-bold"
                                      placeholder="Type your answer..."
                                   />
                                </div>
                             ) : (
                                <div className="space-y-3">
                                   {list.map(opt => {
                                      const isSelected = selected.has(opt.id);
                                      return (
                                         <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => {
                                               setQState(prev => {
                                                  const next = new Map(prev);
                                                  const s = next.get(q.id);
                                                  if (!s) return prev;
                                                  const nset = new Set(s.selectedOptionIds);
                                                  if (q.allow_multiple) {
                                                     if (nset.has(opt.id)) nset.delete(opt.id);
                                                     else nset.add(opt.id);
                                                  } else {
                                                     nset.clear();
                                                     nset.add(opt.id);
                                                  }
                                                  next.set(q.id, { ...s, selectedOptionIds: Array.from(nset) });
                                                  return next;
                                               });
                                            }}
                                            className={`w-full text-left border-2 px-4 py-3 sm:px-6 sm:py-4 rounded-xl transition-all ${isSelected ? 'border-primary bg-primary/5 text-primary' : 'border-outline/30 bg-white text-on-surface hover:bg-slate-50'}`}
                                         >
                                            <div className="flex items-start justify-between gap-4">
                                               <div className="text-sm font-extrabold flex-1">
                                                  <MathText text={opt.text ?? `Option ${opt.option_number}`} />
                                               </div>
                                               <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-primary bg-primary' : 'border-outline/40'}`}>
                                                  {isSelected && <span className="material-symbols-outlined text-white text-[14px]">check</span>}
                                               </div>
                                            </div>
                                            {opt.url && <img src={opt.url} className="mt-4 mx-auto max-w-full rounded-lg h-48 object-contain" alt="Option" />}
                                         </button>
                                      );
                                   })}
                                </div>
                             )}
                          </div>
                       );
                    };

                    const blockBody = currentQuestion.type === 'reference_block' ? (
                       <div className="space-y-10">
                          <div className="bg-white border-2 border-outline/30 shadow-sm rounded-2xl overflow-hidden p-6 sm:p-10">
                             <div className="text-base sm:text-xl text-on-surface leading-relaxed font-medium">
                                <MathText text={currentQuestion.prompt_text ?? ""} />
                             </div>
                             {currentQuestion.prompt_assets.length > 0 && (
                                <div className="mt-8 flex flex-col items-center gap-6">
                                   {currentQuestion.prompt_assets.map(a => {
                                      const url = assetUrl(a);
                                      return url ? <img key={a.id} src={url} className="max-w-2xl w-full h-auto rounded-2xl shadow-lg" alt="Block Asset" /> : null;
                                   })}
                                </div>
                             )}
                          </div>
                          
                          <div className="space-y-16 mt-12 pb-12">
                             {currentQuestion.sub_questions?.map((sub) => renderSingleQuestion(sub, true))}
                          </div>
                       </div>
                    ) : renderSingleQuestion(currentQuestion);

                    if (!passage) {
                       return <div className="mt-4 sm:mt-8">{blockBody}</div>;
                    }

                    const passagePanel = (
                      <div className={`border-2 ${isReference ? 'border-sky-200 bg-gradient-to-br from-sky-50 to-white' : 'border-violet-200 bg-gradient-to-br from-violet-50 to-white'} rounded-2xl overflow-hidden flex flex-col`}>
                        <div className={`px-4 py-3 ${isReference ? 'bg-sky-100/60 border-b border-sky-200' : 'bg-violet-100/60 border-b border-violet-200'} flex items-center gap-2`}>
                          <span className={`material-symbols-outlined ${isReference ? 'text-sky-600' : 'text-violet-600'} text-lg`}>
                            {isReference ? 'view_cozy' : 'menu_book'}
                          </span>
                          <div className={`text-xs font-black uppercase tracking-[0.15em] ${isReference ? 'text-sky-700' : 'text-violet-700'}`}>
                            {isReference ? 'Reference Block' : 'Passage'}
                          </div>
                          {passage.title ? (
                            <div className={`ml-2 text-sm font-extrabold ${isReference ? 'text-sky-900' : 'text-violet-900'} truncate`}>{passage.title}</div>
                          ) : null}
                        </div>
                        <div
                          className={`p-4 sm:p-6 prose prose-sm max-w-none text-on-surface leading-relaxed break-words [&_img]:mx-auto [&_img]:max-w-full [&_img]:h-auto [&_table]:mx-auto [&_table]:max-w-full [&_table]:w-auto [&_pre]:whitespace-pre-wrap ${isReference ? 'overflow-visible' : 'overflow-y-auto lg:max-h-[65vh] max-h-[40vh]'}`}
                          dangerouslySetInnerHTML={{ __html: passage.body_html }}
                        />
                      </div>
                    );

                    if (isReference) {
                      return (
                        <div className="mt-4 sm:mt-8 space-y-4 sm:space-y-6">
                          {passagePanel}
                          {blockBody}
                        </div>
                      );
                    }

                    return (
                      <div className="mt-4 sm:mt-8">
                        <div className="lg:hidden space-y-4">
                          {passagePanel}
                          {blockBody}
                        </div>
                        <div className="hidden lg:grid lg:grid-cols-2 gap-6">
                          {passagePanel}
                          {blockBody}
                        </div>
                      </div>
                    );
                  })()}
                  </div>

                  <div className="mt-6 sm:mt-10 flex items-center justify-between gap-3 sm:gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        const nextIndex = Math.max(0, currentIndex - 1);
                        setCurrentIndex(nextIndex);
                        const sameUnit = flatQuestions[nextIndex] && currentUnit && 
                          (currentUnit.id === flatQuestions[nextIndex].id || 
                           (currentUnit.sub_questions?.some(s => s.id === flatQuestions[nextIndex].id)));
                        
                        setTimeout(() => {
                           if (sameUnit) {
                              const el = document.getElementById(`q-item-${flatQuestions[nextIndex].id}`);
                              if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                           } else {
                              questionTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                           }
                        }, 50);
                      }}
                      disabled={currentIndex === 0}
                      className="bg-white text-primary border-2 border-outline/40 px-4 sm:px-8 py-3 sm:py-4 font-bold text-sm hover:bg-primary/5 transition-all rounded-xl disabled:opacity-50 active:scale-[0.97]"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (currentIndex === totalQuestionsCount - 1) {
                          onSubmit(false);
                        } else {
                          const nextIndex = Math.min(totalQuestionsCount - 1, currentIndex + 1);
                          setCurrentIndex(nextIndex);
                          const sameUnit = flatQuestions[nextIndex] && currentUnit && 
                            (currentUnit.id === flatQuestions[nextIndex].id || 
                             (currentUnit.sub_questions?.some(s => s.id === flatQuestions[nextIndex].id)));
                          
                          setTimeout(() => {
                             if (sameUnit) {
                                const el = document.getElementById(`q-item-${flatQuestions[nextIndex].id}`);
                                if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                             } else {
                                questionTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                             }
                          }, 50);
                        }
                      }}
                      disabled={submitting || !!result}
                      className="bg-primary text-white px-4 sm:px-8 py-3 sm:py-4 font-bold text-sm hover:bg-slate-800 transition-all rounded-xl disabled:opacity-50 active:scale-[0.97]"
                    >
                      {currentIndex === totalQuestionsCount - 1 ? "Submit" : "Next"}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )
      ) : (
        <div className="p-6 sm:p-10 text-center">
          <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-3">
            Ready
          </div>
          <div className="text-on-surface-variant font-medium text-sm sm:text-base mb-6">
            Press the button below to begin. The timer will start immediately.
          </div>
          <button
            type="button"
            onClick={start}
            disabled={contentLoading}
            className="bg-secondary text-white px-8 py-3.5 font-bold text-base hover:bg-primary transition-all rounded-xl active:scale-[0.97] disabled:opacity-60"
          >
            Start test
          </button>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
