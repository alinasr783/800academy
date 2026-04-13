"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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
  created_at: string;
  updated_at: string;
};

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
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [type, setType] = useState<"mcq" | "fill">("mcq");
  const [points, setPoints] = useState("1");
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [correctText, setCorrectText] = useState("");
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
    try {
      const json = (await adminFetch(`/api/admin/questions/${questionId}`)) as {
        question: QuestionRow;
        assets: QuestionAssetRow[];
        options: OptionRow[];
      };
      setQuestion(json.question);
      setAssets(json.assets ?? []);
      setOptions((json.options ?? []).slice().sort((a, b) => a.option_number - b.option_number));

      setType(json.question.type);
      setPoints(String(json.question.points));
      setAllowMultiple(json.question.allow_multiple);
      setPrompt(json.question.prompt_text ?? "");
      setExplanationText(json.question.explanation_text ?? "");
      setCorrectText(json.question.correct_text ?? "");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setLoading(false);
    }
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
          correct_text: type === "fill" ? correctText.trim() || null : null,
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

  async function uploadAssets() {
    if (assetFiles.length === 0) {
      setError("Select one or more files.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const existing = assets.filter((a) => (a.kind ?? "prompt") === assetKind);
      const baseSort = existing.length ? Math.max(...existing.map((a) => a.sort_order ?? 0)) + 1 : 0;

      for (let i = 0; i < assetFiles.length; i++) {
        const file = assetFiles[i]!;
        const safeName = file.name.replaceAll(" ", "-");
        const path = `questions/${questionId}/${assetKind}/${Date.now()}-${i}-${safeName}`;
        const { error: upErr } = await supabase.storage.from(storageBucket).upload(path, file, { upsert: false });
        if (upErr) throw new Error(upErr.message);
        const publicUrl = supabase.storage.from(storageBucket).getPublicUrl(path).data.publicUrl;

        const json = (await adminFetch(`/api/admin/questions/${questionId}`, {
          method: "POST",
          body: JSON.stringify({
            action: "create_asset",
            bucket: storageBucket,
            storage_path: path,
            url: publicUrl,
            alt: file.name,
            kind: assetKind,
            sort_order: baseSort + i,
          }),
        })) as { asset: QuestionAssetRow };

        setAssets((prev) => [...prev, json.asset]);
      }

      setAssetFiles([]);
      setMessage("Assets uploaded.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function updateAsset(assetId: string, patch: Partial<QuestionAssetRow>) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const json = (await adminFetch(`/api/admin/questions/${questionId}`, {
        method: "POST",
        body: JSON.stringify({ action: "update_asset", asset_id: assetId, ...patch }),
      })) as { asset: QuestionAssetRow };
      setAssets((prev) => prev.map((a) => (a.id === assetId ? json.asset : a)));
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

  const header = useMemo(() => {
    if (!question) return questionId;
    return `Q${question.question_number} • ${question.type.toUpperCase()} • ${question.points} pts`;
  }, [question, questionId]);

  const promptAssets = useMemo(() => assets.filter((a) => a.kind !== "explanation"), [assets]);
  const explanationAssets = useMemo(() => assets.filter((a) => a.kind === "explanation"), [assets]);

  return (
    <div className="bg-white border border-outline/60 shadow-soft-xl overflow-hidden">
      <div className="p-8 border-b border-outline/40">
        <div className="flex items-start justify-between gap-8">
          <div>
            <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
              Question
            </div>
            <h1 className="font-headline text-4xl font-extrabold text-primary tracking-tighter">
              Question Builder
            </h1>
            <p className="text-on-surface-variant font-medium mt-3">{header}</p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={deleteQuestion}
              disabled={saving}
              className="bg-white text-rose-700 border border-rose-200 px-6 py-3 font-bold text-sm hover:bg-rose-50 transition-all disabled:opacity-60"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={saveQuestion}
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
              <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Prompt</div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={7}
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
                Explanation
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
                Question assets
              </div>
              <div className="text-xs text-on-surface-variant font-medium mb-4">
                Upload images to Supabase Storage ({storageBucket}) or use a direct URL.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-6">
                  <select
                    value={assetKind}
                    onChange={(e) => setAssetKind(e.target.value === "explanation" ? "explanation" : "prompt")}
                    className="h-12 w-full px-4 bg-white border border-outline/60 focus:border-primary outline-none transition-colors"
                  >
                    <option value="prompt">Prompt</option>
                    <option value="explanation">Explanation</option>
                  </select>
                </div>
                <div className="md:col-span-6">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => setAssetFiles(Array.from(e.target.files ?? []))}
                    className="h-12 w-full px-4 bg-white border border-outline/60 focus:border-primary outline-none transition-colors"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={uploadAssets}
                disabled={saving || assetFiles.length === 0}
                className="mt-3 h-12 w-full bg-primary text-white font-bold text-sm hover:bg-slate-800 transition-colors disabled:opacity-60"
              >
                Upload selected images
              </button>
              <div className="my-6 border-t border-outline/40" />
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-7">
                  <input
                    value={assetUrl}
                    onChange={(e) => setAssetUrl(e.target.value)}
                    placeholder="https://..."
                    className="h-12 w-full px-4 bg-white border border-outline/60 focus:border-primary outline-none transition-colors"
                  />
                </div>
                <div className="md:col-span-3">
                  <input
                    value={assetAlt}
                    onChange={(e) => setAssetAlt(e.target.value)}
                    placeholder="Alt"
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
              </div>
              <button
                type="button"
                onClick={addAsset}
                disabled={saving}
                className="mt-3 h-12 w-full bg-white text-primary border border-outline font-bold text-sm hover:bg-surface-variant transition-all disabled:opacity-60"
              >
                Add asset by URL
              </button>
              <div className="mt-5 space-y-3">
                {promptAssets
                  .slice()
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((a) => (
                    <div key={a.id} className="bg-white border border-outline/40 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold text-primary break-all">
                            {a.url || a.storage_path || a.id}
                          </div>
                          <div className="text-xs text-on-surface-variant font-medium mt-1">
                            Kind: {a.kind} • Sort: {a.sort_order}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteAsset(a.id)}
                          disabled={saving}
                          className="text-sm font-bold text-rose-700 hover:text-rose-900 transition-colors disabled:opacity-60"
                        >
                          Delete
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-4">
                        <div className="md:col-span-7">
                          <input
                            defaultValue={a.url ?? ""}
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              if (v !== (a.url ?? "")) updateAsset(a.id, { url: v || null });
                            }}
                            placeholder="URL"
                            className="h-10 w-full px-3 bg-background border border-border/60 focus:border-primary outline-none transition-colors text-sm"
                          />
                        </div>
                        <div className="md:col-span-3">
                          <input
                            defaultValue={a.alt ?? ""}
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              if (v !== (a.alt ?? "")) updateAsset(a.id, { alt: v || null });
                            }}
                            placeholder="Alt"
                            className="h-10 w-full px-3 bg-background border border-border/60 focus:border-primary outline-none transition-colors text-sm"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <input
                            defaultValue={String(a.sort_order)}
                            onBlur={(e) => {
                              const n = Math.trunc(Number(e.target.value));
                              if (!Number.isFinite(n) || n === a.sort_order) return;
                              updateAsset(a.id, { sort_order: n });
                            }}
                            placeholder="Sort"
                            className="h-10 w-full px-3 bg-background border border-border/60 focus:border-primary outline-none transition-colors text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                {explanationAssets.length ? (
                  <div className="pt-2">
                    <div className="text-xs font-bold text-primary uppercase tracking-widest mb-3">
                      Explanation assets
                    </div>
                    <div className="space-y-3">
                      {explanationAssets
                        .slice()
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((a) => (
                          <div key={a.id} className="bg-white border border-outline/40 p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="text-sm font-extrabold text-primary break-all">
                                  {a.url || a.storage_path || a.id}
                                </div>
                                <div className="text-xs text-on-surface-variant font-medium mt-1">
                                  Kind: {a.kind} • Sort: {a.sort_order}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => deleteAsset(a.id)}
                                disabled={saving}
                                className="text-sm font-bold text-rose-700 hover:text-rose-900 transition-colors disabled:opacity-60"
                              >
                                Delete
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-4">
                              <div className="md:col-span-7">
                                <input
                                  defaultValue={a.url ?? ""}
                                  onBlur={(e) => {
                                    const v = e.target.value.trim();
                                    if (v !== (a.url ?? "")) updateAsset(a.id, { url: v || null });
                                  }}
                                  placeholder="URL"
                                  className="h-10 w-full px-3 bg-background border border-border/60 focus:border-primary outline-none transition-colors text-sm"
                                />
                              </div>
                              <div className="md:col-span-3">
                                <input
                                  defaultValue={a.alt ?? ""}
                                  onBlur={(e) => {
                                    const v = e.target.value.trim();
                                    if (v !== (a.alt ?? "")) updateAsset(a.id, { alt: v || null });
                                  }}
                                  placeholder="Alt"
                                  className="h-10 w-full px-3 bg-background border border-border/60 focus:border-primary outline-none transition-colors text-sm"
                                />
                              </div>
                              <div className="md:col-span-2">
                                <input
                                  defaultValue={String(a.sort_order)}
                                  onBlur={(e) => {
                                    const n = Math.trunc(Number(e.target.value));
                                    if (!Number.isFinite(n) || n === a.sort_order) return;
                                    updateAsset(a.id, { sort_order: n });
                                  }}
                                  placeholder="Sort"
                                  className="h-10 w-full px-3 bg-background border border-border/60 focus:border-primary outline-none transition-colors text-sm"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="bg-surface-variant border border-outline/40 p-6">
              <div className="text-xs font-bold text-primary uppercase tracking-widest mb-4">
                Add option
              </div>
              <div className="space-y-3">
                <input
                  value={optText}
                  onChange={(e) => setOptText(e.target.value)}
                  placeholder="Option text"
                  disabled={type !== "mcq"}
                  className="h-12 w-full px-4 bg-white border border-outline/60 focus:border-primary outline-none transition-colors disabled:opacity-60"
                />
                <input
                  value={optUrl}
                  onChange={(e) => setOptUrl(e.target.value)}
                  placeholder="Option image URL"
                  disabled={type !== "mcq"}
                  className="h-12 w-full px-4 bg-white border border-outline/60 focus:border-primary outline-none transition-colors disabled:opacity-60"
                />
                <label className="flex items-center gap-3 text-sm font-bold text-primary">
                  <input
                    type="checkbox"
                    checked={optCorrect}
                    onChange={(e) => setOptCorrect(e.target.checked)}
                    disabled={type !== "mcq"}
                    className="h-4 w-4"
                  />
                  Mark as correct
                </label>
                <button
                  type="button"
                  onClick={addOption}
                  disabled={saving || type !== "mcq"}
                  className="h-12 w-full bg-primary text-white font-bold text-sm hover:bg-slate-800 transition-colors disabled:opacity-60"
                >
                  Add option
                </button>
              </div>
            </div>

            <div className="bg-white border border-outline/60 shadow-soft-xl overflow-hidden">
              <div className="p-5 border-b border-outline/40 flex items-center justify-between gap-4">
                <div className="text-xs font-bold text-primary uppercase tracking-widest">
                  Options ({options.length})
                </div>
                <button
                  type="button"
                  onClick={saveOrder}
                  disabled={saving || options.length === 0 || type !== "mcq"}
                  className="h-10 px-4 bg-secondary text-white font-bold text-xs hover:bg-primary transition-colors disabled:opacity-60"
                >
                  Save order
                </button>
              </div>
              {type !== "mcq" ? (
                <div className="p-6 text-on-surface-variant font-medium">Options are for MCQ only.</div>
              ) : options.length === 0 ? (
                <div className="p-6 text-on-surface-variant font-medium">No options yet.</div>
              ) : (
                <div className="divide-y divide-outline/40">
                  {options.map((o, idx) => (
                    <div
                      key={o.id}
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
                          <div className="text-sm font-extrabold text-primary">#{idx + 1}</div>
                          <div className="text-xs text-on-surface-variant font-medium mt-2 break-all">
                            {o.text || o.url || "—"}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 text-sm font-bold text-primary">
                            <input
                              type="checkbox"
                              checked={o.is_correct}
                              onChange={(e) => updateOption(o.id, { is_correct: e.target.checked })}
                              className="h-4 w-4"
                            />
                            Correct
                          </label>
                          <button
                            type="button"
                            onClick={() => deleteOption(o.id)}
                            disabled={saving}
                            className="text-sm font-bold text-rose-700 hover:text-rose-900 transition-colors disabled:opacity-60"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-4">
                        <div className="md:col-span-7">
                          <input
                            defaultValue={o.text ?? ""}
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              if (v !== (o.text ?? "")) updateOption(o.id, { text: v || null });
                            }}
                            placeholder="Text"
                            className="h-10 w-full px-3 bg-background border border-border/60 focus:border-primary outline-none transition-colors text-sm"
                          />
                        </div>
                        <div className="md:col-span-5">
                          <input
                            defaultValue={o.url ?? ""}
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              if (v !== (o.url ?? "")) updateOption(o.id, { url: v || null });
                            }}
                            placeholder="Image URL"
                            className="h-10 w-full px-3 bg-background border border-border/60 focus:border-primary outline-none transition-colors text-sm"
                          />
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
