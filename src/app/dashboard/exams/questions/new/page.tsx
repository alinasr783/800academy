"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import MathText from "@/components/MathText";

type ExamRow = { id: string; exam_number: number; title: string; subject_id: string; passages: PassageRow[] };
type PassageRow = { id: string; title: string | null; kind: "reading" | "reference" };
type TopicRow = { id: string; title: string };

type NewOption = {
  key: string;
  text: string;
  file: File | null;
  is_correct: boolean;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function NewQuestionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const examId = searchParams.get("examId");
  const storageBucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "assets";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  const [questionFiles, setQuestionFiles] = useState<File[]>([]);
  const [explanationFiles, setExplanationFiles] = useState<File[]>([]);
  const [options, setOptions] = useState<NewOption[]>([
    { key: uid(), text: "", file: null, is_correct: false },
    { key: uid(), text: "", file: null, is_correct: false },
    { key: uid(), text: "", file: null, is_correct: false },
    { key: uid(), text: "", file: null, is_correct: false },
  ]);

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

  useEffect(() => {
    if (!examId) {
      setError("Exam ID is missing in query parameters.");
      setLoading(false);
      return;
    }

    let mounted = true;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const json = (await adminFetch(`/api/admin/exams/${examId}`)) as { exam: ExamRow; passages: PassageRow[] };
        if (!mounted) return;
        setExam(json.exam);
        setPassages(json.passages ?? []);

        // Fetch topics filtered by exam's subject
        const topicsJson = await adminFetch(`/api/admin/topics?subject_id=${json.exam.subject_id}`);
        if (!mounted) return;
        setTopics(topicsJson.items ?? []);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Something went wrong.";
        if (!mounted) return;
        setError(msg);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    run();
    return () => {
      mounted = false;
    };
  }, [examId]);

  const correctCount = useMemo(
    () => options.filter((o) => o.is_correct).length,
    [options],
  );

  function setOptionCorrect(key: string, next: boolean) {
    setOptions((prev) => {
      if (type !== "mcq") return prev;
      if (allowMultiple) return prev.map((o) => (o.key === key ? { ...o, is_correct: next } : o));
      if (!next) return prev.map((o) => (o.key === key ? { ...o, is_correct: false } : o));
      return prev.map((o) => ({ ...o, is_correct: o.key === key }));
    });
  }

  async function submit() {
    if (!examId) return;
    const pts = Math.trunc(Number(points));
    if (!Number.isFinite(pts) || pts < 0) {
      setError("Invalid points.");
      return;
    }
    if (!prompt.trim() && questionFiles.length === 0) {
      setError("Add prompt text or at least one image.");
      return;
    }

    if (type === "fill") {
      if (!correctText.trim()) {
        setError("Correct text is required for Fill.");
        return;
      }
    } else {
      const usable = options.filter((o) => o.text.trim() || o.file);
      if (usable.length < 2) {
        setError("MCQ needs at least 2 options.");
        return;
      }
      const correct = usable.filter((o) => o.is_correct).length;
      if (correct < 1) {
        setError("Mark at least 1 correct option.");
        return;
      }
      if (!allowMultiple && correct !== 1) {
        setError("Single-answer MCQ must have exactly 1 correct option.");
        return;
      }
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const created = (await adminFetch(`/api/admin/exams/${examId}`, {
        method: "POST",
        body: JSON.stringify({
          action: "create_question",
          type,
          points: pts,
          allow_multiple: type === "mcq" ? allowMultiple : false,
          prompt_text: prompt.trim() || null,
          explanation_text: explanationText.trim() || null,
          correct_text: type === "fill" ? correctText.trim() : null,
          passage_id: passageId || null,
          topic_id: topicId || null,
        }),
      })) as { question: { id: string } };

      const questionId = created.question.id;

      for (let i = 0; i < questionFiles.length; i++) {
        const file = questionFiles[i]!;
        const safeName = file.name.replaceAll(" ", "-");
        const path = `questions/${questionId}/${Date.now()}-${i}-${safeName}`;
        const { error: upErr } = await supabase.storage.from(storageBucket).upload(path, file, {
          upsert: false,
        });
        if (upErr) throw new Error(upErr.message);

        const publicUrl = supabase.storage.from(storageBucket).getPublicUrl(path).data.publicUrl;
        await adminFetch(`/api/admin/questions/${questionId}`, {
          method: "POST",
          body: JSON.stringify({
            action: "create_asset",
            bucket: storageBucket,
            storage_path: path,
            url: publicUrl,
            alt: file.name,
            kind: "prompt",
            sort_order: i,
          }),
        });
      }

      for (let i = 0; i < explanationFiles.length; i++) {
        const file = explanationFiles[i]!;
        const safeName = file.name.replaceAll(" ", "-");
        const path = `questions/${questionId}/explanations/${Date.now()}-${i}-${safeName}`;
        const { error: upErr } = await supabase.storage.from(storageBucket).upload(path, file, {
          upsert: false,
        });
        if (upErr) throw new Error(upErr.message);

        const publicUrl = supabase.storage.from(storageBucket).getPublicUrl(path).data.publicUrl;
        await adminFetch(`/api/admin/questions/${questionId}`, {
          method: "POST",
          body: JSON.stringify({
            action: "create_asset",
            bucket: storageBucket,
            storage_path: path,
            url: publicUrl,
            alt: file.name,
            kind: "explanation",
            sort_order: i,
          }),
        });
      }

      if (type === "mcq") {
        const usable = options.filter((o) => o.text.trim() || o.file);
        for (const opt of usable) {
          let url: string | null = null;
          if (opt.file) {
            const safeName = opt.file.name.replaceAll(" ", "-");
            const path = `questions/${questionId}/options/${Date.now()}-${uid()}-${safeName}`;
            const { error: upErr } = await supabase.storage.from(storageBucket).upload(path, opt.file, {
              upsert: false,
            });
            if (upErr) throw new Error(upErr.message);
            url = supabase.storage.from(storageBucket).getPublicUrl(path).data.publicUrl;
          }

          await adminFetch(`/api/admin/questions/${questionId}`, {
            method: "POST",
            body: JSON.stringify({
              action: "create_option",
              text: opt.text.trim() || null,
              url,
              is_correct: opt.is_correct,
            }),
          });
        }
      }

      setMessage("Question created.");
      router.push(`/dashboard/exams/${examId}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-full">
      {/* Sticky Top Header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border border-outline/60 shadow-soft-xl rounded-2xl mb-8 p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/exams/${examId}`}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-on-surface hover:bg-slate-200 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </Link>
          <div>
            <h1 className="font-headline text-2xl font-black text-primary tracking-tighter">
              New Question
            </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary mt-1 truncate max-w-[200px] sm:max-w-md">
              {exam ? `#${exam.exam_number} • ${exam.title}` : `Exam ID: ${examId}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => router.push(`/dashboard/exams/${examId}`)}
            disabled={saving}
            className="flex-1 sm:flex-none px-6 py-3 font-black text-xs uppercase tracking-widest rounded-xl text-primary border border-outline hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-primary text-white px-8 py-3 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 active:scale-95"
          >
             <span className="material-symbols-outlined text-[18px]">add_task</span>
            {saving ? "Creating..." : "Create Question"}
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
          {/* Main Question Content */}
          <div className="xl:col-span-8 space-y-10">
            {/* Split View for Prompt and Assets */}
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
                      placeholder="Enter the question text here..."
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-outline/20">
                    <div>
                        <div className="text-xs font-black text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                           <span className="material-symbols-outlined text-[18px]">imagesmode</span>
                           Question Images
                        </div>
                        <div className="relative group">
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={(e) => setQuestionFiles(Array.from(e.target.files ?? []))}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                          <div className="h-24 w-full border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 group-hover:bg-slate-50 group-hover:border-primary transition-all">
                             <span className="material-symbols-outlined text-slate-400">upload_file</span>
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                               {questionFiles.length > 0 ? `${questionFiles.length} files selected` : "Select images"}
                             </span>
                          </div>
                        </div>
                    </div>
                    <div>
                        <div className="text-xs font-black text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                           <span className="material-symbols-outlined text-[18px]">lightbulb</span>
                           Explanation Images
                        </div>
                        <div className="relative group">
                          <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={(e) => setExplanationFiles(Array.from(e.target.files ?? []))}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                          <div className="h-24 w-full border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 group-hover:bg-slate-50 group-hover:border-primary transition-all">
                             <span className="material-symbols-outlined text-slate-400">upload_file</span>
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                               {explanationFiles.length > 0 ? `${explanationFiles.length} files selected` : "Select images"}
                             </span>
                          </div>
                        </div>
                    </div>
                  </div>
               </div>
            </div>

            {/* Explanation Content */}
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

            {/* MCQ Options */}
            {type === "mcq" && (
              <div className="bg-white border border-outline/60 shadow-soft-xl rounded-3xl overflow-hidden animate-fade-in">
                 <div className="p-6 border-b border-outline/40 bg-indigo-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-indigo-600">checklist</span>
                      <h2 className="text-sm font-black uppercase tracking-widest text-indigo-700">Answer Options</h2>
                    </div>
                    <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                       Correct: {correctCount}
                    </div>
                 </div>
                 <div className="p-8 space-y-6">
                    {options.map((o, idx) => (
                      <div key={o.key} className="group relative border border-slate-100 bg-slate-50/50 rounded-2xl p-6 hover:border-indigo-200 hover:bg-white transition-all">
                         <div className="flex items-center justify-between gap-4 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-xs">
                               {idx + 1}
                            </div>
                            <button
                              type="button"
                              onClick={() => setOptions((prev) => prev.filter((x) => x.key !== o.key))}
                              className="text-slate-400 hover:text-rose-600 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[20px]">delete</span>
                            </button>
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            <div className="md:col-span-10">
                              <input
                                value={o.text}
                                onChange={(e) =>
                                  setOptions((prev) =>
                                    prev.map((x) => (x.key === o.key ? { ...x, text: e.target.value } : x)),
                                  )
                                }
                                placeholder="Option text (optional if using image)"
                                className="h-12 w-full px-5 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 outline-none transition-all font-bold"
                              />
                              {o.text && (
                                <div className="mt-2 p-2 bg-indigo-50/30 border border-dashed border-indigo-200 rounded-lg">
                                  <MathText text={o.text} />
                                </div>
                              )}
                            </div>
                            <div className="md:col-span-2">
                               <label className={`h-12 w-full flex items-center justify-center gap-2 border-2 rounded-xl cursor-pointer transition-all active:scale-95 ${o.is_correct ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-100 bg-white text-slate-400"}`}>
                                  <input
                                    type="checkbox"
                                    checked={o.is_correct}
                                    onChange={(e) => setOptionCorrect(o.key, e.target.checked)}
                                    className="hidden"
                                  />
                                  <span className="material-symbols-outlined text-[20px]">{o.is_correct ? "check_circle" : "radio_button_unchecked"}</span>
                                  <span className="text-[10px] font-black uppercase tracking-widest">Correct</span>
                               </label>
                            </div>
                         </div>
                         <div className="mt-4 flex items-center gap-4">
                             <div className="relative">
                               <input
                                 type="file"
                                 accept="image/*"
                                 onChange={(e) => {
                                   const file = e.target.files?.[0] ?? null;
                                   setOptions((prev) => prev.map((x) => (x.key === o.key ? { ...x, file } : x)));
                                 }}
                                 className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                               />
                               <div className="px-4 py-2 border border-slate-200 rounded-lg bg-white flex items-center gap-2 hover:border-indigo-300 transition-colors">
                                  <span className="material-symbols-outlined text-[18px] text-slate-400">image</span>
                                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest italic">
                                     {o.file ? o.file.name : "Attach Image"}
                                  </span>
                               </div>
                             </div>
                         </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setOptions((prev) => [...prev, { key: uid(), text: "", file: null, is_correct: false }])}
                      className="w-full h-12 border-2 border-dashed border-slate-200 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-50 hover:border-indigo-300 hover:text-indigo-600 transition-all"
                    >
                      + Add Another Option
                    </button>
                 </div>
              </div>
            )}
          </div>

          {/* Configuration Sidebar */}
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
                           {p.kind === 'reference' ? '[Reference]' : '[Reading]'} {p.title || `#${p.id.slice(0, 4)}`}
                        </option>
                      ))}
                   </select>
                   <p className="text-[9px] font-bold text-white/50 bg-black/10 p-3 rounded-lg leading-relaxed">
                      Link this question to a shared reading passage or a reference block (like a math chart).
                   </p>
                </div>
             </div>

             {/* Topic Selection */}
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

export default function DashboardNewQuestion() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24 text-slate-400 font-bold uppercase tracking-widest animate-pulse">Initializing...</div>}>
      <NewQuestionContent />
    </Suspense>
  );
}
