"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ExamRow = {
  id: string;
  subject_id: string;
  exam_number: number;
  title: string;
  is_free: boolean;
  duration_seconds: number;
  pass_percent: number;
  max_attempts: number | null;
  min_score: number;
  total_points: number;
  created_at: string;
  updated_at: string;
};

type ExamAssetRow = {
  id: string;
  exam_id: string;
  bucket: string;
  storage_path: string | null;
  url: string | null;
  sort_order: number;
  created_at: string;
};

type QuestionRow = {
  id: string;
  exam_id: string;
  question_number: number;
  type: "mcq" | "fill";
  prompt_text: string | null;
  points: number;
  allow_multiple: boolean;
  correct_text: string | null;
  created_at: string;
  updated_at: string;
};

function safeMinutes(seconds: number) {
  const s = Number.isFinite(seconds) ? seconds : 0;
  return Math.max(1, Math.round(s / 60));
}

export default function DashboardExamDetails() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const examId = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exam, setExam] = useState<ExamRow | null>(null);
  const [assets, setAssets] = useState<ExamAssetRow[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [examNumber, setExamNumber] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [durationMin, setDurationMin] = useState("45");
  const [passPercent, setPassPercent] = useState("60");
  const [maxAttempts, setMaxAttempts] = useState("");
  const [minScore, setMinScore] = useState("200");
  const [totalPoints, setTotalPoints] = useState("600");

  const [assetUrl, setAssetUrl] = useState("");
  const [assetSort, setAssetSort] = useState("0");

  const dragFromIdx = useRef<number | null>(null);

  async function adminFetch(path: string, init?: RequestInit) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("Not authenticated.");
    const res = await fetch(path, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "Request failed");
    return json;
  }

  async function load() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const json = (await adminFetch(`/api/admin/exams/${examId}`)) as {
        exam: ExamRow;
        assets: ExamAssetRow[];
        questions: QuestionRow[];
      };
      setExam(json.exam);
      setAssets(json.assets ?? []);
      setQuestions((json.questions ?? []).slice().sort((a, b) => a.question_number - b.question_number));

      setTitle(json.exam.title);
      setExamNumber(String(json.exam.exam_number));
      setIsFree(json.exam.is_free);
      setDurationMin(String(safeMinutes(json.exam.duration_seconds)));
      setPassPercent(String(json.exam.pass_percent));
      setMaxAttempts(json.exam.max_attempts === null ? "" : String(json.exam.max_attempts));
      setMinScore(String(json.exam.min_score));
      setTotalPoints(String(json.exam.total_points));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [examId]);

  async function saveExam() {
    const num = Math.trunc(Number(examNumber));
    const durMin = Math.trunc(Number(durationMin));
    const pass = Math.trunc(Number(passPercent));
    const minS = Math.trunc(Number(minScore));
    const totP = Math.trunc(Number(totalPoints));
    const maxA = maxAttempts.trim() ? Math.trunc(Number(maxAttempts)) : null;

    if (!Number.isFinite(num) || num < 1) {
      setError("Invalid exam number.");
      return;
    }
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!Number.isFinite(durMin) || durMin < 1) {
      setError("Invalid duration.");
      return;
    }
    if (!Number.isFinite(pass) || pass < 0 || pass > 100) {
      setError("Invalid pass percent.");
      return;
    }
    if (!Number.isFinite(minS) || minS < 0 || minS > 800) {
      setError("Invalid min score.");
      return;
    }
    if (!Number.isFinite(totP) || totP < 1) {
      setError("Invalid total points.");
      return;
    }
    if (maxA !== null && (!Number.isFinite(maxA) || maxA < 1)) {
      setError("Invalid max attempts.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const json = (await adminFetch(`/api/admin/exams/${examId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: title.trim(),
          exam_number: num,
          is_free: isFree,
          duration_seconds: durMin * 60,
          pass_percent: pass,
          max_attempts: maxA,
          min_score: minS,
          total_points: totP,
        }),
      })) as { exam: ExamRow };
      setExam(json.exam);
      setMessage("Saved.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function deleteExam() {
    const ok = window.confirm("Delete this exam permanently?");
    if (!ok) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await adminFetch(`/api/admin/exams/${examId}`, { method: "DELETE" });
      router.push("/dashboard/exams");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function addAsset() {
    if (!assetUrl.trim()) {
      setError("Asset URL is required.");
      return;
    }
    const sortOrder = Math.trunc(Number(assetSort || 0));
    if (!Number.isFinite(sortOrder)) {
      setError("Invalid sort order.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const json = (await adminFetch(`/api/admin/exams/${examId}`, {
        method: "POST",
        body: JSON.stringify({ action: "create_asset", url: assetUrl.trim(), sort_order: sortOrder }),
      })) as { asset: ExamAssetRow };
      setAssets((prev) =>
        [...prev, json.asset].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)),
      );
      setAssetUrl("");
      setAssetSort("0");
      setMessage("Reference added.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function updateAsset(assetId: string, patch: Partial<ExamAssetRow>) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const json = (await adminFetch(`/api/admin/exams/${examId}`, {
        method: "POST",
        body: JSON.stringify({ action: "update_asset", asset_id: assetId, ...patch }),
      })) as { asset: ExamAssetRow };
      setAssets((prev) => prev.map((a) => (a.id === assetId ? json.asset : a)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function deleteAsset(assetId: string) {
    const ok = window.confirm("Delete this reference?");
    if (!ok) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await adminFetch(`/api/admin/exams/${examId}`, {
        method: "POST",
        body: JSON.stringify({ action: "delete_asset", asset_id: assetId }),
      });
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuestion(questionId: string) {
    const ok = window.confirm("Delete this question?");
    if (!ok) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await adminFetch(`/api/admin/exams/${examId}`, {
        method: "POST",
        body: JSON.stringify({ action: "delete_question", question_id: questionId }),
      });
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  function reorderLocal(from: number, to: number) {
    setQuestions((prev) => {
      if (from < 0 || from >= prev.length || to < 0 || to >= prev.length) return prev;
      const copy = prev.slice();
      const [moved] = copy.splice(from, 1);
      copy.splice(to, 0, moved);
      return copy.map((q, idx) => ({ ...q, question_number: idx + 1 }));
    });
  }

  async function saveOrder() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await adminFetch(`/api/admin/exams/${examId}`, {
        method: "POST",
        body: JSON.stringify({
          action: "reorder_questions",
          question_ids_in_order: questions.map((q) => q.id),
        }),
      });
      setMessage("Order saved.");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  const headerTitle = useMemo(() => {
    if (!exam) return `Exam ${examId}`;
    return `#${exam.exam_number} • ${exam.title}`;
  }, [exam, examId]);

  return (
    <div className="bg-white border border-outline/60 shadow-soft-xl overflow-hidden">
      <div className="p-8 border-b border-outline/40">
        <div className="flex items-start justify-between gap-8">
          <div>
            <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
              Exam
            </div>
            <h1 className="font-headline text-4xl font-extrabold text-primary tracking-tighter">
              Exam Builder
            </h1>
            <p className="text-on-surface-variant font-medium mt-3">{headerTitle}</p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={deleteExam}
              disabled={saving}
              className="bg-white text-rose-700 border border-rose-200 px-6 py-3 font-bold text-sm hover:bg-rose-50 transition-all disabled:opacity-60"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={saveExam}
              disabled={saving}
              className="bg-secondary text-white px-6 py-3 font-bold text-sm hover:bg-primary transition-all disabled:opacity-60"
            >
              Save
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="p-6 border-b border-outline/40 bg-rose-50 text-rose-700">{error}</div>
      ) : null}

      {message ? (
        <div className="p-6 border-b border-outline/40 bg-surface-variant text-on-surface">{message}</div>
      ) : null}

      {loading ? (
        <div className="p-10 text-on-surface-variant font-medium">Loading…</div>
      ) : (
        <div className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7 space-y-6">
            <div>
              <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Title</div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-3">
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">
                  Exam #
                </div>
                <input
                  value={examNumber}
                  onChange={(e) => setExamNumber(e.target.value)}
                  className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
                />
              </div>
              <div className="md:col-span-3">
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">
                  Duration (min)
                </div>
                <input
                  value={durationMin}
                  onChange={(e) => setDurationMin(e.target.value)}
                  className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
                />
              </div>
              <div className="md:col-span-3">
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">
                  Pass %
                </div>
                <input
                  value={passPercent}
                  onChange={(e) => setPassPercent(e.target.value)}
                  className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
                />
              </div>
              <div className="md:col-span-3">
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">
                  Max attempts
                </div>
                <input
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(e.target.value)}
                  placeholder="empty = unlimited"
                  className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-4">
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">
                  Min score
                </div>
                <input
                  value={minScore}
                  onChange={(e) => setMinScore(e.target.value)}
                  className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
                />
              </div>
              <div className="md:col-span-4">
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">
                  Total points
                </div>
                <input
                  value={totalPoints}
                  onChange={(e) => setTotalPoints(e.target.value)}
                  className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
                />
              </div>
              <div className="md:col-span-4">
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">
                  Access
                </div>
                <label className="h-12 w-full flex items-center gap-3 px-4 bg-background border border-border/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFree}
                    onChange={(e) => setIsFree(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-bold text-primary">{isFree ? "Free" : "Paid"}</span>
                </label>
              </div>
            </div>

            <div className="bg-surface-variant border border-outline/40 p-6">
              <div className="text-xs font-bold text-primary uppercase tracking-widest mb-4">
                Reference sheets
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-8">
                  <input
                    value={assetUrl}
                    onChange={(e) => setAssetUrl(e.target.value)}
                    placeholder="https://..."
                    className="h-12 w-full px-4 bg-white border border-outline/60 focus:border-primary outline-none transition-colors"
                  />
                </div>
                <div className="md:col-span-2">
                  <input
                    value={assetSort}
                    onChange={(e) => setAssetSort(e.target.value)}
                    placeholder="Sort"
                    className="h-12 w-full px-4 bg-white border border-outline/60 focus:border-primary outline-none transition-colors"
                  />
                </div>
                <div className="md:col-span-2">
                  <button
                    type="button"
                    onClick={addAsset}
                    disabled={saving}
                    className="h-12 w-full bg-primary text-white font-bold text-sm hover:bg-slate-800 transition-colors disabled:opacity-60"
                  >
                    Add
                  </button>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {assets
                  .slice()
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-4 bg-white border border-outline/40 px-4 py-3">
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold text-primary break-all">
                          {a.url || a.storage_path || a.id}
                        </div>
                        <div className="text-xs text-on-surface-variant font-medium mt-1">
                          Sort: {a.sort_order}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          defaultValue={String(a.sort_order)}
                          onBlur={(e) => {
                            const n = Math.trunc(Number(e.target.value));
                            if (!Number.isFinite(n) || n === a.sort_order) return;
                            updateAsset(a.id, { sort_order: n });
                          }}
                          className="h-10 w-20 px-3 bg-background border border-border/60 focus:border-primary outline-none transition-colors text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => deleteAsset(a.id)}
                          disabled={saving}
                          className="text-sm font-bold text-rose-700 hover:text-rose-900 transition-colors disabled:opacity-60"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="bg-surface-variant border border-outline/40 p-6">
              <div className="text-xs font-bold text-primary uppercase tracking-widest mb-4">
                Add question
              </div>
              <button
                type="button"
                onClick={() => router.push(`/dashboard/exams/${examId}/questions/new`)}
                disabled={saving}
                className="h-12 w-full bg-primary text-white font-bold text-sm hover:bg-slate-800 transition-colors disabled:opacity-60"
              >
                Add question
              </button>
              <div className="text-xs text-on-surface-variant font-medium mt-3">
                Opens a full page editor for MCQ and Fill questions.
              </div>
            </div>

            <div className="bg-white border border-outline/60 shadow-soft-xl overflow-hidden">
              <div className="p-5 border-b border-outline/40 flex items-center justify-between gap-4">
                <div className="text-xs font-bold text-primary uppercase tracking-widest">
                  Questions ({questions.length})
                </div>
                <button
                  type="button"
                  onClick={saveOrder}
                  disabled={saving || questions.length === 0}
                  className="h-10 px-4 bg-secondary text-white font-bold text-xs hover:bg-primary transition-colors disabled:opacity-60"
                >
                  Save order
                </button>
              </div>
              {questions.length === 0 ? (
                <div className="p-6 text-on-surface-variant font-medium">No questions yet.</div>
              ) : (
                <div className="divide-y divide-outline/40">
                  {questions.map((q, idx) => (
                    <div
                      key={q.id}
                      draggable
                      onDragStart={() => {
                        dragFromIdx.current = idx;
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        const from = dragFromIdx.current;
                        dragFromIdx.current = null;
                        if (from === null || from === idx) return;
                        reorderLocal(from, idx);
                      }}
                      className="p-5 bg-white hover:bg-surface-variant transition-colors cursor-move"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold text-primary">
                            #{idx + 1} • {q.type.toUpperCase()} • {q.points} pts
                          </div>
                          <div className="text-xs text-on-surface-variant font-medium mt-2 line-clamp-3">
                            {q.prompt_text || "—"}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Link
                            href={`/dashboard/exams/questions/${q.id}`}
                            className="text-sm font-bold text-primary hover:text-secondary transition-colors"
                          >
                            Edit
                          </Link>
                          <button
                            type="button"
                            onClick={() => deleteQuestion(q.id)}
                            disabled={saving}
                            className="text-sm font-bold text-rose-700 hover:text-rose-900 transition-colors disabled:opacity-60"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
