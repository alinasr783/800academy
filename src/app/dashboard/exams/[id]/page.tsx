"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import MathText from "@/components/MathText";
import LoadingAnimation from "@/components/LoadingAnimation";

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
  type: "mcq" | "fill" | "reference_block";
  prompt_text: string | null;
  points: number;
  allow_multiple: boolean;
  correct_text: string | null;
  passage_id: string | null;
  created_at: string;
  updated_at: string;
};

type PassageRow = {
  id: string;
  exam_id: string;
  sort_order: number;
  kind: "reading" | "reference";
  title: string | null;
  body_html: string;
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
  const [passages, setPassages] = useState<PassageRow[]>([]);
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
  const [refFile, setRefFile] = useState<File | null>(null);

  const [passageTitle, setPassageTitle] = useState("");
  const [passageKind, setPassageKind] = useState<"reading"|"reference">("reading");
  const [passageBody, setPassageBody] = useState("");
  const [passageSort, setPassageSort] = useState("0");

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
        passages: PassageRow[];
      };
      setExam(json.exam);
      setAssets(json.assets ?? []);
      setQuestions((json.questions ?? []).slice().sort((a, b) => a.question_number - b.question_number));
      setPassages(json.passages ?? []);

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

  // Note: MathText component handles its own KaTeX rendering internally.
  // No need for a separate useEffect to render math in passage previews.

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
    if (!refFile && !assetUrl.trim()) {
      setError("Please select a file or enter a URL.");
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
      let finalUrl = assetUrl.trim();
      let storagePath = null;
      const bucket = "assets";

      if (refFile) {
        const safeName = refFile.name.replaceAll(" ", "-");
        storagePath = `exams/${examId}/references/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage.from(bucket).upload(storagePath, refFile, { upsert: false });
        if (upErr) throw new Error(upErr.message);
        finalUrl = supabase.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl;
      }

      const json = (await adminFetch(`/api/admin/exams/${examId}`, {
        method: "POST",
        body: JSON.stringify({ 
          action: "create_asset", 
          url: finalUrl, 
          storage_path: storagePath,
          bucket: bucket,
          sort_order: sortOrder 
        }),
      })) as { asset: ExamAssetRow };

      setAssets((prev) =>
        [...prev, json.asset].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)),
      );
      setAssetUrl("");
      setAssetSort("0");
      setRefFile(null);
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

  async function addPassage() {
    if (!passageBody.trim()) {
      setError("Passage HTML body is required.");
      return;
    }
    const sortOrder = Math.trunc(Number(passageSort || 0));
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const json = (await adminFetch(`/api/admin/exams/${examId}`, {
        method: "POST",
        body: JSON.stringify({
          action: "create_passage",
          title: passageTitle.trim() || null,
          body_html: passageBody.trim(),
          kind: passageKind,
          sort_order: sortOrder,
        }),
      })) as { passage: PassageRow };
      setPassages((prev) =>
        [...prev, json.passage].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)),
      );
      setPassageTitle("");
      setPassageBody("");
      setPassageSort("0");
      setMessage("Passage added.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function updatePassage(passageId: string, patch: Partial<PassageRow>) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const json = (await adminFetch(`/api/admin/exams/${examId}`, {
        method: "POST",
        body: JSON.stringify({ action: "update_passage", passage_id: passageId, ...patch }),
      })) as { passage: PassageRow };
      setPassages((prev) => prev.map((p) => (p.id === passageId ? json.passage : p)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function deletePassage(passageId: string) {
    const ok = window.confirm("Delete this passage? This will link related questions to NULL.");
    if (!ok) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await adminFetch(`/api/admin/exams/${examId}`, {
        method: "POST",
        body: JSON.stringify({ action: "delete_passage", passage_id: passageId }),
      });
      setPassages((prev) => prev.filter((p) => p.id !== passageId));
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
    <div className="max-w-full">
      {/* Sticky Header Actions */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border border-outline/60 shadow-soft-xl rounded-2xl mb-8 p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/exams"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-on-surface hover:bg-slate-200 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </Link>
          <div>
            <h1 className="font-headline text-2xl font-black text-primary tracking-tighter">
              Exam Builder
            </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary mt-1">
              {headerTitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={deleteExam}
            disabled={saving}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-rose-50 text-rose-700 border border-rose-100 px-6 py-3 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-rose-100 transition-all disabled:opacity-50 active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
            Delete
          </button>
          <button
            type="button"
            onClick={saveExam}
            disabled={saving}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-primary text-white px-8 py-3 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-8 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-3 animate-slide-up">
          <span className="material-symbols-outlined text-rose-500">error</span>
          <span className="text-sm font-bold">{error}</span>
        </div>
      ) : null}

      {message ? (
        <div className="mb-8 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center gap-3 animate-slide-up">
          <span className="material-symbols-outlined text-emerald-500">check_circle</span>
          <span className="text-sm font-bold">{message}</span>
        </div>
      ) : null}

      {loading ? (
        <LoadingAnimation />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          {/* Main Configuration Panel */}
          <div className="xl:col-span-8 space-y-8">
            <div className="bg-white border border-outline/60 shadow-soft-xl rounded-3xl overflow-hidden">
              <div className="p-6 border-b border-outline/40 bg-slate-50/50 flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">settings</span>
                <h2 className="text-sm font-black uppercase tracking-widest text-primary">General Configuration</h2>
              </div>
              <div className="p-8 space-y-8">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-3 ml-1">
                    Exam Title
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="h-14 w-full px-6 bg-slate-50 border border-slate-200 rounded-2xl focus:border-primary focus:bg-white outline-none transition-all font-bold text-lg"
                    placeholder="e.g. EST 1 Math Core - Practice 2"
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-3 ml-1">
                      Exam Number
                    </label>
                    <input
                      type="number"
                      value={examNumber}
                      onChange={(e) => setExamNumber(e.target.value)}
                      className="h-12 w-full px-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-primary focus:bg-white outline-none transition-all font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-3 ml-1">
                      Duration (min)
                    </label>
                    <input
                      type="number"
                      value={durationMin}
                      onChange={(e) => setDurationMin(e.target.value)}
                      className="h-12 w-full px-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-primary focus:bg-white outline-none transition-all font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-3 ml-1">
                      Pass %
                    </label>
                    <input
                      type="number"
                      value={passPercent}
                      onChange={(e) => setPassPercent(e.target.value)}
                      className="h-12 w-full px-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-primary focus:bg-white outline-none transition-all font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-3 ml-1">
                      Max Attempts
                    </label>
                    <input
                      value={maxAttempts}
                      onChange={(e) => setMaxAttempts(e.target.value)}
                      placeholder="∞"
                      className="h-12 w-full px-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-primary focus:bg-white outline-none transition-all font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-3 ml-1">
                      Min Score
                    </label>
                    <input
                      type="number"
                      value={minScore}
                      onChange={(e) => setMinScore(e.target.value)}
                      className="h-12 w-full px-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-primary focus:bg-white outline-none transition-all font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-3 ml-1">
                      Total Points
                    </label>
                    <input
                      type="number"
                      value={totalPoints}
                      onChange={(e) => setTotalPoints(e.target.value)}
                      className="h-12 w-full px-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-primary focus:bg-white outline-none transition-all font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-3 ml-1">
                      Access Type
                    </label>
                    <label className={`h-12 w-full flex items-center justify-center gap-3 px-4 border-2 rounded-xl cursor-pointer transition-all active:scale-[0.98] ${isFree ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
                      <input
                        type="checkbox"
                        checked={isFree}
                        onChange={(e) => setIsFree(e.target.checked)}
                        className="hidden"
                      />
                      <span className={`material-symbols-outlined text-[20px] ${isFree ? "text-emerald-600" : "text-slate-400"}`}>
                        {isFree ? "lock_open" : "lock"}
                      </span>
                      <span className={`text-sm font-black uppercase tracking-widest ${isFree ? "text-emerald-700" : "text-slate-500"}`}>
                        {isFree ? "Free Access" : "Paid Only"}
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Passages Section */}
            <div className="bg-white border border-outline/60 shadow-soft-xl rounded-3xl overflow-hidden">
               <div className="p-6 border-b border-outline/40 bg-violet-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-violet-600">view_cozy</span>
                  <h2 className="text-sm font-black uppercase tracking-widest text-violet-700">Passages & Reference Blocks (HTML)</h2>
                </div>
                <div className="text-[10px] font-black text-violet-400 uppercase tracking-widest bg-violet-100 px-3 py-1 rounded-full">
                  Total: {passages.length}
                </div>
              </div>
              <div className="p-8 space-y-8">
                 <div className="bg-slate-50 p-6 rounded-2xl space-y-4 border border-slate-100">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      <div className="md:col-span-6">
                        <input
                          value={passageTitle}
                          onChange={(e) => setPassageTitle(e.target.value)}
                          placeholder="Passage/Reference title (optional)"
                          className="h-12 w-full px-5 bg-white border border-slate-200 rounded-xl focus:border-violet-500 outline-none transition-all font-bold"
                        />
                      </div>
                      <div className="md:col-span-3">
                         <select
                           value={passageKind}
                           onChange={(e) => setPassageKind(e.target.value as "reading"|"reference")}
                           className="h-12 w-full px-4 bg-white border border-slate-200 rounded-xl focus:border-violet-500 outline-none transition-all font-bold appearance-none"
                         >
                           <option value="reading">Reading Passage</option>
                           <option value="reference">Reference Block</option>
                         </select>
                      </div>
                      <div className="md:col-span-3">
                         <input
                          type="number"
                          value={passageSort}
                          onChange={(e) => setPassageSort(e.target.value)}
                          placeholder="Sort order"
                          className="h-12 w-full px-5 bg-white border border-slate-200 rounded-xl focus:border-violet-500 outline-none transition-all font-bold"
                        />
                      </div>
                    </div>
                    <textarea
                      value={passageBody}
                      onChange={(e) => setPassageBody(e.target.value)}
                      placeholder="Paste your HTML content here..."
                      rows={5}
                      className="w-full px-5 py-4 bg-white border border-slate-200 rounded-xl focus:border-violet-500 outline-none transition-all font-medium text-sm leading-relaxed resize-none"
                    />
                    {passageBody && (
                      <div className="mt-4 p-5 bg-white border border-dashed border-slate-200 rounded-xl overflow-hidden">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Live Rich Preview</div>
                        <MathText text={passageBody} />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={addPassage}
                      disabled={saving || !passageBody.trim()}
                      className="w-full h-12 bg-violet-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-xl hover:bg-violet-700 transition-all shadow-md shadow-violet-200 active:scale-[0.99] disabled:opacity-50"
                    >
                      Add New Passage
                    </button>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {passages.map((p) => (
                      <div key={p.id} className="group flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-violet-300 hover:shadow-lg transition-all">
                        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center font-black text-xs flex-shrink-0">
                               {p.sort_order}
                            </div>
                            <h3 className="text-sm font-black text-slate-800 truncate uppercase mt-0.5 tracking-tight flex items-center gap-2">
                              {p.title || "Untitled Block"}
                              <span className={`px-2 py-0.5 rounded text-[9px] ${p.kind === 'reference' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>
                                {p.kind === 'reference' ? 'Reference' : 'Reading'}
                              </span>
                            </h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => deletePassage(p.id)}
                            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
                        </div>
                        <div className="p-4 space-y-4">
                          <textarea
                             defaultValue={p.body_html}
                             onBlur={(e) => {
                               const v = e.target.value.trim();
                               if (v && v !== p.body_html) updatePassage(p.id, { body_html: v });
                             }}
                             rows={4}
                             className="w-full bg-slate-50 text-[11px] font-medium leading-relaxed p-3 rounded-lg border border-transparent focus:border-violet-200 focus:bg-white transition-all outline-none"
                          />
                          <div className="flex gap-2">
                            <input
                              defaultValue={p.title ?? ""}
                              onBlur={(e) => {
                                const v = e.target.value.trim();
                                if (v !== (p.title ?? "")) updatePassage(p.id, { title: v || null });
                              }}
                              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold focus:border-violet-200 outline-none"
                              placeholder="Update title"
                            />
                            <select
                              value={p.kind}
                              onChange={(e) => {
                                const k = e.target.value as "reading"|"reference";
                                if (k !== p.kind) updatePassage(p.id, { kind: k });
                              }}
                              className="w-28 px-2 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold focus:border-violet-200 outline-none"
                            >
                              <option value="reading">Reading</option>
                              <option value="reference">Reference</option>
                            </select>
                            <input
                              type="number"
                              defaultValue={String(p.sort_order)}
                              onBlur={(e) => {
                                const n = Math.trunc(Number(e.target.value));
                                if (Number.isFinite(n) && n !== p.sort_order) updatePassage(p.id, { sort_order: n });
                              }}
                              className="w-16 px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold text-center focus:border-violet-200 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                   ))}
                 </div>
              </div>
            </div>
          </div>

          {/* Right Panel: Questions & Reference Sheets */}
          <div className="xl:col-span-4 space-y-8">
            {/* Action Bar */}
            <div className="bg-primary rounded-3xl p-8 shadow-soft-xl text-white relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-1000" />
               <div className="relative z-10 flex flex-col gap-6">
                  <div>
                    <h3 className="text-xl font-black tracking-tight mb-2">Build Questions</h3>
                    <p className="text-slate-300 text-xs font-bold leading-relaxed">Create engaging MCQ and Fill-in-the-gap questions with explanation support.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/exams/questions/new?examId=${examId}`)}
                    className="w-full h-14 bg-white text-primary rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-slate-100 transition-all active:scale-95"
                  >
                    + Create New Question
                  </button>
               </div>
            </div>

            {/* Questions List */}
            <div className="bg-white border border-outline/60 shadow-soft-xl rounded-2xl overflow-hidden">
               <div className="p-5 border-b border-outline/40 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-[20px]">list_alt</span>
                    <h2 className="text-[10px] font-black uppercase tracking-widest text-primary">Question Bank ({questions.filter(q => q.type !== 'reference_block').length})</h2>
                  </div>
                  <button
                    type="button"
                    onClick={saveOrder}
                    disabled={saving || questions.length === 0}
                    className="h-8 px-4 bg-secondary text-white font-black text-[9px] uppercase tracking-widest rounded-lg hover:bg-primary transition-all active:scale-95 disabled:opacity-50"
                  >
                    Save Order
                  </button>
               </div>
               <div className="max-h-[600px] overflow-y-auto divide-y divide-outline/30 scroll-smooth">
                  {questions.length === 0 ? (
                    <div className="p-12 text-center text-slate-300 font-bold text-xs uppercase tracking-widest italic">
                      No questions built yet.
                    </div>
                  ) : (
                    questions.map((q, idx) => {
                      const hasPassage = q.passage_id;
                      return (
                        <div
                          key={q.id}
                          draggable
                          onDragStart={() => { dragFromIdx.current = idx; }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            const from = dragFromIdx.current;
                            dragFromIdx.current = null;
                            if (from === null || from === idx) return;
                            reorderLocal(from, idx);
                          }}
                          className="p-5 hover:bg-slate-50 transition-colors cursor-move group animate-fade-in"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                               <div className="flex items-center gap-2 mb-2">
                                  <div className="px-2 py-0.5 bg-primary text-white text-[9px] font-bold rounded uppercase">
                                     Q{idx + 1}
                                  </div>
                                  <div className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-bold rounded uppercase tracking-widest">
                                     {q.type}
                                  </div>
                                  <div className="px-2 py-0.5 bg-secondary/10 text-secondary text-[9px] font-bold rounded uppercase tracking-widest">
                                     {q.points} PTS
                                  </div>
                                  {hasPassage && (
                                    <div className="px-2 py-0.5 bg-violet-100 text-violet-600 text-[9px] font-bold rounded uppercase tracking-widest flex items-center gap-1">
                                      <span className="material-symbols-outlined text-[10px]">menu_book</span>
                                      P
                                    </div>
                                  )}
                               </div>
                               <div className="text-xs font-bold text-on-surface line-clamp-2 leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity">
                                 {q.prompt_text || "No prompt text provided."}
                               </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                               <Link
                                 href={`/dashboard/exams/questions/${q.id}`}
                                 className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-primary transition-all rounded-lg active:scale-90"
                               >
                                 <span className="material-symbols-outlined text-[18px]">edit</span>
                               </Link>
                               <button
                                 type="button"
                                 onClick={() => deleteQuestion(q.id)}
                                 disabled={saving}
                                 className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all rounded-lg active:scale-90"
                               >
                                 <span className="material-symbols-outlined text-[18px]">delete</span>
                               </button>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
               </div>
            </div>

            {/* Reference Sheets Panel */}
            <div className="bg-white border border-outline/60 shadow-soft-xl rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-outline/40 bg-slate-50/50 flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-[20px]">attachment</span>
                  <h2 className="text-[10px] font-black uppercase tracking-widest text-primary">Reference Sheets</h2>
                </div>
                <div className="p-6 space-y-6">
                  <div className="flex flex-col gap-4">
                    <div className="relative group overflow-hidden">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setRefFile(e.target.files?.[0] || null)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="h-24 w-full border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 group-hover:bg-slate-50 group-hover:border-primary transition-all">
                        {refFile ? (
                          <div className="flex flex-col items-center gap-1">
                             <span className="material-symbols-outlined text-emerald-500">check_circle</span>
                             <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">{refFile.name}</span>
                          </div>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-slate-400 group-hover:text-primary">upload_file</span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-primary">Select Image File</span>
                          </>
                        )}
                      </div>
                    </div>

                    {!refFile && (
                      <div className="space-y-2">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">OR</div>
                        <input
                          value={assetUrl}
                          onChange={(e) => setAssetUrl(e.target.value)}
                          placeholder="Paste image URL directly"
                          className="h-10 w-full px-4 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:border-primary outline-none transition-all"
                        />
                      </div>
                    )}

                    <div className="flex gap-2">
                       <div className="relative w-20">
                          <input
                            type="number"
                            value={assetSort}
                            onChange={(e) => setAssetSort(e.target.value)}
                            placeholder="Order"
                            className="h-10 w-full px-3 text-xs font-bold bg-slate-50 border border-slate-100 rounded-xl text-center focus:border-primary outline-none pl-6"
                          />
                          <span className="material-symbols-outlined absolute left-2 top-2.5 text-[14px] text-slate-400">sort</span>
                       </div>
                       <button
                         type="button"
                         onClick={addAsset}
                         disabled={saving || (!refFile && !assetUrl.trim())}
                         className="flex-1 h-10 bg-primary text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50 shadow-md shadow-primary/10"
                       >
                         {saving ? "Saving..." : "Add Reference Sheet"}
                       </button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {assets.map((a) => (
                      <div key={a.id} className="group p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                           <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center group-hover:border-primary transition-colors overflow-hidden">
                              {a.url ? (
                                <img src={a.url} alt="Ref" className="w-full h-full object-cover" />
                              ) : (
                                <span className="material-symbols-outlined text-slate-300 text-[18px]">image</span>
                              )}
                           </div>
                           <div className="min-w-0">
                              <div className="text-[10px] font-black text-primary truncate tracking-tighter uppercase">{a.url?.split('/').pop() || "Sheet"}</div>
                              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Order: {a.sort_order}</div>
                           </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteAsset(a.id)}
                          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-600 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
