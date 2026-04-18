"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import MathText from "@/components/MathText";

type QuestionRow = {
  id: string;
  exam_id: string;
  question_number: number;
  type: "mcq" | "fill";
  prompt_text: string | null;
  explanation_text: string | null;
  points: number;
  allow_multiple: boolean;
  correct_text: string | null;
  passage_id: string | null;
  topic_id: string | null;
  created_at: string;
  updated_at: string;
};

type PassageRow = {
  id: string;
  title: string | null;
  kind: "reading" | "reference";
};

type TopicRow = { id: string; title: string };

type ExamRow = { id: string; title: string };

type QuestionAssetRow = {
  id: string;
  question_id: string;
  bucket: string;
  storage_path: string | null;
  url: string | null;
  alt: string | null;
  kind: "prompt" | "explanation";
  sort_order: number;
  created_at: string;
};

type OptionRow = {
  id: string;
  question_id: string;
  option_number: number;
  text: string | null;
  bucket: string;
  storage_path: string | null;
  url: string | null;
  is_correct: boolean;
  created_at: string;
};

export default function DashboardQuestionDetails() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const questionId = params.id;
  const storageBucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "assets";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [question, setQuestion] = useState<QuestionRow | null>(null);
  const [assets, setAssets] = useState<QuestionAssetRow[]>([]);
  const [options, setOptions] = useState<OptionRow[]>([]);
  const [exam, setExam] = useState<ExamRow | null>(null);
  const [passages, setPassages] = useState<PassageRow[]>([]);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [type, setType] = useState<"mcq" | "fill">("mcq");
  const [points, setPoints] = useState("1");
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [correctText, setCorrectText] = useState("");
  const [passageId, setPassageId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [explanationText, setExplanationText] = useState("");

  const [assetUrl, setAssetUrl] = useState("");
  const [assetAlt, setAssetAlt] = useState("");
  const [assetSort, setAssetSort] = useState("0");
  const [assetKind, setAssetKind] = useState<"prompt" | "explanation">("prompt");
  const [assetFiles, setAssetFiles] = useState<File[]>([]);

  const [optText, setOptText] = useState("");
  const [optUrl, setOptUrl] = useState("");
  const [optCorrect, setOptCorrect] = useState(false);

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
    let mounted = true;
    try {
      const json = (await adminFetch(`/api/admin/questions/${questionId}`)) as {
        question: QuestionRow;
        assets: QuestionAssetRow[];
        options: OptionRow[];
      };
      if (!mounted) return;
      setQuestion(json.question);
      setAssets(json.assets ?? []);
      setOptions((json.options ?? []).slice().sort((a, b) => a.option_number - b.option_number));

      setType(json.question.type);
      setPoints(String(json.question.points));
      setAllowMultiple(json.question.allow_multiple);
      setPrompt(json.question.prompt_text ?? "");
      setExplanationText(json.question.explanation_text ?? "");
      setCorrectText(json.question.correct_text ?? "");
      setPassageId(json.question.passage_id ?? "");
      setTopicId(json.question.topic_id ?? "");

      const examJson = await adminFetch(`/api/admin/exams/${json.question.exam_id}`);
      if (!mounted) return;
      setExam(examJson.exam);
      setPassages(examJson.passages ?? []);

      const topicsJson = await adminFetch(`/api/admin/topics?subject_id=${examJson.exam.subject_id}`);
      if (!mounted) return;
      setTopics(topicsJson.items ?? []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setLoading(false);
    }
    return () => { mounted = false; };
  }

  useEffect(() => {
    load();
  }, [questionId]);

  async function saveQuestion() {
    const pts = Math.trunc(Number(points));
    if (!Number.isFinite(pts) || pts < 0) {
      setError("Invalid points.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const json = (await adminFetch(`/api/admin/questions/${questionId}`, {
        method: "PATCH",
        body: JSON.stringify({
          type,
          points: pts,
          allow_multiple: type === "mcq" ? allowMultiple : false,
          prompt_text: prompt.trim() || null,
          explanation_text: explanationText.trim() || null,
          correct_text: type === "fill" ? correctText.trim() : null,
          passage_id: passageId || null,
          topic_id: topicId || null,
        }),
      })) as { question: QuestionRow };
      setQuestion(json.question);
      setMessage("Saved.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuestion() {
    const ok = window.confirm("Delete this question permanently?");
    if (!ok) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await adminFetch(`/api/admin/questions/${questionId}`, { method: "DELETE" });
      router.back();
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
      const json = (await adminFetch(`/api/admin/questions/${questionId}`, {
        method: "POST",
        body: JSON.stringify({
          action: "create_asset",
          url: assetUrl.trim(),
          alt: assetAlt.trim() || null,
          kind: assetKind,
          sort_order: sortOrder,
        }),
      })) as { asset: QuestionAssetRow };
      setAssets((prev) =>
        [...prev, json.asset].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)),
      );
      setAssetUrl("");
      setAssetAlt("");
      setAssetSort("0");
      setAssetKind("prompt");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function deleteAsset(assetId: string) {
    const ok = window.confirm("Delete this asset?");
    if (!ok) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await adminFetch(`/api/admin/questions/${questionId}`, {
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

  async function addOption() {
    if (!optText.trim() && !optUrl.trim()) {
      setError("Option text or image URL is required.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const json = (await adminFetch(`/api/admin/questions/${questionId}`, {
        method: "POST",
        body: JSON.stringify({
          action: "create_option",
          text: optText.trim() || null,
          url: optUrl.trim() || null,
          is_correct: optCorrect,
        }),
      })) as { option: OptionRow };
      setOptions((prev) => [...prev, json.option].sort((a, b) => a.option_number - b.option_number));
      setOptText("");
      setOptUrl("");
      setOptCorrect(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function updateOption(optionId: string, patch: Partial<OptionRow>) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const json = (await adminFetch(`/api/admin/questions/${questionId}`, {
        method: "POST",
        body: JSON.stringify({ action: "update_option", option_id: optionId, ...patch }),
      })) as { option: OptionRow };
      setOptions((prev) => prev.map((o) => (o.id === optionId ? json.option : o)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function deleteOption(optionId: string) {
    const ok = window.confirm("Delete this option?");
    if (!ok) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await adminFetch(`/api/admin/questions/${questionId}`, {
        method: "POST",
        body: JSON.stringify({ action: "delete_option", option_id: optionId }),
      });
      setOptions((prev) => prev.filter((o) => o.id !== optionId));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  function reorderLocal(from: number, to: number) {
    setOptions((prev) => {
      if (from < 0 || from >= prev.length || to < 0 || to >= prev.length) return prev;
      const copy = prev.slice();
      const [moved] = copy.splice(from, 1);
      copy.splice(to, 0, moved);
      return copy.map((o, idx) => ({ ...o, option_number: idx + 1 }));
    });
  }

  async function saveOrder() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await adminFetch(`/api/admin/questions/${questionId}`, {
        method: "POST",
        body: JSON.stringify({ action: "reorder_options", option_ids_in_order: options.map((o) => o.id) }),
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

  return (
    <div className="max-w-full">
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border border-outline/60 shadow-soft-xl rounded-2xl mb-8 p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link
            href={question ? `/dashboard/exams/${question.exam_id}` : "/dashboard/exams"}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-on-surface hover:bg-slate-200 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </Link>
          <div>
            <h1 className="font-headline text-2xl font-black text-primary tracking-tighter">
              Edit Question
            </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary mt-1">
              {question ? `Question #${question.question_number} • ID: ${questionId.slice(0, 8)}...` : "Loading..."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={deleteQuestion}
            disabled={saving}
            className="flex-1 sm:flex-none px-6 py-3 font-black text-xs uppercase tracking-widest rounded-xl text-rose-700 bg-rose-50 border border-rose-100 hover:bg-rose-100 transition-all active:scale-95 disabled:opacity-50"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={saveQuestion}
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
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
          <div className="text-slate-400 font-black text-xs uppercase tracking-widest animate-pulse transition-all">
            Loading Builder...
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 items-start pb-24">
          <div className="xl:col-span-8 space-y-10">
            <div className="bg-white border border-outline/60 shadow-soft-xl rounded-3xl overflow-hidden">
               <div className="p-6 border-b border-outline/40 bg-slate-50/50 flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary">edit_note</span>
                  <h2 className="text-sm font-black uppercase tracking-widest text-primary">Question Content</h2>
               </div>
               <div className="p-8 space-y-8">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-3 ml-1">
                      Question Prompt
                    </label>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      rows={8}
                      className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary focus:bg-white outline-none transition-all font-medium text-lg leading-relaxed resize-none"
                    />
                    {prompt && (
                      <div className="mt-4 p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Live Preview</div>
                        <MathText text={prompt} />
                      </div>
                    )}
                  </div>

                  {type === "fill" && (
                    <div className="animate-fade-in">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-3 ml-1">
                        Correct Answer (Fill Only)
                      </label>
                      <input
                        value={correctText}
                        onChange={(e) => setCorrectText(e.target.value)}
                        className="h-14 w-full px-6 bg-emerald-50 border border-emerald-100 rounded-2xl focus:border-emerald-500 focus:bg-white outline-none transition-all font-bold text-lg text-emerald-900"
                        placeholder="Exact text for correct answer..."
                      />
                      {correctText && (
                        <div className="mt-2 p-3 bg-emerald-50/50 border border-dashed border-emerald-200 rounded-xl">
                          <MathText text={correctText} />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-4 border-t border-outline/20">
                      <div className="text-xs font-black text-primary uppercase tracking-widest mb-6 flex items-center gap-2">
                         <span className="material-symbols-outlined text-[18px]">imagesmode</span>
                         Attached Assets (Images)
                      </div>
                      
                      <div className="flex flex-wrap gap-4 mb-8">
                        {assets.map((a) => (
                           <div key={a.id} className="group relative w-24 h-24 rounded-2xl overflow-hidden border border-outline/40 shadow-sm hover:shadow-md transition-all">
                              {a.url ? (
                                <img src={a.url} alt="asset" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-slate-50 flex items-center justify-center">
                                   <span className="material-symbols-outlined text-slate-300">image</span>
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => deleteAsset(a.id)}
                                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <span className="material-symbols-outlined text-[14px]">close</span>
                              </button>
                           </div>
                        ))}
                      </div>

                      <div className="bg-slate-50 p-6 rounded-2xl space-y-4 border border-slate-100">
                        <div className="flex flex-col sm:flex-row gap-4">
                          <input
                            value={assetUrl}
                            onChange={(e) => setAssetUrl(e.target.value)}
                            placeholder="Direct image URL..."
                            className="flex-1 h-12 px-5 bg-white border border-slate-200 rounded-xl focus:border-primary outline-none transition-all text-sm font-bold"
                          />
                          <select
                             value={assetKind}
                             onChange={(e) => setAssetKind(e.target.value as "prompt" | "explanation")}
                             className="h-12 px-4 bg-white border border-slate-200 rounded-xl focus:border-primary outline-none transition-all text-xs font-black uppercase tracking-widest"
                          >
                             <option value="prompt">For Prompt</option>
                             <option value="explanation">For Explanation</option>
                          </select>
                          <button
                            type="button"
                            onClick={addAsset}
                            disabled={saving || !assetUrl.trim()}
                            className="h-12 px-6 bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all active:scale-[0.98]"
                          >
                            Add Asset
                          </button>
                        </div>
                      </div>
                  </div>
               </div>
            </div>

            <div className="bg-white border border-outline/60 shadow-soft-xl rounded-3xl overflow-hidden">
               <div className="p-6 border-b border-outline/40 bg-amber-50/50 flex items-center gap-3">
                  <span className="material-symbols-outlined text-amber-600">psychology</span>
                  <h2 className="text-sm font-black uppercase tracking-widest text-amber-700">Detailed Explanation</h2>
               </div>
               <div className="p-8">
                  <textarea
                    value={explanationText}
                    onChange={(e) => setExplanationText(e.target.value)}
                    rows={6}
                    className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl focus:border-amber-400 focus:bg-white outline-none transition-all font-medium text-base leading-relaxed resize-none"
                    placeholder="Provide a step-by-step explanation for the students..."
                  />
                  {explanationText && (
                    <div className="mt-4 p-4 bg-amber-50/30 border border-dashed border-amber-200 rounded-xl">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Live Preview</div>
                      <MathText text={explanationText} />
                    </div>
                  )}
               </div>
            </div>

            {type === "mcq" && (
              <div className="bg-white border border-outline/60 shadow-soft-xl rounded-3xl overflow-hidden animate-fade-in">
                 <div className="p-6 border-b border-outline/40 bg-indigo-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-indigo-600">checklist</span>
                      <h2 className="text-sm font-black uppercase tracking-widest text-indigo-700">Answer Options</h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={saveOrder}
                          className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-indigo-700 active:scale-95 transition-all"
                        >
                          Save Order
                        </button>
                    </div>
                 </div>
                 <div className="p-8 space-y-6">
                    {options.map((o, idx) => (
                      <div 
                        key={o.id} 
                        draggable
                        onDragStart={() => { dragFromIdx.current = idx; }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          const from = dragFromIdx.current;
                          dragFromIdx.current = null;
                          if (from === null || from === idx) return;
                          reorderLocal(from, idx);
                        }}
                        className="group relative border border-slate-100 bg-slate-50/50 rounded-2xl p-6 hover:border-indigo-200 hover:bg-white transition-all cursor-move"
                      >
                         <div className="flex items-center justify-between gap-4 mb-4">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-slate-300">drag_indicator</span>
                                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-xs">
                                   {o.option_number}
                                </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => deleteOption(o.id)}
                              className="text-slate-400 hover:text-rose-600 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[20px]">delete</span>
                            </button>
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            <div className="md:col-span-10 flex flex-col gap-4">
                              <input
                                defaultValue={o.text ?? ""}
                                onBlur={(e) => {
                                  const v = e.target.value.trim();
                                  if (v !== (o.text ?? "")) updateOption(o.id, { text: v || null });
                                }}
                                placeholder="Option text (optional if using image)"
                                className="h-12 w-full px-5 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 outline-none transition-all font-bold"
                              />
                              {(o.text ?? "") && (
                                <div className="p-2 bg-indigo-50/30 border border-dashed border-indigo-200 rounded-lg">
                                  <MathText text={o.text ?? ""} />
                                </div>
                              )}
                               <input
                                defaultValue={o.url ?? ""}
                                onBlur={(e) => {
                                  const v = e.target.value.trim();
                                  if (v !== (o.url ?? "")) updateOption(o.id, { url: v || null });
                                }}
                                placeholder="Image URL (optional)"
                                className="h-10 w-full px-5 bg-white border border-slate-100 rounded-xl focus:border-indigo-500 outline-none transition-all text-xs font-bold italic"
                              />
                            </div>
                            <div className="md:col-span-2">
                               <label className={`h-12 w-full flex items-center justify-center gap-2 border-2 rounded-xl cursor-pointer transition-all active:scale-95 ${o.is_correct ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-100 bg-white text-slate-400"}`}>
                                  <input
                                    type="checkbox"
                                    checked={o.is_correct}
                                    onChange={(e) => updateOption(o.id, { is_correct: e.target.checked })}
                                    className="hidden"
                                  />
                                  <span className="material-symbols-outlined text-[20px]">{o.is_correct ? "check_circle" : "radio_button_unchecked"}</span>
                                  <span className="text-[10px] font-black uppercase tracking-widest">Correct</span>
                               </label>
                            </div>
                         </div>
                      </div>
                    ))}
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quick Add Option</div>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                            <div className="md:col-span-10">
                                <input
                                    value={optText}
                                    onChange={(e) => setOptText(e.target.value)}
                                    placeholder="Option text..."
                                    className="h-12 w-full px-5 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 outline-none transition-all font-bold"
                                />
                            </div>
                             <div className="md:col-span-2">
                                <label className={`h-12 w-full flex items-center justify-center gap-2 border-2 rounded-xl cursor-pointer transition-all active:scale-95 ${optCorrect ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-100 bg-white text-slate-400"}`}>
                                    <input
                                        type="checkbox"
                                        checked={optCorrect}
                                        onChange={(e) => setOptCorrect(e.target.checked)}
                                        className="hidden"
                                    />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Correct</span>
                                </label>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={addOption}
                            className="w-full h-12 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-[0.98]"
                        >
                            + Add Option
                        </button>
                    </div>
                 </div>
              </div>
            )}
          </div>

          <div className="xl:col-span-4 space-y-8 sticky top-32">
             <div className="bg-white border border-outline/60 shadow-soft-xl rounded-3xl overflow-hidden">
                <div className="p-6 border-b border-outline/40 bg-slate-50 flex items-center gap-3">
                   <span className="material-symbols-outlined text-primary">tune</span>
                   <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Core Settings</h2>
                </div>
                <div className="p-8 space-y-6">
                   <div className="grid grid-cols-2 gap-4">
                      <button
                         type="button"
                         onClick={() => setType("mcq")}
                         className={`h-14 flex flex-col items-center justify-center gap-1 border-2 rounded-2xl transition-all active:scale-[0.98] ${type === "mcq" ? "border-primary bg-primary/5 text-primary" : "border-slate-100 bg-slate-50 text-slate-400"}`}
                      >
                         <span className="material-symbols-outlined">quiz</span>
                         <span className="text-[10px] font-black uppercase tracking-widest">MCQ</span>
                      </button>
                      <button
                         type="button"
                         onClick={() => setType("fill")}
                         className={`h-14 flex flex-col items-center justify-center gap-1 border-2 rounded-2xl transition-all active:scale-[0.98] ${type === "fill" ? "border-primary bg-primary/5 text-primary" : "border-slate-100 bg-slate-50 text-slate-400"}`}
                      >
                         <span className="material-symbols-outlined">stylus</span>
                         <span className="text-[10px] font-black uppercase tracking-widest">Fill</span>
                      </button>
                   </div>

                   <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-3 ml-1">Points</label>
                      <input
                        value={points}
                        onChange={(e) => setPoints(e.target.value)}
                        className="h-12 w-full px-5 bg-slate-50 border border-slate-100 rounded-xl focus:border-primary outline-none transition-all font-black text-center"
                      />
                   </div>

                   <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-3 ml-1">Mode</label>
                      <label className={`h-14 w-full flex items-center justify-center gap-3 border-2 rounded-2xl cursor-pointer transition-all ${allowMultiple ? "border-primary bg-primary/5 text-primary" : "border-slate-100 bg-slate-50 text-slate-400"}`}>
                        <input
                          type="checkbox"
                          checked={allowMultiple}
                          onChange={(e) => setAllowMultiple(e.target.checked)}
                          disabled={type !== "mcq"}
                          className="hidden"
                        />
                        <span className="material-symbols-outlined">{allowMultiple ? "check_box" : "check_box_outline_blank"}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest">Multiple Answers</span>
                      </label>
                   </div>
                </div>
             </div>

             <div className="bg-indigo-600 rounded-3xl p-8 shadow-soft-xl text-white relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-1000" />
                <div className="relative z-10 space-y-6 text-center sm:text-left">
                   <div className="flex items-center gap-3 justify-center sm:justify-start">
                      <span className="material-symbols-outlined text-white/80">view_cozy</span>
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90">Linked Content</h3>
                   </div>
                   <select
                      value={passageId}
                      onChange={(e) => setPassageId(e.target.value)}
                      className="h-12 w-full px-4 bg-white/20 border border-white/20 text-white rounded-xl focus:bg-white focus:text-indigo-900 outline-none transition-all font-bold text-sm backdrop-blur-sm cursor-pointer"
                   >
                      <option value="" className="text-gray-900">None (Independent)</option>
                      {passages.map((p) => (
                        <option key={p.id} value={p.id} className="text-gray-900">
                           {p.kind === 'reference' ? '[Reference]' : '[Reading]'} {p.title || `Passage #${p.id.slice(0, 4)}`}
                        </option>
                      ))}
                   </select>
                   <p className="text-[9px] font-bold text-white/50 bg-black/10 p-3 rounded-lg leading-relaxed">
                      Link this question to a shared reading passage or a reference block (like a math chart).
                   </p>
                </div>
             </div>

             <div className="bg-emerald-600 rounded-3xl p-8 shadow-soft-xl text-white relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-1000" />
                <div className="relative z-10 space-y-6 text-center sm:text-left">
                   <div className="flex items-center gap-3 justify-center sm:justify-start">
                      <span className="material-symbols-outlined text-white/80">category</span>
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90">Topic / Category</h3>
                   </div>
                   <select
                      value={topicId}
                      onChange={(e) => setTopicId(e.target.value)}
                      className="h-12 w-full px-4 bg-white/20 border border-white/20 text-white rounded-xl focus:bg-white focus:text-emerald-900 outline-none transition-all font-bold text-sm backdrop-blur-sm cursor-pointer"
                   >
                      <option value="" className="text-gray-900">No Specific Topic</option>
                      {topics.map((t) => (
                        <option key={t.id} value={t.id} className="text-gray-900">
                           {t.title}
                        </option>
                      ))}
                   </select>
                   <p className="text-[9px] font-bold text-white/50 bg-black/10 p-3 rounded-lg leading-relaxed">
                      Assigning a topic enables detailed performance analysis for students after submission.
                   </p>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
