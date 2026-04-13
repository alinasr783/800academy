"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import BackButton from "@/components/BackButton";
import Breadcrumbs from "@/components/Breadcrumbs";

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
};

function buildInitialQState(questions: Question[]) {
  const map = new Map<string, QuestionState>();
  for (const q of questions) {
    map.set(q.id, { seen: false, marked: false, selectedOptionIds: [], fillText: "" });
  }
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
  const [navOpen, setNavOpen] = useState(true);
  const [tab, setTab] = useState<"test" | "reference">("test");
  const [started, setStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [accessChecked, setAccessChecked] = useState(false);
  const [accessAllowed, setAccessAllowed] = useState(exam.is_free);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);

  const [contentLoading, setContentLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [referenceSheets, setReferenceSheets] = useState<Asset[]>([]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [remaining, setRemaining] = useState(exam.duration_seconds);
  const startedAtRef = useRef<number | null>(null);
  const [optionOrder, setOptionOrder] = useState<Map<string, string[]>>(new Map());
  const [examStatus, setExamStatus] = useState<Map<string, { attempted: boolean; passed: boolean }>>(
    new Map(),
  );

  const [qState, setQState] = useState<Map<string, QuestionState>>(new Map());

  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(offers[0]?.id ?? null);
  const selectedOffer = useMemo(() => {
    return offers.find((o) => o.id === selectedOfferId) ?? offers[0] ?? null;
  }, [offers, selectedOfferId]);

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

        const { data: qRows } = await supabase
          .from("exam_questions")
          .select(
            "id, question_number, type, prompt_text, explanation_text, points, allow_multiple, correct_text",
          )
          .eq("exam_id", exam.id)
          .order("question_number", { ascending: true })
          .returns<
            {
              id: string;
              question_number: number;
              type: "mcq" | "fill";
              prompt_text: string | null;
              explanation_text: string | null;
              points: number;
              allow_multiple: boolean;
              correct_text: string | null;
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

        const qs: Question[] = (qRows ?? []).map((q) => ({
          ...q,
          prompt_assets: promptAssetsByQ.get(q.id) ?? [],
          explanation_assets: explanationAssetsByQ.get(q.id) ?? [],
          options: optionsByQ.get(q.id) ?? [],
        }));

        if (!mounted) return;
        setReferenceSheets(sheetRows ?? []);
        setQuestions(qs);
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

    loadContent();
    return () => {
      mounted = false;
    };
  }, [accessAllowed, accessChecked, exam.id]);

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
    return exam.duration_seconds ? remaining / exam.duration_seconds : 0;
  }, [exam.duration_seconds, remaining]);

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
    for (const q of questions) {
      const st = qState.get(q.id);
      if (!st) continue;
      if (q.type === "fill") {
        payload[q.id] = { type: "fill", value: st.fillText };
      } else {
        payload[q.id] = { type: "mcq", selectedOptionIds: st.selectedOptionIds };
      }
    }
    return payload;
  }

  function computeScore() {
    let earned = 0;
    let total = 0;

    for (const q of questions) {
      total += q.points;
      const st = qState.get(q.id);
      if (!st) continue;
      if (q.type === "fill") {
        earned += scoreFill(q, st.fillText);
      } else {
        earned += scoreMcq(q, new Set(st.selectedOptionIds));
      }
    }

    const minScore = exam.min_score ?? 200;
    const totalPoints = (exam.total_points ?? total) || 600;
    const earnedPoints = Math.max(0, Math.min(totalPoints, earned));

    const score = Math.max(minScore, Math.min(800, minScore + earnedPoints));
    const percent = totalPoints ? (earnedPoints / totalPoints) * 100 : 0;
    const passed = percent >= exam.pass_percent;
    return {
      score,
      percent,
      passed,
      earnedPoints,
      totalPoints,
    };
  }

  function computeQuestionCorrectness() {
    let correct = 0;
    for (const q of questions) {
      const st = qState.get(q.id);
      if (!st) continue;

      if (q.type === "fill") {
        const expected = (q.correct_text ?? "").trim();
        const got = st.fillText.trim();
        if (expected && normalizeText(got) === normalizeText(expected)) correct += 1;
      } else {
        const selected = new Set(st.selectedOptionIds);
        const correctIds = new Set(q.options.filter((o) => o.is_correct).map((o) => o.id));
        if (selected.size === 0) continue;
        if (q.allow_multiple) {
          if (selected.size !== correctIds.size) continue;
          let ok = true;
          for (const id of selected) if (!correctIds.has(id)) ok = false;
          if (ok) correct += 1;
        } else {
          if (selected.size !== 1) continue;
          for (const id of selected) {
            if (correctIds.has(id)) correct += 1;
          }
        }
      }
    }
    const total = questions.length;
    const percent = total ? (correct / total) * 100 : 0;
    return { correct, total, percent };
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

      setResult({
        attemptId: data.id,
        score: computed.score,
        percent: computed.percent,
        passed: computed.passed,
        earnedPoints: computed.earnedPoints,
        totalPoints: computed.totalPoints,
        correctQuestions: correctness.correct,
        totalQuestions: correctness.total,
        questionsPercent: correctness.percent,
        durationSeconds,
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

  if (showNoQuestions) {
    return (
      <div className="bg-surface-variant border border-outline/40 p-10 text-on-surface-variant font-medium">
        No questions yet for this exam. Add questions in Supabase and refresh.
      </div>
    );
  }

  return (
    <div className="relative bg-surface-variant/20 border border-outline/60 shadow-soft-xl overflow-hidden">
      {checkingAccess ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40">
          <div className="w-full max-w-lg bg-white border border-outline/60 shadow-soft-xl p-8">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant">
              Checking access
            </div>
            <div className="text-2xl font-extrabold text-primary mt-3 tracking-tight">
              Please wait…
            </div>
          </div>
        </div>
      ) : null}

      {showPaywall ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40">
          <div className="w-full max-w-lg bg-white border border-outline/60 shadow-soft-xl p-8">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant">
              Locked
            </div>
            <div className="text-2xl font-extrabold text-primary mt-3 tracking-tight">
              الاختبار ده متاح للمشتركين فقط
            </div>
            <div className="mt-4 text-on-surface-variant font-medium leading-relaxed">
              أنت مش مشترك في باقة <span className="font-extrabold text-primary">{subjectTitle}</span>، اشترك علشان تقدر تشوف الاختبار ده.
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
                          ? "text-left bg-surface-variant border border-primary px-4 py-4 transition-all"
                          : "text-left bg-white border border-outline/60 px-4 py-4 hover:bg-surface-variant transition-all"
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
              <div className="mt-5 bg-surface-variant border border-outline/50 p-4">
                <div className="text-sm font-extrabold text-primary">{selectedOffer.label}</div>
                <div className="text-sm text-on-surface-variant font-medium mt-1">
                  {formatMoney(selectedOffer.price_cents, selectedOffer.currency)} • Expires{" "}
                  {new Date(selectedOffer.expires_at).toLocaleDateString()}
                </div>
              </div>
            ) : (
              <div className="mt-5 bg-surface-variant border border-outline/50 p-4 text-on-surface-variant font-medium">
                لا يوجد عرض شراء متاح حاليًا لهذه الباقة.
              </div>
            )}
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              {sessionUserId ? null : (
                <button
                  type="button"
                  onClick={() => router.push("/join?mode=login")}
                  className="flex-1 bg-white text-primary border border-outline px-10 py-4 font-bold text-base hover:bg-surface-variant transition-all rounded-full"
                >
                  تسجيل الدخول
                </button>
              )}
              <button
                type="button"
                disabled={!selectedOffer}
                onClick={goToCheckout}
                className="flex-1 bg-secondary text-white px-10 py-4 font-bold text-base hover:bg-primary transition-all rounded-full disabled:opacity-60"
              >
                اشتري الآن
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex">
        <aside
          className={
            navOpen
              ? "w-80 border-r border-outline/40 bg-surface-variant/30 transition-all"
              : "w-16 border-r border-outline/40 bg-surface-variant/30 transition-all"
          }
        >
          <div className="p-4 flex items-center justify-between gap-3 border-b border-outline/40">
            {navOpen ? (
              <div className="min-w-0">
                <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-secondary/10 border border-secondary/20 text-[10px] font-black tracking-[0.2em] uppercase text-secondary">
                  Package
                </div>
                <div className="mt-2">
                  <div className="inline-flex max-w-full px-3 py-2 bg-white border border-outline/60 shadow-sm">
                    <div className="text-sm font-extrabold text-primary truncate">{subjectNavTitle}</div>
                  </div>
                </div>
              </div>
            ) : (
              <span className="material-symbols-outlined text-secondary">menu</span>
            )}
            <button
              type="button"
              onClick={() => setNavOpen((v) => !v)}
              className="h-10 w-10 flex items-center justify-center bg-white border border-outline/60 hover:bg-surface-variant transition-all"
              aria-label={navOpen ? "Collapse" : "Expand"}
            >
              <span className="material-symbols-outlined text-[18px] text-primary">
                {navOpen ? "chevron_left" : "chevron_right"}
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
                  ? "border border-primary bg-white"
                  : "border border-outline/40 bg-surface-variant hover:bg-white";

                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => router.push(`/subjects/${subjectSlug}/exams/${e.exam_number}`)}
                    className={`w-full text-left px-3 py-3 ${row} transition-all`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex items-center gap-3">
                        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                        {navOpen ? (
                          <div className="min-w-0">
                            <div className="text-sm font-extrabold text-primary truncate">
                              Exam {e.exam_number}
                            </div>
                            <div className="text-xs text-on-surface-variant font-medium mt-1 truncate">
                              {e.title}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm font-extrabold text-primary">{e.exam_number}</div>
                        )}
                      </div>
                      {navOpen ? (
                        <span
                          className={
                            e.is_free
                              ? "px-2 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-black tracking-[0.2em] uppercase"
                              : "px-2 py-1 bg-slate-50 border border-slate-200 text-slate-800 text-[10px] font-black tracking-[0.2em] uppercase"
                          }
                        >
                          {e.is_free ? "Free" : "Paid"}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0 bg-surface-variant/10">
          <div className="border-b border-outline/40 bg-white">
            <div className="px-8 py-6 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-6">
                <BackButton fallbackHref={`/subjects/${subjectSlug}?focus=exams`} />
                <Breadcrumbs items={breadcrumbs} />
              </div>

              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] font-black text-on-surface-variant">
                    Exam {examNumber}
                  </div>
                  <div className="text-2xl font-extrabold text-primary mt-2 tracking-tight">{exam.title}</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-surface-variant border border-outline/40 text-xs font-extrabold text-primary">
                      <span className="material-symbols-outlined text-[16px] text-secondary">quiz</span>
                      {questions.length} questions
                    </div>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-surface-variant border border-outline/40 text-xs font-extrabold text-primary">
                      <span className="material-symbols-outlined text-[16px] text-secondary">timer</span>
                      Time {Math.round(exam.duration_seconds / 60)} min
                    </div>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-surface-variant border border-outline/40 text-xs font-extrabold text-primary">
                      <span className="material-symbols-outlined text-[16px] text-secondary">repeat</span>
                      {typeof exam.max_attempts === "number"
                        ? `Max attempts ${exam.max_attempts}`
                        : "Unlimited attempts"}
                    </div>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-surface-variant border border-outline/40 text-xs font-extrabold text-primary">
                      <span className="material-symbols-outlined text-[16px] text-secondary">task_alt</span>
                      Pass {exam.pass_percent}%
                    </div>
                    <div
                      className={
                        exam.is_free
                          ? "inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-xs font-extrabold text-emerald-800"
                          : "inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 text-xs font-extrabold text-slate-800"
                      }
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {exam.is_free ? "lock_open" : "lock"}
                      </span>
                      {exam.is_free ? "Free" : "Paid"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {!started ? (
                    <button
                      type="button"
                      onClick={start}
                      disabled={contentLoading}
                      className="bg-secondary text-white px-6 py-3 font-bold text-sm hover:bg-primary transition-all rounded-full"
                    >
                      Start test
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSubmit(false)}
                      disabled={submitting || !!result}
                      className="bg-secondary text-white px-6 py-3 font-bold text-sm hover:bg-primary transition-all rounded-full disabled:opacity-60"
                    >
                      Submit
                    </button>
                  )}
                </div>
              </div>

              {started ? (
                <div className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-2 bg-surface-variant border border-outline/40 px-4 py-3">
                    <span className="material-symbols-outlined text-secondary text-[18px]">timer</span>
                    <div className="text-sm font-extrabold text-primary">{secondsToClock(remaining)}</div>
                  </div>
                  <div className="flex-1">
                    <div className="h-2 bg-surface-variant border border-outline/40 overflow-hidden">
                      <div
                        className="h-full bg-secondary"
                        style={{ width: `${Math.max(0, Math.min(100, progressRatio * 100))}%` }}
                      />
                    </div>
                    <div className="mt-2 text-xs text-on-surface-variant font-medium">
                      Answered {answeredCount}/{questions.length}
                    </div>
                  </div>
                  <div className="flex bg-slate-50 p-2 border border-outline shadow-inner">
                    <button
                      type="button"
                      onClick={() => setTab("test")}
                      className={
                        tab === "test"
                          ? "bg-white text-primary px-6 py-2.5 font-bold text-xs shadow-sm border border-outline/50 btn-sharp"
                          : "text-on-surface-variant px-6 py-2.5 font-bold text-xs hover:text-primary transition-all"
                      }
                    >
                      Test
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab("reference")}
                      className={
                        tab === "reference"
                          ? "bg-white text-primary px-6 py-2.5 font-bold text-xs shadow-sm border border-outline/50 btn-sharp"
                          : "text-on-surface-variant px-6 py-2.5 font-bold text-xs hover:text-primary transition-all"
                      }
                    >
                      Reference sheet
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-surface-variant border border-outline/40 px-6 py-4 text-sm text-on-surface-variant font-medium">
                  When you start, the timer begins immediately and the attempt will auto-submit when time is over.
                </div>
              )}
            </div>
          </div>

      {error ? (
        <div className="px-8 py-4 bg-rose-50 border-b border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="p-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-7">
            <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
              Result
            </div>
            <div className="font-headline text-5xl font-extrabold text-primary tracking-tighter">
              {result.score}/800
            </div>
            <div className="text-on-surface-variant text-lg font-medium mt-3">
              {result.correctQuestions}/{result.totalQuestions} correct •{" "}
              {Math.round(result.questionsPercent)}% •{" "}
              {result.passed ? "Passed" : "Not passed"}
            </div>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-surface-variant border border-outline/40 p-6">
                <div className="text-xs uppercase tracking-widest text-on-surface-variant font-bold">
                  Score
                </div>
                <div className="text-3xl font-extrabold text-primary mt-2">
                  {result.earnedPoints}/{result.totalPoints}
                </div>
              </div>
              <div className="bg-surface-variant border border-outline/40 p-6">
                <div className="text-xs uppercase tracking-widest text-on-surface-variant font-bold">
                  Time
                </div>
                <div className="text-3xl font-extrabold text-primary mt-2">
                  {secondsToClock(result.durationSeconds)}
                </div>
              </div>
              <div className="bg-surface-variant border border-outline/40 p-6">
                <div className="text-xs uppercase tracking-widest text-on-surface-variant font-bold">
                  Attempt
                </div>
                <div className="text-3xl font-extrabold text-primary mt-2">
                  Saved
                </div>
              </div>
            </div>

            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <button
                type="button"
                className="bg-secondary text-white px-8 py-4 font-bold text-base hover:bg-primary transition-all rounded-full"
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
                className="bg-primary text-white px-8 py-4 font-bold text-base hover:bg-slate-800 transition-all rounded-full"
                onClick={() => router.push("/profile")}
              >
                Go to profile
              </button>
              <button
                type="button"
                className="bg-white text-primary border border-outline px-8 py-4 font-bold text-base hover:bg-surface-variant transition-all rounded-full"
                onClick={() => router.push(`/subjects/${subjectSlug}`)}
              >
                Back to subject
              </button>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-white border border-outline/60 shadow-soft-xl p-8">
              <div className="text-xs font-bold text-primary uppercase tracking-widest mb-6">
                Score breakdown
              </div>
              <div className="flex items-center justify-center py-8">
                <div className="relative w-44 h-44">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `conic-gradient(#3e5e95 ${result.questionsPercent}%, #e2e8f0 0)`,
                    }}
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <div className="text-3xl font-extrabold text-primary">
                      {Math.round(result.questionsPercent)}%
                    </div>
                    <div className="text-xs text-on-surface-variant font-bold uppercase tracking-widest mt-1">
                      Correct
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-sm text-on-surface-variant font-medium">
                Attempt ID: {result.attemptId.slice(0, 8).toUpperCase()}
              </div>
            </div>
          </div>
          </div>

          <div className="mt-12">
            <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
              Review
            </div>
            <div className="space-y-8">
              {questions.map((q) => {
                const st = qState.get(q.id);
                const selected = new Set(st?.selectedOptionIds ?? []);
                const fill = (st?.fillText ?? "").trim();
                const correctFill = (q.correct_text ?? "").trim();

                const correctOptionIds = new Set(q.options.filter((o) => o.is_correct).map((o) => o.id));
                const hasAnswer = q.type === "fill" ? !!fill : selected.size > 0;

                const isCorrect =
                  q.type === "fill"
                    ? fill.toLowerCase() === correctFill.toLowerCase() && !!correctFill
                    : (() => {
                        if (selected.size === 0) return false;
                        if (q.allow_multiple) {
                          if (selected.size !== correctOptionIds.size) return false;
                          for (const id of selected) if (!correctOptionIds.has(id)) return false;
                          return true;
                        }
                        if (selected.size !== 1) return false;
                        for (const id of selected) return correctOptionIds.has(id);
                        return false;
                      })();

                return (
                  <div key={q.id} className="bg-white border border-outline/60 shadow-soft-xl overflow-hidden">
                    <div className="p-6 border-b border-outline/40 flex items-start justify-between gap-6">
                      <div>
                        <div className="text-xs font-bold text-primary uppercase tracking-widest">
                          Question {q.question_number}
                        </div>
                      </div>
                      {!hasAnswer ? (
                        <span className="px-3 py-1 bg-slate-100 text-slate-800 text-[10px] font-black tracking-[0.2em] uppercase">
                          Unanswered
                        </span>
                      ) : isCorrect ? (
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black tracking-[0.2em] uppercase">
                          Correct
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-rose-100 text-rose-800 text-[10px] font-black tracking-[0.2em] uppercase">
                          Wrong
                        </span>
                      )}
                    </div>

                    <div className="p-6 space-y-5">
                      {q.prompt_text ? (
                        <div className="text-on-surface font-medium leading-relaxed">{q.prompt_text}</div>
                      ) : null}

                      {q.prompt_assets.length ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {q.prompt_assets.map((a) => {
                            const url = assetUrl(a);
                            return (
                              <div
                                key={a.id}
                                className="border border-outline/60 bg-surface-variant overflow-hidden"
                              >
                                {url ? (
                                  <img src={url} alt="Question asset" className="w-full h-auto" />
                                ) : (
                                  <div className="h-56" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}

                      {q.type === "fill" ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="border border-outline/60 bg-surface-variant p-5">
                            <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                              Your answer
                            </div>
                            <div className="text-lg font-extrabold text-primary mt-2">{fill || "—"}</div>
                          </div>
                          <div className="border border-outline/60 bg-surface-variant p-5">
                            <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                              Correct answer
                            </div>
                            <div className="text-lg font-extrabold text-primary mt-2">{correctFill || "—"}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {q.options.map((o) => {
                            const isSelected = selected.has(o.id);
                            const isCorrectOpt = o.is_correct;
                            const border = isCorrectOpt
                              ? "border-emerald-500"
                              : isSelected
                                ? "border-rose-400"
                                : "border-outline/60";
                            const bg = isSelected ? "bg-white" : "bg-surface-variant";
                            return (
                              <div
                                key={o.id}
                                className={`border ${border} ${bg} px-5 py-4 flex items-start justify-between gap-6`}
                              >
                                <div className="min-w-0">
                                  <div className="text-sm font-bold text-primary">
                                    {o.text ?? `Option ${o.option_number}`}
                                  </div>
                                  {o.url ? (
                                    <img
                                      src={o.url}
                                      alt="Option"
                                      className="mt-3 max-h-48 w-auto border border-outline/40"
                                    />
                                  ) : null}
                                </div>
                                <div className="flex items-center gap-2">
                                  {isSelected ? (
                                    <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-[10px] font-black tracking-[0.2em] uppercase">
                                      Your choice
                                    </span>
                                  ) : null}
                                  {isCorrectOpt ? (
                                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black tracking-[0.2em] uppercase">
                                      Correct
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {q.explanation_text || q.explanation_assets.length ? (
                        <div className="border border-outline/60 bg-surface-variant p-6">
                          <div className="text-xs font-bold text-primary uppercase tracking-widest mb-4">
                            Explanation
                          </div>
                          {q.explanation_text ? (
                            <div className="text-on-surface font-medium leading-relaxed">{q.explanation_text}</div>
                          ) : null}
                          {q.explanation_assets.length ? (
                            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                              {q.explanation_assets.map((a) => {
                                const url = assetUrl(a);
                                return (
                                  <div
                                    key={a.id}
                                    className="border border-outline/60 bg-white overflow-hidden"
                                  >
                                    {url ? (
                                      <img src={url} alt="Explanation asset" className="w-full h-auto" />
                                    ) : (
                                      <div className="h-56" />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : started ? (
        tab === "reference" ? (
          <div className="p-10">
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
                      className="border border-outline/60 bg-surface-variant overflow-hidden"
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
              <div className="border border-outline/60 bg-surface-variant px-6 py-10 text-on-surface-variant font-medium">
                No reference sheet uploaded yet.
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="px-8 py-6 border-b border-outline/40 bg-surface-variant/30">
              <div className="flex items-center justify-between gap-6">
                <div className="text-xs font-bold text-primary uppercase tracking-widest">Overview</div>
                <div className="flex flex-wrap gap-4 text-xs text-on-surface-variant font-medium">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 border border-outline/80 bg-surface-variant" />
                    Unseen / Seen
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 border border-emerald-500 bg-emerald-50" />
                    Answered
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 border border-amber-400 bg-amber-50" />
                    Marked for review
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-8 sm:grid-cols-12 md:grid-cols-16 lg:grid-cols-20 gap-2">
                {overview.map(({ q, seen, answered, marked }, idx) => {
                  const isCurrent = idx === currentIndex;
                  const border = marked
                    ? "border-amber-400"
                    : answered
                      ? "border-emerald-500"
                      : "border-outline/80";
                  const bg = marked
                    ? "bg-amber-50"
                    : answered
                      ? "bg-emerald-50"
                      : "bg-surface-variant";
                  const currentRing = isCurrent ? "ring-2 ring-primary/20" : "";
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      className={`h-10 border ${border} ${bg} ${currentRing} font-bold text-sm text-primary hover:brightness-[0.98] transition-all`}
                      aria-label={`Question ${q.question_number}`}
                    >
                      {q.question_number}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-10">
              {currentQuestion ? (
                <>
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
                        Question {currentQuestion.question_number} of {questions.length}
                      </div>
                    </div>
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
                      className="bg-white text-primary border border-outline/80 px-5 py-2.5 font-bold text-xs hover:bg-surface-variant transition-all rounded-full"
                    >
                      Mark for review
                    </button>
                  </div>

                  <div className="mt-8 space-y-6 bg-white border border-outline/50 shadow-soft-xl p-8">
                    {currentQuestion.prompt_text ? (
                      <div className="text-lg text-on-surface leading-relaxed font-medium">
                        {currentQuestion.prompt_text}
                      </div>
                    ) : null}

                    {currentQuestion.prompt_assets.length ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {currentQuestion.prompt_assets.map((a) => {
                          const url = assetUrl(a);
                          return (
                            <div
                              key={a.id}
                              className="border border-outline/60 bg-surface-variant overflow-hidden"
                            >
                              {url ? (
                                <img src={url} alt="Question asset" className="w-full h-auto" />
                              ) : (
                                <div className="h-56" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}

                    {currentQuestion.type === "fill" ? (
                      <div className="border border-outline/80 bg-white p-6">
                        <input
                          value={qState.get(currentQuestion.id)?.fillText ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setQState((prev) => {
                              const next = new Map(prev);
                              const st = next.get(currentQuestion.id);
                              if (!st) return prev;
                              next.set(currentQuestion.id, { ...st, fillText: v });
                              return next;
                            });
                          }}
                          className="h-12 w-full px-4 bg-background border border-border/80 focus:border-primary outline-none transition-colors"
                          placeholder="Type your answer"
                        />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(() => {
                          const st = qState.get(currentQuestion.id);
                          const selected = new Set(st?.selectedOptionIds ?? []);
                          const order = optionOrder.get(currentQuestion.id);
                          const byId = new Map(currentQuestion.options.map((o) => [o.id, o]));
                          const ordered = (order ?? []).map((id) => byId.get(id)).filter((o): o is Option => !!o);
                          const seen = new Set(ordered.map((o) => o.id));
                          const leftovers = currentQuestion.options.filter((o) => !seen.has(o.id));
                          const list = [...ordered, ...leftovers];

                          return list.map((opt) => {
                            const selectedNow = selected.has(opt.id);
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  setQState((prev) => {
                                    const next = new Map(prev);
                                    const cur = next.get(currentQuestion.id);
                                    if (!cur) return prev;
                                    const set = new Set(cur.selectedOptionIds);
                                    if (currentQuestion.allow_multiple) {
                                      if (set.has(opt.id)) set.delete(opt.id);
                                      else set.add(opt.id);
                                    } else {
                                      set.clear();
                                      set.add(opt.id);
                                    }
                                    next.set(currentQuestion.id, {
                                      ...cur,
                                      selectedOptionIds: Array.from(set),
                                    });
                                    return next;
                                  });
                                }}
                                className={
                                  selectedNow
                                    ? "w-full text-left border border-primary bg-surface-variant px-6 py-4 font-bold text-primary transition-all"
                                    : "w-full text-left border border-outline/80 bg-white px-6 py-4 font-bold text-on-surface hover:bg-surface-variant transition-all"
                                }
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="text-sm font-extrabold">
                                    {opt.text ? opt.text : `Option ${opt.option_number}`}
                                  </div>
                                  <span
                                    className={
                                      selectedNow
                                        ? "w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center"
                                        : "w-5 h-5 rounded-full border border-outline/80 flex items-center justify-center"
                                    }
                                  >
                                    {selectedNow ? (
                                      <span className="material-symbols-outlined text-[16px]">
                                        check
                                      </span>
                                    ) : null}
                                  </span>
                                </div>
                                {opt.url ? (
                                  <img
                                    src={opt.url}
                                    alt="Option"
                                    className="mt-4 w-full max-h-56 object-contain border border-outline/60 bg-white"
                                  />
                                ) : null}
                              </button>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>

                  <div className="mt-10 flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => setCurrentIndex((v) => Math.max(0, v - 1))}
                      disabled={currentIndex === 0}
                      className="bg-white text-primary border border-outline/80 px-8 py-4 font-bold text-sm hover:bg-surface-variant transition-all rounded-full disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (currentIndex === questions.length - 1) {
                          onSubmit(false);
                        } else {
                          setCurrentIndex((v) => Math.min(questions.length - 1, v + 1));
                        }
                      }}
                      disabled={submitting || !!result}
                      className="bg-primary text-white px-8 py-4 font-bold text-sm hover:bg-slate-800 transition-all rounded-full disabled:opacity-50"
                    >
                      {currentIndex === questions.length - 1 ? "Submit" : "Next"}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )
      ) : (
        <div className="p-10">
          <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
            Ready
          </div>
          <div className="text-on-surface-variant font-medium">
            Start the test to begin the timer.
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
