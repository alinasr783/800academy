"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import MathText from "@/components/MathText";
import LoadingAnimation from "@/components/LoadingAnimation";

type QuestionRow = {
  id: string;
  exam_id: string;
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
  // Local file uploads
  questionFiles: File[];
  explanationFiles: File[];
  // Metadata for assets if already exists
  existingAssets?: QuestionAssetRow[];
};

type NewOption = {
  id?: string;
  key: string;
  text: string;
  file: File | null;
  is_correct: boolean;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type PassageRow = {
  id: string;
  title: string | null;
  kind: "reading" | "reference";
};

type TopicRow = { id: string; title: string };
type SubtopicRow = { id: string; topic_id: string; title: string };

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

import { memo } from "react";

const SubQuestionInput = memo(({ 
  sub, 
  index, 
  topics, 
  allSubtopics,
  onUpdate, 
  onRemove,
  onReorder
}: { 
  sub: SubQuestion, 
  index: number, 
  topics: TopicRow[], 
  allSubtopics: SubtopicRow[],
  onUpdate: (key: string, patch: Partial<SubQuestion>) => void, 
  onRemove: (key: string) => void,
  onReorder: (key: string, direction: 'up' | 'down') => void
}) => {
  const filteredSubtopics = allSubtopics.filter(st => st.topic_id === sub.topicId);

  return (
    <div className="bg-white border-2 border-outline/40 shadow-soft-xl rounded-3xl overflow-hidden group/sub">
      {/* Header */}
      <div className="p-4 border-b border-outline/30 bg-slate-50 flex items-center justify-between">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center font-black text-xs">
              {index + 1}
            </div>
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
        {/* Left Side: Editor */}
        <div className="p-6 space-y-8 border-r border-outline/20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1 ml-1">Type</label>
                <select 
                  value={sub.type} 
                  onChange={(e) => onUpdate(sub.key, { type: e.target.value as 'mcq' | 'fill' })}
                  className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary transition-all"
                >
                  <option value="mcq">MCQ</option>
                  <option value="fill">Fill In The Blank</option>
                </select>
             </div>
             <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1 ml-1">Points</label>
                <input 
                  type="number" 
                  value={sub.points} 
                  onChange={(e) => onUpdate(sub.key, { points: e.target.value })}
                  className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary text-center transition-all"
                />
             </div>
          </div>

          {/* Prompt Section */}
          <div className="space-y-4">
             <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Sub-Question Prompt</label>
                <textarea 
                  value={sub.prompt} 
                  onChange={(e) => onUpdate(sub.key, { prompt: e.target.value })}
                  rows={4}
                  placeholder="Write the sub-question prompt here... (Supports LaTeX and HTML)"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:bg-white focus:border-primary transition-all"
                />
             </div>
             
             <div className="space-y-2">
                <div className="flex items-center justify-between">
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Prompt Assets</label>
                   <div className="relative">
                      <input type="file" multiple accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                         const files = Array.from(e.target.files || []);
                         onUpdate(sub.key, { questionFiles: [...(sub.questionFiles || []), ...files] });
                      }} />
                      <button type="button" className="text-[9px] font-black text-primary uppercase tracking-widest hover:underline">+ Add New Images</button>
                   </div>
                </div>
                
                {/* Existing Assets */}
                {sub.existingAssets?.filter(a => a.kind === 'prompt').length ? (
                   <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {sub.existingAssets.filter(a => a.kind === 'prompt').map((a, i) => (
                         <div key={a.id} className="relative h-20 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden group/ex">
                            <img src={a.url || ''} className="w-full h-full object-cover opacity-60 group-hover/ex:opacity-100 transition-all" alt="exist" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover/ex:opacity-100 transition-all">
                               <span className="text-[8px] font-black text-white uppercase bg-primary/80 px-1.5 py-0.5 rounded">Uploaded</span>
                            </div>
                         </div>
                      ))}
                   </div>
                ) : null}

                {/* New Files */}
                {sub.questionFiles?.length > 0 && (
                   <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-primary/5 rounded-xl border border-primary/10 border-dashed">
                      <div className="col-span-full text-[8px] font-black text-primary/40 uppercase mb-1">New to upload</div>
                      {sub.questionFiles.map((f, i) => (
                         <div key={i} className="relative group/new h-20 border border-primary/20 rounded-xl overflow-hidden">
                            <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" alt="new" />
                            <button onClick={() => {
                               const next = [...(sub.questionFiles || [])];
                               next.splice(i, 1);
                               onUpdate(sub.key, { questionFiles: next });
                            }} className="absolute top-1 right-1 w-6 h-6 bg-rose-500 text-white rounded-lg opacity-0 group-hover/new:opacity-100 transition-all flex items-center justify-center">
                               <span className="material-symbols-outlined text-[14px]">close</span>
                            </button>
                         </div>
                      ))}
                   </div>
                )}
             </div>
          </div>

          {/* Type Specific logic */}
          {sub.type === "mcq" ? (
             <div className="space-y-4">
                <div className="flex items-center justify-between">
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Answer Options</label>
                   <button type="button" onClick={() => onUpdate(sub.key, { options: [...sub.options, { key: uid(), text: "", file: null, is_correct: false }] })} className="text-[9px] font-black text-primary uppercase tracking-widest hover:underline">+ Add Option</button>
                </div>
                <div className="space-y-4">
                   {sub.options.map((opt, oIdx) => (
                      <div key={opt.key} className="bg-slate-50/50 border border-slate-200 rounded-2xl p-4 space-y-3">
                         <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                               <div className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-400">
                                  {String.fromCharCode(65 + oIdx)}
                               </div>
                               <label className="flex items-center gap-2 cursor-pointer group">
                                  <input 
                                    type="checkbox" 
                                    checked={opt.is_correct}
                                    onChange={(e) => {
                                       const next = sub.options.map(o => o.key === opt.key ? { ...o, is_correct: e.target.checked } : o);
                                       onUpdate(sub.key, { options: next });
                                    }}
                                    className="w-4 h-4 accent-emerald-500 cursor-pointer"
                                  />
                                  <span className={`text-[9px] font-black uppercase tracking-widest ${opt.is_correct ? 'text-emerald-600' : 'text-slate-400'}`}>Correct</span>
                               </label>
                            </div>
                            <button type="button" onClick={() => onUpdate(sub.key, { options: sub.options.filter(o => o.key !== opt.key) })} className="text-slate-300 hover:text-rose-500 transition-colors">
                               <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                         </div>
                         <textarea 
                           value={opt.text}
                           onChange={(e) => {
                              const next = sub.options.map(o => o.key === opt.key ? { ...o, text: e.target.value } : o);
                              onUpdate(sub.key, { options: next });
                           }}
                           rows={2}
                           placeholder="Option text..."
                           className="w-full px-3 py-2 bg-white border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-primary transition-all"
                         />
                         
                         {/* Option Image Management */}
                         <div className="flex items-center gap-2">
                           {/* Existing Option URL */}
                           {(opt as any).url && (
                             <div className="relative h-8 w-12 rounded border border-outline/20 overflow-hidden">
                                <img src={(opt as any).url} className="w-full h-full object-cover" alt="opt" />
                             </div>
                           )}
                           <div className="relative flex-1">
                              <input type="file" accept="image/*" onChange={(e) => {
                                 const f = e.target.files?.[0] || null;
                                 const next = sub.options.map(o => o.key === opt.key ? { ...o, file: f } : o);
                                 onUpdate(sub.key, { options: next });
                              }} className="absolute inset-0 opacity-0 cursor-pointer" />
                              <div className={`h-8 px-3 border border-dashed rounded-lg flex items-center gap-2 text-[10px] font-black transition-all ${opt.file ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-200 text-slate-400'}`}>
                                 <span className="material-symbols-outlined text-[16px]">{opt.file ? 'check_circle' : 'add_photo_alternate'}</span>
                                 <span className="truncate flex-1">{opt.file ? opt.file.name : 'Replace/New Image'}</span>
                              </div>
                           </div>
                           {opt.file && (
                              <button onClick={() => {
                                 const next = sub.options.map(o => o.key === opt.key ? { ...o, file: null } : o);
                                 onUpdate(sub.key, { options: next });
                              }} className="text-rose-500 hover:text-rose-700">
                                 <span className="material-symbols-outlined text-[18px]">close</span>
                              </button>
                           )}
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          ) : (
             <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Correct Answer</label>
                <input 
                  value={sub.correctText} 
                  onChange={(e) => onUpdate(sub.key, { correctText: e.target.value })}
                  placeholder="Enter the correct answer..."
                  className="w-full h-11 px-4 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-black text-emerald-900 outline-none focus:border-emerald-500 transition-all"
                />
             </div>
          )}

          {/* Explanation Section */}
          <div className="space-y-4">
             <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Step-by-Step Explanation</label>
                <textarea 
                  value={sub.explanation} 
                  onChange={(e) => onUpdate(sub.key, { explanation: e.target.value })}
                  rows={4}
                  placeholder="How to solve this sub-question... (Supports LaTeX and HTML)"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:bg-white focus:border-primary transition-all"
                />
             </div>
             
             <div className="space-y-2">
                <div className="flex items-center justify-between">
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Explanation Assets</label>
                   <div className="relative">
                      <input type="file" multiple accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                         const files = Array.from(e.target.files || []);
                         onUpdate(sub.key, { explanationFiles: [...(sub.explanationFiles || []), ...files] });
                      }} />
                      <button type="button" className="text-[9px] font-black text-primary uppercase tracking-widest hover:underline">+ Add New Images</button>
                   </div>
                </div>

                {/* Existing Explanation Assets */}
                {sub.existingAssets?.filter(a => a.kind === 'explanation').length ? (
                   <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {sub.existingAssets.filter(a => a.kind === 'explanation').map((a, i) => (
                         <div key={a.id} className="relative h-20 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden group/ex">
                            <img src={a.url || ''} className="w-full h-full object-cover opacity-60 group-hover/ex:opacity-100 transition-all" alt="exist" />
                         </div>
                      ))}
                   </div>
                ) : null}

                {/* New Files */}
                {sub.explanationFiles?.length > 0 && (
                   <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-primary/5 rounded-xl border border-primary/10 border-dashed">
                      {sub.explanationFiles.map((f, i) => (
                         <div key={i} className="relative group/new h-20 border border-primary/20 rounded-xl overflow-hidden">
                            <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" alt="new" />
                            <button onClick={() => {
                               const next = [...(sub.explanationFiles || [])];
                               next.splice(i, 1);
                               onUpdate(sub.key, { explanationFiles: next });
                            }} className="absolute top-1 right-1 w-6 h-6 bg-rose-500 text-white rounded-lg opacity-0 group-hover/new:opacity-100 transition-all flex items-center justify-center">
                               <span className="material-symbols-outlined text-[14px]">close</span>
                            </button>
                         </div>
                      ))}
                   </div>
                )}
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1 ml-1">Topic</label>
                <select value={sub.topicId} onChange={(e) => onUpdate(sub.key, { topicId: e.target.value, subtopicId: "" })} className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold outline-none">
                   <option value="">Select Topic</option>
                   {topics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
             </div>
             <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1 ml-1">Subtopic</label>
                <select value={sub.subtopicId} onChange={(e) => onUpdate(sub.key, { subtopicId: e.target.value })} className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold outline-none">
                   <option value="">Select Subtopic</option>
                   {filteredSubtopics.map(st => <option key={st.id} value={st.id}>{st.title}</option>)}
                </select>
             </div>
          </div>
        </div>

        {/* Right Side: Live Preview */}
        <div className="p-8 bg-blue-50/30 flex flex-col items-center justify-center space-y-8">
           <div className="text-[10px] font-black text-primary/40 uppercase tracking-[0.3em] mb-4">Live Preview (Student View)</div>
           
           <div className="w-full max-w-md bg-white border border-outline/30 shadow-soft-xl rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="text-[10px] font-black text-primary uppercase tracking-[0.2em] opacity-40">Position #{index + 1}</div>
              
              <div className="text-sm sm:text-base font-medium leading-relaxed">
                 <MathText text={sub.prompt || "Question prompt..."} />
              </div>

              {/* Combined Assets Preview */}
              <div className="space-y-4">
                 {sub.existingAssets?.filter(a => a.kind === 'prompt').map((a) => (
                    <img key={a.id} src={a.url || ''} className="max-w-full h-auto rounded-2xl border border-outline/20 mx-auto" alt="Sub prompt" />
                 ))}
                 {sub.questionFiles?.map((f, i) => (
                    <img key={i} src={URL.createObjectURL(f)} className="max-w-full h-auto rounded-2xl border border-primary/20 mx-auto opacity-70" alt="Sub prompt new" />
                 ))}
              </div>

              {sub.type === 'mcq' ? (
                 <div className="space-y-3">
                    {sub.options.map((opt, i) => (
                       <div key={opt.key} className="flex items-center gap-4 p-4 border border-outline/30 rounded-2xl bg-white">
                          <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-xs font-black text-slate-400 border border-outline/20">
                             {String.fromCharCode(65 + i)}
                          </div>
                          <div className="flex-1">
                             <div className="text-sm font-bold text-slate-700">
                                <MathText text={opt.text} />
                             </div>
                             {((opt as any).url || opt.file) && (
                                <img src={opt.file ? URL.createObjectURL(opt.file) : (opt as any).url} className="mt-2 max-w-full h-24 object-contain rounded-lg border border-outline/20" alt="Opt asset" />
                             )}
                          </div>
                       </div>
                    ))}
                 </div>
              ) : (
                 <div className="px-4 py-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none">
                    Student Input Area
                 </div>
              )}
           </div>

           {(sub.explanation || sub.explanationFiles?.length > 0 || sub.existingAssets?.some(a => a.kind === 'explanation')) && (
              <div className="w-full max-w-md bg-blue-50 border border-blue-100 rounded-3xl p-6 sm:p-8 space-y-4">
                 <div className="flex items-center gap-2 text-blue-600 mb-2">
                    <span className="material-symbols-outlined text-sm">lightbulb</span>
                    <span className="text-[10px] font-black uppercase tracking-widest">Explanation</span>
                 </div>
                 <div className="text-sm font-medium text-blue-900 leading-relaxed">
                    <MathText text={sub.explanation} />
                 </div>
                 {sub.existingAssets?.filter(a => a.kind === 'explanation').map((a) => (
                    <img key={a.id} src={a.url || ''} className="max-w-full h-auto rounded-2xl border border-blue-200/50 mx-auto" alt="Sub expl" />
                 ))}
                 {sub.explanationFiles?.map((f, i) => (
                    <img key={i} src={URL.createObjectURL(f)} className="max-w-full h-auto rounded-2xl border border-blue-200/50 mx-auto opacity-70" alt="Sub expl new" />
                 ))}
              </div>
           )}
        </div>
      </div>
    </div>
  );
});

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
  const [allSubtopics, setAllSubtopics] = useState<SubtopicRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [type, setType] = useState<"mcq" | "fill" | "reference_block">("mcq");
  const [points, setPoints] = useState("1");
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [correctText, setCorrectText] = useState("");
  const [passageId, setPassageId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [subtopicId, setSubtopicId] = useState("");
  const [explanationText, setExplanationText] = useState("");
  const [subQuestions, setSubQuestions] = useState<SubQuestion[]>([]);

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
      setSubtopicId(json.question.subtopic_id ?? "");

      const examJson = await adminFetch(`/api/admin/exams/${json.question.exam_id}`);
      if (!mounted) return;
      setExam(examJson.exam);
      setPassages(examJson.passages ?? []);

      if (json.question.type === 'reference_block') {
         const { data: subs } = await supabase
           .from('exam_questions')
           .select('id,type,prompt_text,explanation_text,points,correct_text,topic_id,subtopic_id,question_number')
           .eq('parent_id', questionId)
           .order('question_number', { ascending: true });
         
         const subIds = (subs || []).map(s => s.id);
         
         // Batch fetch all options and assets for all sub-questions in just 2 queries
         const [{ data: allSubOpts }, { data: allSubAssets }] = await Promise.all([
           subIds.length > 0 
             ? supabase.from('exam_question_options').select('*').in('question_id', subIds).order('option_number', { ascending: true })
             : Promise.resolve({ data: [] as any[] }),
           subIds.length > 0
             ? supabase.from('exam_question_assets').select('*').in('question_id', subIds).order('sort_order', { ascending: true })
             : Promise.resolve({ data: [] as any[] }),
         ]);
         
         // Group by question_id for O(1) lookup
         const optsByQId = new Map<string, any[]>();
         const assetsByQId = new Map<string, any[]>();
         (allSubOpts || []).forEach(o => {
           const arr = optsByQId.get(o.question_id) || [];
           arr.push(o);
           optsByQId.set(o.question_id, arr);
         });
         (allSubAssets || []).forEach(a => {
           const arr = assetsByQId.get(a.question_id) || [];
           arr.push(a);
           assetsByQId.set(a.question_id, arr);
         });
         
         const mappedSubs: SubQuestion[] = (subs || []).map((s) => {
            const sOpts = optsByQId.get(s.id) || [];
            const sAssets = assetsByQId.get(s.id) || [];
            
            return {
               id: s.id,
               key: uid(),
               type: s.type as 'mcq' | 'fill',
               prompt: s.prompt_text ?? "",
               explanation: s.explanation_text ?? "",
               points: String(s.points),
               correctText: s.correct_text ?? "",
               topicId: s.topic_id ?? "",
               subtopicId: s.subtopic_id ?? "",
               questionFiles: [],
               explanationFiles: [],
               existingAssets: sAssets,
               options: sOpts.map(o => ({
                  id: o.id,
                  key: uid(),
                  text: o.text ?? "",
                  file: null,
                  is_correct: o.is_correct,
                  url: o.url // Include existing URL
               })) as any
            };
         });
         setSubQuestions(mappedSubs);
      }

      const topicsJson = await adminFetch(`/api/admin/topics?subject_id=${examJson.exam.subject_id}`);
      const subtopicsJson = await adminFetch(`/api/admin/subtopics?subject_id=${examJson.exam.subject_id}`);
      if (!mounted) return;
      setTopics(topicsJson.items ?? []);
      setAllSubtopics(subtopicsJson.items ?? []);
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
      // 1. Save main question (block or standard)
      const res = (await adminFetch(`/api/admin/questions/${questionId}`, {
        method: "PATCH",
        body: JSON.stringify({
          type,
          points: type === 'reference_block' ? 0 : pts,
          allow_multiple: type === "mcq" ? allowMultiple : false,
          prompt_text: prompt.trim() || null,
          explanation_text: explanationText.trim() || null,
          correct_text: type === "fill" ? correctText.trim() : null,
          passage_id: passageId || null,
          topic_id: topicId || null,
          subtopic_id: subtopicId || null,
        }),
      })) as { question: QuestionRow };
      
      setQuestion(res.question);

          // 2. If it's a reference block, save/create sub-questions
          if (type === 'reference_block') {
             const uploadAndGetAsset = async (qId: string, file: File, kind: "prompt" | "explanation", i: number) => {
                 const safeName = file.name.replaceAll(" ", "-");
                 const path = `questions/${qId}/${kind === 'explanation' ? 'explanations/' : ''}${Date.now()}-${i}-${safeName}`;
                 const { error: upErr } = await supabase.storage.from(storageBucket).upload(path, file, { upsert: false });
                 if (upErr) throw new Error(upErr.message);
                 const publicUrl = supabase.storage.from(storageBucket).getPublicUrl(path).data.publicUrl;
                 return { bucket: storageBucket, storage_path: path, url: publicUrl, alt: file.name, kind, sort_order: i };
             };

             const uploadAndGetOption = async (qId: string, opt: NewOption, i: number) => {
                 let url: string | null = (opt as any).url || null;
                 let storagePath: string | null = (opt as any).storage_path || null;
                 if (opt.file) {
                    const safeName = opt.file.name.replaceAll(" ", "-");
                    const path = `questions/${qId}/options/${Date.now()}-${uid()}-${safeName}`;
                    const { error: upErr } = await supabase.storage.from(storageBucket).upload(path, opt.file, { upsert: false });
                    if (upErr) throw new Error(upErr.message);
                    url = supabase.storage.from(storageBucket).getPublicUrl(path).data.publicUrl;
                    storagePath = path;
                 }
                 return { text: opt.text.trim() || null, bucket: storageBucket, storage_path: storagePath, url, is_correct: opt.is_correct, option_number: i + 1 };
             };

             for (let s of subQuestions) {
                let currentSubId = s.id;
                if (currentSubId) {
                   // Update existing sub
                   await adminFetch(`/api/admin/questions/${currentSubId}`, {
                      method: "PATCH",
                      body: JSON.stringify({
                         type: s.type,
                         prompt_text: s.prompt.trim(),
                         explanation_text: s.explanation.trim() || null,
                         points: Math.max(0, Math.trunc(Number(s.points))),
                         correct_text: s.type === 'fill' ? s.correctText.trim() : null,
                         topic_id: s.topicId || null,
                         subtopic_id: s.subtopicId || null,
                      })
                   });
                } else {
                   // Create new sub
                   const sCreated = await adminFetch(`/api/admin/exams/${res.question.exam_id}`, {
                      method: "POST",
                      body: JSON.stringify({
                         action: "create_question",
                         type: s.type,
                         parent_id: questionId,
                         prompt_text: s.prompt.trim(),
                         explanation_text: s.explanation.trim() || null,
                         points: Math.max(0, Math.trunc(Number(s.points))),
                         correct_text: s.type === 'fill' ? s.correctText.trim() : null,
                         topic_id: s.topicId || null,
                         subtopic_id: s.subtopicId || null,
                      })
                   }) as { question: { id: string } };
                   currentSubId = sCreated.question.id;
                }

                // Handle Sub-question Assets (New ones)
                const newAssets = [
                   ...(s.questionFiles || []).map((f, i) => uploadAndGetAsset(currentSubId!, f, "prompt", i + (s.existingAssets?.length || 0))),
                   ...(s.explanationFiles || []).map((f, i) => uploadAndGetAsset(currentSubId!, f, "explanation", i + (s.existingAssets?.length || 0)))
                ];
                const uploadedAssets = await Promise.all(newAssets);
                if (uploadedAssets.length > 0) {
                   await adminFetch(`/api/admin/questions/${currentSubId}`, {
                      method: "POST",
                      body: JSON.stringify({ action: "batch_assets", assets: uploadedAssets })
                   });
                }

                // Handle Sub-question Options (Always batch update to be safe)
                const sOptions = await Promise.all(s.options.filter(o => o.text.trim() || o.file || (o as any).url).map((o, i) => uploadAndGetOption(currentSubId!, o, i)));
                if (sOptions.length > 0) {
                   await adminFetch(`/api/admin/questions/${currentSubId}`, {
                      method: "POST",
                      body: JSON.stringify({ action: "batch_options", options: sOptions })
                   });
                }
             }
         
         // 3. Reorder sub-questions to match UI order
         const reorderItems = subQuestions.map(s => ({ id: s.id, parent_id: questionId })).filter(x => !!x.id);
         if (reorderItems.length > 0) {
            // Need a way to reorder them specifically. 
            // For now, reorder_questions in exam route can work if we have all IDs.
         }
      }

      setMessage("Saved successfully.");
      await load(); // Reload to get fresh IDs for any newly created subs
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

  const filteredSubtopics = useMemo(() => {
    if (!topicId) return [];
    return allSubtopics.filter(st => st.topic_id === topicId);
  }, [topicId, allSubtopics]);

  function reorderLocal(from: number, to: number) {
    setOptions((prev) => {
      if (from < 0 || from >= prev.length || to < 0 || to >= prev.length) return prev;
      const copy = prev.slice();
      const [moved] = copy.splice(from, 1);
      copy.splice(to, 0, moved);
      return copy.map((o, idx) => ({ ...o, option_number: idx + 1 }));
    });
  }

  const addSubQuestion = () => {
    setSubQuestions(prev => [
      ...prev,
      {
        key: uid(),
        type: "mcq",
        prompt: "",
        explanation: "",
        points: "1",
        options: [
          { key: uid(), text: "", file: null, is_correct: false },
          { key: uid(), text: "", file: null, is_correct: false },
          { key: uid(), text: "", file: null, is_correct: false },
          { key: uid(), text: "", file: null, is_correct: false },
        ],
        questionFiles: [],
        explanationFiles: [],
        correctText: "",
        topicId: topicId,
        subtopicId: subtopicId
      }
    ]);
  };

  const updateSubQuestion = useCallback((key: string, patch: Partial<SubQuestion>) => {
    setSubQuestions(prev => prev.map(s => s.key === key ? { ...s, ...patch } : s));
  }, []);

  const removeSubQuestion = useCallback((key: string) => {
    setSubQuestions(prev => prev.filter(s => s.key !== key));
  }, []);

  const reorderSubQuestion = useCallback((key: string, direction: 'up' | 'down') => {
    setSubQuestions(prev => {
      const idx = prev.findIndex(s => s.key === key);
      if (idx === -1) return prev;
      const nextIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[nextIdx]] = [copy[nextIdx], copy[idx]];
      return copy;
    });
  }, []);

  async function saveOrder() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (type === 'reference_block') {
         // Reorder sub-questions
         const items = subQuestions.map(s => ({ id: s.id, parent_id: questionId })).filter(x => !!x.id);
         if (items.length > 0) {
            await adminFetch(`/api/admin/exams/${question?.exam_id}`, {
               method: "POST",
               body: JSON.stringify({ action: "reorder_questions", question_ids_in_order: items })
            });
         }
         setMessage("Sub-questions order saved.");
      } else {
         // Reorder MCQ options
         await adminFetch(`/api/admin/questions/${questionId}`, {
            method: "POST",
            body: JSON.stringify({ action: "reorder_options", option_ids_in_order: options.map((o) => o.id) }),
         });
         setMessage("Options order saved.");
      }
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
        <LoadingAnimation />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 items-start pb-24">
          <div className="xl:col-span-8 space-y-10">
            <div className="bg-white border border-outline/60 shadow-soft-xl rounded-3xl overflow-hidden">
               <div className="p-6 border-b border-outline/40 bg-slate-50/50 flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary">{type === 'reference_block' ? 'auto_awesome_motion' : 'edit_note'}</span>
                  <h2 className="text-sm font-black uppercase tracking-widest text-primary">{type === 'reference_block' ? 'Reference Block Content' : 'Question Content'}</h2>
               </div>
               <div className="p-8 space-y-8">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-3 ml-1">{type === 'reference_block' ? 'Block Text / Passage' : 'Question Prompt'}</label>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      rows={type === 'reference_block' ? 12 : 8}
                      className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary focus:bg-white outline-none transition-all font-medium text-lg leading-relaxed"
                      placeholder={type === 'reference_block' ? "Enter the block content or passage text..." : "Enter the question text here..."}
                    />
                    {prompt && (
                      <div className="mt-4 p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Live Preview</div>
                        <MathText text={prompt} />
                      </div>
                    )}
                  </div>

                  {type !== 'reference_block' && type === "fill" && (
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
                         {type === 'reference_block' ? 'Block Images' : 'Attached Assets (Images)'}
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

            {type === 'reference_block' && (
              <div className="space-y-10">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                          <span className="material-symbols-outlined">format_list_numbered</span>
                       </div>
                       <h2 className="text-sm font-black uppercase tracking-widest text-indigo-700">Sub-Questions</h2>
                    </div>
                    <div className="flex items-center gap-3">
                       <button type="button" onClick={saveOrder} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Save Order</button>
                       <button type="button" onClick={addSubQuestion} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-indigo-100">+ Add Sub-Question</button>
                    </div>
                 </div>
                 
                 <div className="space-y-8">
                    {subQuestions.map((sub, idx) => (
                       <SubQuestionInput 
                         key={sub.key} 
                         sub={sub} 
                         index={idx} 
                         topics={topics} 
                         allSubtopics={allSubtopics}
                         onUpdate={updateSubQuestion}
                         onRemove={removeSubQuestion}
                         onReorder={reorderSubQuestion}
                       />
                    ))}
                 </div>

                 {subQuestions.length === 0 && (
                    <div className="p-12 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-center bg-slate-50/50">
                       <span className="material-symbols-outlined text-6xl text-slate-200 mb-4">add_circle</span>
                       <p className="text-slate-400 font-bold">No sub-questions added yet.<br/>Click the button above to start adding questions to this block.</p>
                    </div>
                 )}
              </div>
            )}

            {/* Detailed Explanation Section - Hidden for Reference Block itself unless needed */}
            {type !== 'reference_block' && (
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
                    className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl focus:border-amber-400 focus:bg-white outline-none transition-all font-medium text-base leading-relaxed"
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
         )}

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
                                 <textarea
                                     value={optText}
                                     onChange={(e) => setOptText(e.target.value)}
                                     placeholder="Option text..."
                                     className="w-full px-5 py-3 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 outline-none transition-all font-bold"
                                     rows={2}
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
                   <div className="grid grid-cols-3 gap-3">
                      <button
                         type="button"
                         onClick={() => setType("mcq")}
                         className={`h-14 flex flex-col items-center justify-center gap-1 border-2 rounded-2xl transition-all active:scale-[0.98] ${type === "mcq" ? "border-primary bg-primary/5 text-primary" : "border-slate-100 bg-slate-50 text-slate-400"}`}
                      >
                         <span className="material-symbols-outlined text-[18px]">quiz</span>
                         <span className="text-[9px] font-black uppercase tracking-widest">MCQ</span>
                      </button>
                      <button
                         type="button"
                         onClick={() => setType("fill")}
                         className={`h-14 flex flex-col items-center justify-center gap-1 border-2 rounded-2xl transition-all active:scale-[0.98] ${type === "fill" ? "border-primary bg-primary/5 text-primary" : "border-slate-100 bg-slate-50 text-slate-400"}`}
                      >
                         <span className="material-symbols-outlined text-[18px]">stylus</span>
                         <span className="text-[9px] font-black uppercase tracking-widest">Fill</span>
                      </button>
                      <button
                         type="button"
                         onClick={() => setType("reference_block")}
                         className={`h-14 flex flex-col items-center justify-center gap-1 border-2 rounded-2xl transition-all active:scale-[0.98] ${type === "reference_block" ? "border-primary bg-primary/5 text-primary" : "border-slate-100 bg-slate-50 text-slate-400"}`}
                      >
                         <span className="material-symbols-outlined text-[18px]">auto_awesome_motion</span>
                         <span className="text-[9px] font-black uppercase tracking-widest">Ref</span>
                      </button>
                   </div>                   {type !== "reference_block" && (
                     <>
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
                     </>
                   )}
                </div>
             </div>

             {type !== "reference_block" && (
                <>
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
                           <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90">Curriculum Hierarchy</h3>
                        </div>
                        
                        <div className="space-y-4">
                              <div>
                                 <label className="text-[9px] font-black uppercase tracking-widest text-white/50 mb-2 block">Main Topic</label>
                                 <select
                                    value={topicId}
                                    onChange={(e) => { setTopicId(e.target.value); setSubtopicId(""); }}
                                    className="h-12 w-full px-4 bg-white/20 border border-white/20 text-white rounded-xl focus:bg-white focus:text-emerald-900 outline-none transition-all font-bold text-sm backdrop-blur-sm cursor-pointer"
                                 >
                                    <option value="" className="text-gray-900">Select Topic...</option>
                                    {topics.map((t) => (
                                       <option key={t.id} value={t.id} className="text-gray-900">{t.title}</option>
                                    ))}
                                 </select>
                              </div>

                              <div>
                                 <label className="text-[9px] font-black uppercase tracking-widest text-white/50 mb-2 block">Subtopic</label>
                                 <select
                                    value={subtopicId}
                                    onChange={(e) => setSubtopicId(e.target.value)}
                                    disabled={!topicId}
                                    className="h-12 w-full px-4 bg-white/20 border border-white/20 text-white rounded-xl focus:bg-white focus:text-emerald-900 outline-none transition-all font-bold text-sm backdrop-blur-sm cursor-pointer disabled:opacity-50"
                                 >
                                    <option value="" className="text-gray-900">Select Subtopic...</option>
                                    {filteredSubtopics.map((st) => (
                                       <option key={st.id} value={st.id} className="text-gray-900">{st.title}</option>
                                    ))}
                                 </select>
                              </div>
                        </div>
                        
                        <p className="text-[9px] font-bold text-white/50 bg-black/10 p-3 rounded-lg leading-relaxed">
                           Questions are linked to subtopics for granular analytics. Select a topic first to see its subtopics.
                        </p>
                     </div>
                  </div>
               </>
             )}
          </div>
        </div>
      )}
    </div>
  );
}
