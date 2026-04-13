"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ExamRow = { id: string; exam_number: number; title: string; subject_id: string };

type NewOption = {
  key: string;
  text: string;
  file: File | null;
  is_correct: boolean;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function DashboardNewQuestion() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const examId = params.id;
  const storageBucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "assets";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exam, setExam] = useState<ExamRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [type, setType] = useState<"mcq" | "fill">("mcq");
  const [points, setPoints] = useState("1");
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [correctText, setCorrectText] = useState("");
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
    let mounted = true;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const json = (await adminFetch(`/api/admin/exams/${examId}`)) as { exam: ExamRow };
        if (!mounted) return;
        setExam(json.exam);
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
    <div className="bg-white border border-outline/60 shadow-soft-xl overflow-hidden">
      <div className="p-8 border-b border-outline/40">
        <div className="flex items-start justify-between gap-8">
          <div>
            <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
              Exam
            </div>
            <h1 className="font-headline text-4xl font-extrabold text-primary tracking-tighter">
              Add Question
            </h1>
            <p className="text-on-surface-variant font-medium mt-3">
              {exam ? `#${exam.exam_number} • ${exam.title}` : examId}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.push(`/dashboard/exams/${examId}`)}
              disabled={saving}
              className="bg-white text-primary border border-outline px-6 py-3 font-bold text-sm hover:bg-surface-variant transition-all disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="bg-primary text-white px-6 py-3 font-bold text-sm hover:bg-slate-800 transition-all disabled:opacity-60"
            >
              Create
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
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-4">
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Type</div>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value === "fill" ? "fill" : "mcq")}
                  className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
                >
                  <option value="mcq">MCQ</option>
                  <option value="fill">Fill</option>
                </select>
              </div>
              <div className="md:col-span-4">
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Points</div>
                <input
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
                />
              </div>
              <div className="md:col-span-4">
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">
                  Options mode
                </div>
                <label className="h-12 w-full flex items-center gap-3 px-4 bg-background border border-border/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowMultiple}
                    onChange={(e) => setAllowMultiple(e.target.checked)}
                    disabled={type !== "mcq"}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-bold text-primary">
                    {type === "mcq" ? "Allow multiple" : "—"}
                  </span>
                </label>
              </div>
            </div>

            <div>
              <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">
                Prompt (text)
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={8}
                className="w-full px-4 py-3 bg-background border border-border/60 focus:border-primary outline-none transition-colors resize-none"
              />
            </div>

            {type === "fill" ? (
              <div>
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">
                  Correct text
                </div>
                <input
                  value={correctText}
                  onChange={(e) => setCorrectText(e.target.value)}
                  className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
                />
              </div>
            ) : null}

            <div>
              <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">
                Explanation (text)
              </div>
              <textarea
                value={explanationText}
                onChange={(e) => setExplanationText(e.target.value)}
                rows={6}
                className="w-full px-4 py-3 bg-background border border-border/60 focus:border-primary outline-none transition-colors resize-none"
              />
            </div>

            <div className="bg-surface-variant border border-outline/40 p-6">
              <div className="text-xs font-bold text-primary uppercase tracking-widest mb-4">
                Question images
              </div>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => setQuestionFiles(Array.from(e.target.files ?? []))}
                className="h-12 w-full px-4 bg-white border border-outline/60 focus:border-primary outline-none transition-colors"
              />
              <div className="text-xs text-on-surface-variant font-medium mt-2">
                Bucket: {storageBucket}
              </div>
            </div>

            <div className="bg-surface-variant border border-outline/40 p-6">
              <div className="text-xs font-bold text-primary uppercase tracking-widest mb-4">
                Explanation images
              </div>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => setExplanationFiles(Array.from(e.target.files ?? []))}
                className="h-12 w-full px-4 bg-white border border-outline/60 focus:border-primary outline-none transition-colors"
              />
              <div className="text-xs text-on-surface-variant font-medium mt-2">
                Bucket: {storageBucket}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-outline/60 shadow-soft-xl overflow-hidden">
              <div className="p-5 border-b border-outline/40 flex items-center justify-between gap-4">
                <div className="text-xs font-bold text-primary uppercase tracking-widest">
                  Options
                </div>
                <div className="text-xs text-on-surface-variant font-medium">
                  Correct: {correctCount}
                </div>
              </div>
              {type !== "mcq" ? (
                <div className="p-6 text-on-surface-variant font-medium">Options are for MCQ only.</div>
              ) : (
                <div className="p-6 space-y-4">
                  {options.map((o, idx) => (
                    <div key={o.key} className="border border-outline/40 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="text-sm font-extrabold text-primary">Option {idx + 1}</div>
                        <button
                          type="button"
                          onClick={() => setOptions((prev) => prev.filter((x) => x.key !== o.key))}
                          className="text-sm font-bold text-rose-700 hover:text-rose-900 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-4">
                        <div className="md:col-span-8">
                          <input
                            value={o.text}
                            onChange={(e) =>
                              setOptions((prev) =>
                                prev.map((x) => (x.key === o.key ? { ...x, text: e.target.value } : x)),
                              )
                            }
                            placeholder="Text (optional)"
                            className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
                          />
                        </div>
                        <div className="md:col-span-4">
                          <label className="h-12 w-full flex items-center gap-3 px-4 bg-background border border-border/60 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={o.is_correct}
                              onChange={(e) => setOptionCorrect(o.key, e.target.checked)}
                              className="h-4 w-4"
                            />
                            <span className="text-sm font-bold text-primary">Correct</span>
                          </label>
                        </div>
                      </div>
                      <div className="mt-3">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            setOptions((prev) =>
                              prev.map((x) => (x.key === o.key ? { ...x, file } : x)),
                            );
                          }}
                          className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
                        />
                        <div className="text-xs text-on-surface-variant font-medium mt-2">
                          Image is optional. You can use text, image, or both.
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() =>
                      setOptions((prev) => [...prev, { key: uid(), text: "", file: null, is_correct: false }])
                    }
                    className="h-12 w-full bg-secondary text-white font-bold text-sm hover:bg-primary transition-colors"
                  >
                    Add option
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
