"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import MathText from "@/components/MathText";
import LoadingAnimation from "@/components/LoadingAnimation";

type BankQuestionRow = {
  id: string;
  type: "mcq" | "fill" | "reference_block";
  prompt_text: string | null;
  explanation_text: string | null;
  points: number;
  allow_multiple: boolean;
  correct_text: string | null;
  topic_id: string | null;
  subtopic_id: string | null;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
};

type SubQuestion = {
  id?: string;
  key: string;
  type: "mcq" | "fill";
  prompt: string;
  explanation: string;
  points: string;
  options: NewOption[];
  correctText: string;
  topicId: string;
  subtopicId: string;
  questionFiles: File[];
  explanationFiles: File[];
  existingAssets?: BankAssetRow[];
};

type NewOption = {
  id?: string;
  key: string;
  text: string;
  file: File | null;
  is_correct: boolean;
  url?: string | null;
};

type TopicRow = { id: string; title: string };
type SubtopicRow = { id: string; topic_id: string; title: string };
type SubjectRow = { id: string; title: string };

type BankAssetRow = {
  id: string;
  question_id: string;
  bucket: string;
  storage_path: string | null;
  url: string | null;
  alt: string | null;
  kind: "prompt" | "explanation";
  sort_order: number;
};

type BankOptionRow = {
  id: string;
  question_id: string;
  option_number: number;
  text: string | null;
  bucket: string;
  storage_path: string | null;
  url: string | null;
  is_correct: boolean;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const SubQuestionInput = memo(({ 
  sub, index, topics, allSubtopics, onUpdate, onRemove, onReorder 
}: any) => {
  const filteredSubtopics = allSubtopics.filter((st: any) => st.topic_id === sub.topicId);

  return (
    <div className="bg-white border-2 border-outline/40 shadow-soft-xl rounded-3xl overflow-hidden group/sub">
      <div className="p-4 border-b border-outline/30 bg-slate-50 flex items-center justify-between">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center font-black text-xs">{index + 1}</div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">Edit Sub-Question Item</h3>
         </div>
         <div className="flex items-center gap-2">
            <button type="button" onClick={() => onReorder(sub.key, 'up')} disabled={index === 0} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-outline/40 text-slate-400 hover:text-primary disabled:opacity-30 transition-all">
               <span className="material-symbols-outlined text-[18px]">keyboard_arrow_up</span>
            </button>
            <button type="button" onClick={() => onReorder(sub.key, 'down')} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-outline/40 text-slate-400 hover:text-primary transition-all">
               <span className="material-symbols-outlined text-[18px]">keyboard_arrow_down</span>
            </button>
            <button type="button" onClick={() => onRemove(sub.key)} className="ml-2 w-8 h-8 flex items-center justify-center rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 transition-all">
               <span className="material-symbols-outlined text-[18px]">delete</span>
            </button>
         </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2">
        <div className="p-6 space-y-8 border-r border-outline/20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1 ml-1">Type</label>
                <select value={sub.type} onChange={(e) => onUpdate(sub.key, { type: e.target.value })} className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary transition-all">
                  <option value="mcq">MCQ</option>
                  <option value="fill">Fill In Blank</option>
                </select>
             </div>
             <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1 ml-1">Points</label>
                <input type="number" value={sub.points} onChange={(e) => onUpdate(sub.key, { points: e.target.value })} className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary text-center transition-all" />
             </div>
          </div>
          <div className="space-y-4">
             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Sub-Question Prompt</label>
             <textarea value={sub.prompt} onChange={(e) => onUpdate(sub.key, { prompt: e.target.value })} rows={4} placeholder="Write the prompt... (Supports LaTeX/HTML)" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:border-primary transition-all" />
             <div className="space-y-2">
                <div className="flex items-center justify-between">
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Images</label>
                   <div className="relative">
                      <input type="file" multiple accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => onUpdate(sub.key, { questionFiles: [...(sub.questionFiles || []), ...Array.from(e.target.files || [])] })} />
                      <button type="button" className="text-[9px] font-black text-primary uppercase">+ Add Images</button>
                   </div>
                </div>
                <div 
                   onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-primary/5', 'border-primary'); }}
                   onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('bg-primary/5', 'border-primary'); }}
                   onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('bg-primary/5', 'border-primary');
                      const files = Array.from(e.dataTransfer.files);
                      onUpdate(sub.key, { questionFiles: [...(sub.questionFiles || []), ...files] });
                   }}
                   className="min-h-[80px] p-2 border-2 border-dashed border-slate-200 rounded-2xl flex flex-wrap gap-2 transition-all"
                >
                   {sub.existingAssets?.filter((a: any) => a.kind === 'prompt').map((a: any) => (
                      <div key={a.id} className="relative h-16 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden group/ex inline-block w-20">
                         <img src={a.url || ''} className="w-full h-full object-cover" alt="asset" />
                      </div>
                   ))}
                   {sub.questionFiles?.map((f: File, i: number) => (
                      <div key={i} className="relative h-16 bg-primary/5 border border-primary/20 rounded-xl overflow-hidden inline-block w-20 group/new">
                         <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" alt="new" />
                         <button type="button" onClick={() => {
                           const next = [...sub.questionFiles];
                           next.splice(i, 1);
                           onUpdate(sub.key, { questionFiles: next });
                         }} className="absolute top-1 right-1 bg-rose-500 text-white rounded w-4 h-4 flex items-center justify-center opacity-0 group-hover/new:opacity-100 transition-all"><span className="material-symbols-outlined text-[12px]">close</span></button>
                      </div>
                   ))}
                   {!sub.existingAssets?.length && !sub.questionFiles?.length && (
                      <div className="w-full flex items-center justify-center text-[8px] font-black text-slate-300 uppercase tracking-widest">Drop images here</div>
                   )}
                </div>
             </div>
          </div>
          {sub.type === "mcq" ? (
             <div className="space-y-4">
                <div className="flex items-center justify-between">
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Options</label>
                   <button type="button" onClick={() => onUpdate(sub.key, { options: [...sub.options, { key: uid(), text: "", file: null, is_correct: false }] })} className="text-[9px] font-black text-primary uppercase">+ Add Option</button>
                </div>
                {sub.options.map((opt: any, oIdx: number) => (
                   <div key={opt.key} className="bg-slate-50 p-4 rounded-2xl space-y-3 border border-slate-200">
                      <div className="flex items-center justify-between">
                         <span className="text-xs font-black text-slate-400">{String.fromCharCode(65 + oIdx)}</span>
                         <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                               <input type="checkbox" checked={opt.is_correct} onChange={(e) => onUpdate(sub.key, { options: sub.options.map((o: any) => o.key === opt.key ? { ...o, is_correct: e.target.checked } : o) })} />
                               <span className="text-[9px] font-black text-slate-500 uppercase">Correct</span>
                            </label>
                            <button type="button" onClick={() => onUpdate(sub.key, { options: sub.options.filter((o: any) => o.key !== opt.key) })} className="text-rose-500 hover:bg-rose-50 rounded p-1 transition-all">
                               <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                         </div>
                      </div>
                      <textarea value={opt.text} onChange={(e) => onUpdate(sub.key, { options: sub.options.map((o: any) => o.key === opt.key ? { ...o, text: e.target.value } : o) })} className="w-full px-3 py-2 bg-white border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-primary transition-all" placeholder="Option text..." />
                      <div className="relative">
                         <input type="file" accept="image/*" onChange={(e) => onUpdate(sub.key, { options: sub.options.map((o: any) => o.key === opt.key ? { ...o, file: e.target.files?.[0] || null } : o) })} className="absolute inset-0 opacity-0 cursor-pointer" />
                         <div className={`h-8 px-3 border border-dashed rounded-lg flex items-center gap-2 text-[10px] font-black transition-all ${opt.file || opt.url ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-200 text-slate-400'}`}>
                            <span className="material-symbols-outlined text-[16px]">add_photo_alternate</span>
                            <span className="truncate">{opt.file ? opt.file.name : opt.url ? 'Image Uploaded' : 'Add Image'}</span>
                         </div>
                      </div>
                   </div>
                ))}
             </div>
          ) : (
             <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Correct Answer</label>
                <input value={sub.correctText} onChange={(e) => onUpdate(sub.key, { correctText: e.target.value })} className="w-full h-11 px-4 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-black text-emerald-900 outline-none focus:border-emerald-500 transition-all" placeholder="Correct text..." />
             </div>
          )}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-outline/20">
             <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Topic</label>
                <select value={sub.topicId} onChange={(e) => onUpdate(sub.key, { topicId: e.target.value, subtopicId: "" })} className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold">
                   <option value="">Select Topic</option>
                   {topics.map((t: any) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
             </div>
             <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Subtopic</label>
                <select value={sub.subtopicId} onChange={(e) => onUpdate(sub.key, { subtopicId: e.target.value })} className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold">
                   <option value="">Select Subtopic</option>
                   {filteredSubtopics.map((st: any) => <option key={st.id} value={st.id}>{st.title}</option>)}
                </select>
             </div>
          </div>
        </div>
        
        <div className="p-8 bg-slate-50/50 flex flex-col items-center">
           <div className="w-full max-w-sm bg-white border border-outline/30 shadow-soft-xl rounded-[32px] p-8 space-y-6">
              <div className="text-[10px] font-black text-primary/40 uppercase tracking-[0.2em]">Live Preview #{index + 1}</div>
              <div className="text-base font-medium leading-relaxed">
                 <MathText text={sub.prompt || "Question prompt..."} />
              </div>
              <div className="space-y-4">
                 {sub.existingAssets?.filter((a: any) => a.kind === 'prompt').map((a: any) => (
                    <img key={a.id} src={a.url || ''} className="max-w-full h-auto rounded-2xl border border-outline/20 mx-auto" alt="Sub prompt" />
                 ))}
                 {sub.questionFiles?.map((f: File, i: number) => (
                    <img key={i} src={URL.createObjectURL(f)} className="max-w-full h-auto rounded-2xl border border-primary/20 mx-auto" alt="Sub prompt new" />
                 ))}
              </div>
              {sub.type === 'mcq' ? (
                 <div className="space-y-3">
                    {sub.options.map((opt: any, i: number) => (
                       <div key={opt.key} className="flex items-center gap-4 p-4 border border-outline/30 rounded-2xl bg-white shadow-sm">
                          <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-xs font-black text-slate-400 border border-outline/10">{String.fromCharCode(65 + i)}</div>
                          <div className="flex-1">
                             <div className="text-sm font-bold text-slate-700 leading-tight"><MathText text={opt.text} /></div>
                             {(opt.file || opt.url) && <img src={opt.file ? URL.createObjectURL(opt.file) : opt.url} className="mt-2 max-w-full h-20 object-contain rounded-lg border border-outline/10" alt="Opt" />}
                          </div>
                       </div>
                    ))}
                 </div>
              ) : (
                 <div className="px-4 py-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">Input Area Preview</div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
});

export default function BankQuestionEditor() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const questionId = params.id === "new" ? null : params.id;
  const storageBucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "assets";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [allSubtopics, setAllSubtopics] = useState<SubtopicRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Form State
  const [type, setType] = useState<"mcq" | "fill" | "reference_block">("mcq");
  const [points, setPoints] = useState("1");
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [correctText, setCorrectText] = useState("");
  const [topicId, setTopicId] = useState("");
  const [subtopicId, setSubtopicId] = useState("");
  const [explanationText, setExplanationText] = useState("");
  const [subQuestions, setSubQuestions] = useState<SubQuestion[]>([]);
  const [assets, setAssets] = useState<BankAssetRow[]>([]);
  const [options, setOptions] = useState<NewOption[]>([]);
  const [backgroundTasks, setBackgroundTasks] = useState<{ id: string, status: 'saving' | 'done' | 'error' }[]>([]);

  const resetForm = useCallback(() => {
    setType("mcq");
    setPoints("1");
    setAllowMultiple(false);
    setPrompt("");
    setExplanationText("");
    setCorrectText("");
    // We keep topicId and subtopicId as they might want to enter multiple questions in same topic
    setSubQuestions([]);
    setAssets([]);
    setPromptFiles([]);
    setExplanationFiles([]);
    setOptions([
      { key: uid(), text: "", file: null, is_correct: false },
      { key: uid(), text: "", file: null, is_correct: false },
      { key: uid(), text: "", file: null, is_correct: false },
      { key: uid(), text: "", file: null, is_correct: false },
    ]);
  }, []);

  useEffect(() => {
    if (!questionId) {
      setOptions([
        { key: uid(), text: "", file: null, is_correct: false },
        { key: uid(), text: "", file: null, is_correct: false },
        { key: uid(), text: "", file: null, is_correct: false },
        { key: uid(), text: "", file: null, is_correct: false },
      ]);
    }
  }, [questionId]);

  // Asset Uploads
  const [promptFiles, setPromptFiles] = useState<File[]>([]);
  const [explanationFiles, setExplanationFiles] = useState<File[]>([]);

  async function adminFetch(path: string, init?: RequestInit) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("Not authenticated.");
    const res = await fetch(path, {
      ...init,
      headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "Request failed");
    return json;
  }

  async function load() {
    setLoading(true);
    try {
      // Fetch all topics and subtopics for the bank (since package filter is removed)
      const topicsJson = await adminFetch("/api/admin/topics?limit=1000");
      setTopics(topicsJson.items || []);
      const subtopicsJson = await adminFetch("/api/admin/subtopics?limit=2000");
      setAllSubtopics(subtopicsJson.items || []);

      if (questionId) {
        const json = await adminFetch(`/api/admin/question-bank/${questionId}`);
        const q = json.question;
        console.log("[BankQuestionEditor] Loaded Question Data:", q);
        
        setType(q.type);
        setPoints(String(q.points));
        setAllowMultiple(q.allow_multiple);
        setPrompt(q.prompt_text ?? "");
        setExplanationText(q.explanation_text ?? "");
        setCorrectText(q.correct_text ?? "");
        setTopicId(q.topic_id ?? "");
        setSubtopicId(q.subtopic_id ?? "");
        setAssets(q.question_bank_assets || []);
        
        const opts = (q.question_bank_options || []).map((o: any) => ({ ...o, key: uid() }));
        console.log("[BankQuestionEditor] Mapped Options:", opts);
        setOptions(opts);

        if (q.type === 'reference_block') {
           const { data: subs } = await supabase.from('question_bank').select('*').eq('parent_id', questionId).order('created_at', { ascending: true });
           if (subs) {
              const subIds = subs.map(s => s.id);
              const [{ data: allOpts }, { data: allAssets }] = await Promise.all([
                 supabase.from('question_bank_options').select('*').in('question_id', subIds),
                 supabase.from('question_bank_assets').select('*').in('question_id', subIds)
              ]);
              const mapped = subs.map(s => ({
                 id: s.id,
                 key: uid(),
                 type: s.type as any,
                 prompt: s.prompt_text ?? "",
                 explanation: s.explanation_text ?? "",
                 points: String(s.points),
                 correctText: s.correct_text ?? "",
                 topicId: s.topic_id ?? "",
                 subtopicId: s.subtopic_id ?? "",
                 options: (allOpts || []).filter(o => o.question_id === s.id).map(o => ({ ...o, key: uid() })),
                 existingAssets: (allAssets || []).filter(a => a.question_id === s.id),
                 questionFiles: [], explanationFiles: []
              }));
              setSubQuestions(mapped);
           }
        }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [questionId]);

  const [isDragging, setIsDragging] = useState(false);
  const handleDrop = (e: React.DragEvent, target: 'prompt' | 'explanation') => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (target === 'prompt') setPromptFiles([...promptFiles, ...files]);
    else setExplanationFiles([...explanationFiles, ...files]);
  };

  async function save() {
    const isNew = !questionId;
    
    // Capture current form state for background save if new
    const capturedState = {
      type, points, allowMultiple, prompt, explanationText, correctText, topicId, subtopicId,
      options: [...options], subQuestions: [...subQuestions],
      promptFiles: [...promptFiles], explanationFiles: [...explanationFiles],
      assets: [...assets]
    };

    if (isNew) {
      // OPTIMISTIC: Reset immediately and show "Background Saving"
      resetForm();
      const taskId = uid();
      setBackgroundTasks(prev => [...prev, { id: taskId, status: 'saving' }]);
      console.log("[QuestionBank] Starting background save for task:", taskId);
      performSave(capturedState, null)
        .then(() => {
          console.log("[QuestionBank] Background save success for task:", taskId);
          setBackgroundTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'done' } : t));
        })
        .catch(err => {
          console.error("[QuestionBank] Background save FAILED for task:", taskId, err);
          setBackgroundTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'error' } : t));
          alert("Background save failed: " + err.message);
        });
        
      setMessage("Question sent to background sync...");
      return;
    }

    // Standard save for editing
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await performSave(capturedState, questionId);
      setMessage("Updated successfully!");
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function performSave(state: typeof assets | any, targetId: string | null) {
    const { 
      type, points, allowMultiple, prompt, explanationText, correctText, topicId, subtopicId,
      options, subQuestions, promptFiles, explanationFiles, assets
    } = state;

    const payload = {
      type, points: type === 'reference_block' ? 0 : Math.trunc(Number(points)),
      allow_multiple: type === 'mcq' ? allowMultiple : false,
      prompt_text: prompt.trim() || null,
      explanation_text: explanationText.trim() || null,
      correct_text: type === 'fill' ? correctText.trim() : null,
      topic_id: topicId || null,
      subtopic_id: subtopicId || null,
    };

    let finalId = targetId;
    if (!finalId) {
      const res = await adminFetch("/api/admin/question-bank", { method: "POST", body: JSON.stringify({ action: "create_question", ...payload }) });
      finalId = res.question.id;
    } else {
      await adminFetch(`/api/admin/question-bank/${finalId}`, { method: "PATCH", body: JSON.stringify(payload) });
    }

    // Helper to upload files
    const uploadAndGetAsset = async (qId: string, file: File, kind: "prompt" | "explanation", i: number) => {
       const path = `question-bank/${qId}/${kind}-${Date.now()}-${i}-${file.name.replace(/\s+/g, '-')}`;
       const { error: upErr } = await supabase.storage.from(storageBucket).upload(path, file);
       if (upErr) throw upErr;
       const url = supabase.storage.from(storageBucket).getPublicUrl(path).data.publicUrl;
       return { bucket: storageBucket, storage_path: path, url, alt: file.name, kind, sort_order: i };
    };

    const uploadAndGetOption = async (qId: string, opt: any, i: number) => {
       let url = opt.url || null;
       let storage_path = opt.storage_path || null;
       if (opt.file) {
          const path = `question-bank/${qId}/opt-${Date.now()}-${i}-${opt.file.name.replace(/\s+/g, '-')}`;
          const { error: upErr } = await supabase.storage.from(storageBucket).upload(path, opt.file);
          if (upErr) throw upErr;
          url = supabase.storage.from(storageBucket).getPublicUrl(path).data.publicUrl;
          storage_path = path;
       }
       return { option_number: i + 1, text: opt.text.trim() || null, is_correct: opt.is_correct, url, storage_path, bucket: storageBucket };
    };

    // Upload Main Assets
    const mainAssetsToUp = [
       ...promptFiles.map((f: File, i: number) => uploadAndGetAsset(finalId!, f, "prompt", i + assets.filter((a: any) => a.kind === 'prompt').length)),
       ...explanationFiles.map((f: File, i: number) => uploadAndGetAsset(finalId!, f, "explanation", i + assets.filter((a: any) => a.kind === 'explanation').length))
    ];
    const uploadedMainAssets = await Promise.all(mainAssetsToUp);
    if (uploadedMainAssets.length > 0 || assets.length > 0) {
       await adminFetch("/api/admin/question-bank", { method: "POST", body: JSON.stringify({ action: "batch_assets", question_id: finalId, assets: [...assets, ...uploadedMainAssets] }) });
    }

    // Handle Options
    if (type === 'mcq') {
      const optsToSave = await Promise.all(options.map((o: any, i: number) => uploadAndGetOption(finalId!, o, i)));
      await adminFetch("/api/admin/question-bank", { method: "POST", body: JSON.stringify({ action: "batch_options", question_id: finalId, options: optsToSave }) });
    }

    // Handle Sub-questions
    if (type === 'reference_block') {
       for (let s of subQuestions) {
          const sPayload = {
             type: s.type, prompt_text: s.prompt.trim(), explanation_text: s.explanation.trim() || null,
             points: Math.trunc(Number(s.points)), correct_text: s.type === 'fill' ? s.correctText.trim() : null,
             topic_id: s.topicId || null, subtopic_id: s.subtopicId || null, parent_id: finalId
          };
          let sId = s.id;
          if (!sId) {
             const res = await adminFetch("/api/admin/question-bank", { method: "POST", body: JSON.stringify({ action: "create_question", ...sPayload }) });
             sId = res.question.id;
          } else {
             await adminFetch(`/api/admin/question-bank/${sId}`, { method: "PATCH", body: JSON.stringify(sPayload) });
          }

          // Sub Assets
          const subAssetsToUp = [
             ...s.questionFiles.map((f: File, i: number) => uploadAndGetAsset(sId!, f, "prompt", i + (s.existingAssets?.length || 0))),
             ...s.explanationFiles.map((f: File, i: number) => uploadAndGetAsset(sId!, f, "explanation", i + (s.existingAssets?.length || 0)))
          ];
          const uploadedSubAssets = await Promise.all(subAssetsToUp);
          if (uploadedSubAssets.length > 0 || (s.existingAssets && s.existingAssets.length > 0)) {
             await adminFetch("/api/admin/question-bank", { method: "POST", body: JSON.stringify({ action: "batch_assets", question_id: sId, assets: [...(s.existingAssets || []), ...uploadedSubAssets] }) });
          }

          // Sub Options
          if (s.type === 'mcq') {
             const sOptsToSave = await Promise.all(s.options.map((o: any, i: number) => uploadAndGetOption(sId!, o, i)));
             await adminFetch("/api/admin/question-bank", { method: "POST", body: JSON.stringify({ action: "batch_options", question_id: sId, options: sOptsToSave }) });
          }
       }
    }
    return finalId;
  }

  if (loading) return <LoadingAnimation />;

  return (
    <div className="max-w-full pb-32">
      <div className="sticky top-0 z-[60] bg-white/80 backdrop-blur-md border border-outline/60 shadow-soft-xl rounded-[32px] mb-10 p-6 flex flex-col md:flex-row items-center justify-between gap-6 transition-all duration-500">
        <div className="flex items-center gap-5">
          <Link href="/dashboard/questions" className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-100 hover:bg-slate-200 transition-all active:scale-95 group">
             <span className="material-symbols-outlined text-slate-500 group-hover:text-primary transition-colors">arrow_back</span>
          </Link>
          <div>
            <h1 className="font-headline text-2xl font-black text-primary tracking-tighter leading-none">Bank Repository</h1>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-secondary mt-2">{questionId ? "Modifying Global Item" : "Create New Bank Content"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          {backgroundTasks.length > 0 && (
             <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 rounded-xl text-[9px] font-black uppercase text-white animate-pulse">
                <span className="material-symbols-outlined text-[14px]">sync</span>
                {backgroundTasks.filter(t => t.status === 'saving').length} Syncing...
             </div>
          )}
          <button onClick={save} disabled={saving} className="flex-1 md:flex-none h-14 bg-primary text-white px-10 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-primary/20 hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50">
            {saving ? "Synchronizing..." : (questionId ? "Save Changes" : "Commit & New")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
         <div className="xl:col-span-8 space-y-10">
            {/* Core Config */}
            <div className="bg-white border-2 border-outline/40 shadow-soft-xl rounded-[40px] overflow-hidden group/card">
               <div className="p-8 border-b border-outline/20 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                     <div className="w-10 h-10 rounded-2xl bg-white shadow-soft-lg flex items-center justify-center text-primary"><span className="material-symbols-outlined">settings</span></div>
                     <h2 className="text-sm font-black uppercase tracking-[0.2em] text-primary">Content Configuration</h2>
                  </div>
               </div>
               <div className="p-10 space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Structure Type</label>
                        <select value={type} onChange={(e) => setType(e.target.value as any)} className="w-full h-14 px-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-primary transition-all">
                           <option value="mcq">Standard MCQ</option>
                           <option value="fill">Fill In The Blank</option>
                           <option value="reference_block">Reference Block (Nesting)</option>
                        </select>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Points Weight</label>
                        <input type="number" value={points} onChange={(e) => setPoints(e.target.value)} disabled={type === 'reference_block'} className="w-full h-14 px-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-primary text-center disabled:opacity-40 transition-all" />
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Primary Topic</label>
                        <select value={topicId} onChange={(e) => { setTopicId(e.target.value); setSubtopicId(""); }} className="w-full h-14 px-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-primary transition-all">
                           <option value="">Select Topic</option>
                           {topics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                        </select>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Subtopic Detail</label>
                        <select value={subtopicId} onChange={(e) => setSubtopicId(e.target.value)} className="w-full h-14 px-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-primary transition-all">
                           <option value="">Select Subtopic</option>
                           {allSubtopics.filter(st => st.topic_id === topicId).map(st => <option key={st.id} value={st.id}>{st.title}</option>)}
                        </select>
                     </div>
                  </div>

                  {/* Prompt Text */}
                  <div className="space-y-4">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Main Question / Block Context</label>
                     <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={6} className="w-full px-8 py-6 bg-slate-50 border-2 border-slate-100 rounded-[32px] text-base font-medium outline-none focus:bg-white focus:border-primary transition-all shadow-inner" placeholder="Enter the question text or reference block context here..." />
                     
                     <div className="space-y-3">
                        <div className="flex items-center justify-between">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Asset Repository (Prompt)</label>
                           <div className="relative">
                              <input type="file" multiple accept="image/*" onChange={(e) => setPromptFiles([...promptFiles, ...Array.from(e.target.files || [])])} className="absolute inset-0 opacity-0 cursor-pointer" />
                              <button className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/5 px-4 py-2 rounded-xl border border-primary/10 hover:bg-primary hover:text-white transition-all">+ Upload Images</button>
                           </div>
                        </div>
                        <div 
                           className={`flex flex-wrap gap-4 p-6 bg-slate-50/50 rounded-[28px] border-2 border-dashed transition-all ${isDragging ? 'border-primary bg-primary/5' : 'border-slate-200'}`}
                           onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                           onDragLeave={() => setIsDragging(false)}
                           onDrop={(e) => handleDrop(e, 'prompt')}
                        >
                           {assets.filter(a => a.kind === 'prompt').map(a => (
                              <div key={a.id} className="relative w-32 h-24 rounded-2xl border border-outline/30 overflow-hidden bg-white group/im">
                                 <img src={a.url || ''} className="w-full h-full object-cover" alt="p" />
                                 <button onClick={() => setAssets(assets.filter(x => x.id !== a.id))} className="absolute inset-0 bg-rose-500/80 text-white flex items-center justify-center opacity-0 group-hover/im:opacity-100 transition-all font-black text-xs">REMOVE</button>
                              </div>
                           ))}
                           {promptFiles.map((f, i) => (
                              <div key={i} className="relative w-32 h-24 rounded-2xl border-2 border-primary/40 overflow-hidden bg-white group/nim">
                                 <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" alt="np" />
                                 <button onClick={() => setPromptFiles(promptFiles.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 w-6 h-6 bg-rose-500 text-white rounded-lg flex items-center justify-center opacity-0 group-hover/nim:opacity-100 transition-all"><span className="material-symbols-outlined text-[14px]">close</span></button>
                              </div>
                           ))}
                           {!assets.filter(a => a.kind === 'prompt').length && !promptFiles.length && <div className="w-full py-4 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">No assets attached to prompt</div>}
                        </div>
                     </div>
                  </div>

                  {/* Explanation Text */}
                  <div className="space-y-4 pt-10 border-t border-outline/20">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Solution explanation (Global)</label>
                     <textarea value={explanationText} onChange={(e) => setExplanationText(e.target.value)} rows={4} className="w-full px-8 py-6 bg-blue-50/20 border-2 border-blue-100/50 rounded-[32px] text-base font-medium outline-none focus:bg-white focus:border-primary transition-all" placeholder="Enter common explanation or solution steps..." />
                  </div>

                  {/* MCQ Options */}
                  {type === 'mcq' && (
                     <div className="space-y-6 pt-10 border-t border-outline/20">
                        <div className="flex items-center justify-between">
                           <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary">MCQ Options</h3>
                           <button onClick={() => setOptions([...options, { key: uid(), text: "", file: null, is_correct: false }])} className="text-[10px] font-black text-primary uppercase bg-primary/5 px-6 py-2.5 rounded-2xl border border-primary/10 hover:bg-primary hover:text-white transition-all">+ Append Option</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           {options.map((opt, i) => (
                              <div key={opt.key} className="bg-slate-50/50 border-2 border-slate-100 rounded-[32px] p-6 space-y-4 group/opt hover:border-primary/20 transition-all">
                                 <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                       <div className="w-8 h-8 rounded-xl bg-white border border-outline/20 flex items-center justify-center font-black text-xs text-slate-400">{String.fromCharCode(65 + i)}</div>
                                       <label className="flex items-center gap-3 cursor-pointer">
                                          <input type="checkbox" checked={opt.is_correct} onChange={(e) => setOptions(options.map(o => o.key === opt.key ? { ...o, is_correct: e.target.checked } : o))} className="w-5 h-5 accent-emerald-500" />
                                          <span className={`text-[10px] font-black uppercase tracking-widest ${opt.is_correct ? 'text-emerald-600' : 'text-slate-400'}`}>Correct Answer</span>
                                       </label>
                                    </div>
                                    <button onClick={() => setOptions(options.filter(o => o.key !== opt.key))} className="w-8 h-8 flex items-center justify-center text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><span className="material-symbols-outlined text-[20px]">delete</span></button>
                                 </div>
                                 <textarea value={opt.text} onChange={(e) => setOptions(options.map(o => o.key === opt.key ? { ...o, text: e.target.value } : o))} rows={2} className="w-full px-5 py-3 bg-white border border-outline/20 rounded-2xl text-sm font-bold outline-none focus:border-primary transition-all" placeholder="Option content..." />
                                 <div className="relative">
                                    <input type="file" accept="image/*" onChange={(e) => setOptions(options.map(o => o.key === opt.key ? { ...o, file: e.target.files?.[0] || null } : o))} className="absolute inset-0 opacity-0 cursor-pointer" />
                                    <div className={`h-11 px-4 border border-dashed rounded-xl flex items-center gap-3 text-[10px] font-black transition-all ${opt.file || opt.url ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-outline/20 text-slate-400'}`}>
                                       <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
                                       <span className="truncate flex-1">{opt.file ? opt.file.name : opt.url ? 'Existing Image Attached' : 'Attach Visual Asset'}</span>
                                    </div>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                  )}

                  {/* Fill In Blank */}
                  {type === 'fill' && (
                     <div className="pt-10 border-t border-outline/20">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4 ml-1">Expected Answer Pattern</label>
                        <input value={correctText} onChange={(e) => setCorrectText(e.target.value)} className="w-full h-16 px-8 bg-emerald-50 border-2 border-emerald-100 rounded-[32px] text-lg font-black text-emerald-900 outline-none focus:border-emerald-500 shadow-sm" placeholder="Type the correct answer exactly..." />
                     </div>
                  )}
               </div>
            </div>

            {/* Sub Questions */}
            {type === 'reference_block' && (
               <div className="space-y-8 animate-in slide-in-from-bottom-5 duration-700">
                  <div className="flex items-center justify-between px-4">
                     <div>
                        <h2 className="text-xl font-black text-primary tracking-tighter">Sub-Questions Stack</h2>
                        <p className="text-[10px] font-black text-secondary uppercase tracking-widest mt-1">Nesting child questions under this reference block</p>
                     </div>
                     <button onClick={() => setSubQuestions([...subQuestions, { key: uid(), type: 'mcq', prompt: "", explanation: "", points: "1", options: [], correctText: "", topicId: "", subtopicId: "", questionFiles: [], explanationFiles: [] }])} className="h-14 px-10 bg-secondary text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-secondary/20 hover:bg-primary transition-all active:scale-95">+ Add Sub-Item</button>
                  </div>
                  <div className="space-y-10">
                     {subQuestions.map((sub, idx) => (
                        <SubQuestionInput key={sub.key} sub={sub} index={idx} topics={topics} allSubtopics={allSubtopics} onRemove={(key: any) => setSubQuestions(subQuestions.filter(s => s.key !== key))} onUpdate={(key: any, patch: any) => setSubQuestions(subQuestions.map(s => s.key === key ? { ...s, ...patch } : s))} onReorder={(key: any, dir: any) => {
                           const i = subQuestions.findIndex(s => s.key === key);
                           const next = [...subQuestions];
                           const target = dir === 'up' ? i - 1 : i + 1;
                           if (target < 0 || target >= next.length) return;
                           [next[i], next[target]] = [next[target], next[i]];
                           setSubQuestions(next);
                        }} />
                     ))}
                  </div>
               </div>
            )}
         </div>

         {/* Sidebar Preview */}
         <div className="xl:col-span-4">
            <div className="sticky top-36 space-y-8">
               <div className="bg-white border-2 border-outline/40 shadow-soft-xl rounded-[40px] p-10 overflow-hidden relative group/prev">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16" />
                  <div className="relative z-10 space-y-10">
                     <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-black text-primary/40 uppercase tracking-[0.3em]">Visual Preview</h3>
                        <div className="px-3 py-1 bg-primary/5 rounded-full text-[9px] font-black text-primary uppercase">Student Context</div>
                     </div>
                     
                     <div className="space-y-8">
                        <div className="text-lg font-medium leading-relaxed text-slate-800">
                           <MathText text={prompt || "Context content will reflect here..."} />
                        </div>
                        
                        <div className="space-y-4">
                           {assets.filter(a => a.kind === 'prompt').map(a => (
                              <img key={a.id} src={a.url || ''} className="w-full h-auto rounded-[32px] border-2 border-outline/20" alt="p" />
                           ))}
                           {promptFiles.map((f, i) => (
                              <img key={i} src={URL.createObjectURL(f)} className="w-full h-auto rounded-[32px] border-2 border-primary/20 shadow-lg" alt="np" />
                           ))}
                        </div>

                        {type === 'mcq' && (
                           <div className="space-y-4">
                              {options.map((opt, i) => (
                                 <div key={opt.key} className="flex items-center gap-5 p-5 border-2 border-outline/30 rounded-[32px] bg-slate-50/50">
                                    <div className="w-10 h-10 rounded-2xl bg-white border border-outline/20 flex items-center justify-center font-black text-sm text-slate-400 shrink-0">{String.fromCharCode(65 + i)}</div>
                                    <div className="flex-1">
                                       <div className="text-sm font-bold text-slate-700 leading-snug"><MathText text={opt.text} /></div>
                                       {(opt.file || opt.url) && <img src={opt.file ? URL.createObjectURL(opt.file!) : opt.url!} className="mt-4 max-w-full h-32 object-contain rounded-2xl border border-outline/20 bg-white p-2" alt="Opt" />}
                                    </div>
                                 </div>
                              ))}
                           </div>
                        )}
                     </div>
                  </div>
               </div>

               {explanationText && (
                  <div className="bg-blue-50/80 backdrop-blur-md border-2 border-blue-100/50 shadow-soft-lg rounded-[40px] p-10 space-y-6">
                     <div className="flex items-center gap-3 text-blue-600">
                        <span className="material-symbols-outlined text-xl">lightbulb</span>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Solution Guide</span>
                     </div>
                     <div className="text-sm font-medium text-blue-900 leading-relaxed">
                        <MathText text={explanationText} />
                     </div>
                  </div>
               )}
            </div>
         </div>
      </div>
    </div>
  );
}
