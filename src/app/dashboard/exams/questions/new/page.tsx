"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, Suspense, memo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import MathText from "@/components/MathText";
import LoadingAnimation from "@/components/LoadingAnimation";

type ExamRow = { id: string; exam_number: number; title: string; subject_id: string; passages: PassageRow[] };
type PassageRow = { id: string; title: string | null; kind: "reading" | "reference" };
type TopicRow = { id: string; title: string };
type SubtopicRow = { id: string; topic_id: string; title: string };

type NewOption = {
  key: string;
  text: string;
  file: File | null;
  is_correct: boolean;
};

type SubQuestion = {
  key: string;
  type: "mcq" | "fill";
  prompt: string;
  explanation: string;
  points: string;
  options: NewOption[];
  questionFiles: File[];
  explanationFiles: File[];
  correctText: string;
  topicId: string;
  subtopicId: string;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Sub-components for better performance (avoiding full re-renders on every keystroke)
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
            <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">Sub-Question Item</h3>
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
                         onUpdate(sub.key, { questionFiles: [...sub.questionFiles, ...files] });
                      }} />
                      <button type="button" className="text-[9px] font-black text-primary uppercase tracking-widest hover:underline">+ Add Images</button>
                   </div>
                </div>
                {sub.questionFiles.length > 0 && (
                   <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {sub.questionFiles.map((f, i) => (
                         <div key={i} className="relative group/img h-20 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                            <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" alt="Sub prompt" />
                            <button onClick={() => {
                               const next = [...sub.questionFiles];
                               next.splice(i, 1);
                               onUpdate(sub.key, { questionFiles: next });
                            }} className="absolute top-1 right-1 w-6 h-6 bg-rose-500 text-white rounded-lg opacity-0 group-hover/img:opacity-100 transition-all flex items-center justify-center">
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
                         <div className="flex items-center gap-2">
                           <div className="relative flex-1">
                              <input type="file" accept="image/*" onChange={(e) => {
                                 const f = e.target.files?.[0] || null;
                                 const next = sub.options.map(o => o.key === opt.key ? { ...o, file: f } : o);
                                 onUpdate(sub.key, { options: next });
                              }} className="absolute inset-0 opacity-0 cursor-pointer" />
                              <div className={`h-8 px-3 border border-dashed rounded-lg flex items-center gap-2 text-[10px] font-black transition-all ${opt.file ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-200 text-slate-400'}`}>
                                 <span className="material-symbols-outlined text-[16px]">{opt.file ? 'check_circle' : 'add_photo_alternate'}</span>
                                 <span className="truncate flex-1">{opt.file ? opt.file.name : 'Attach Image'}</span>
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
                         onUpdate(sub.key, { explanationFiles: [...sub.explanationFiles, ...files] });
                      }} />
                      <button type="button" className="text-[9px] font-black text-primary uppercase tracking-widest hover:underline">+ Add Images</button>
                   </div>
                </div>
                {sub.explanationFiles.length > 0 && (
                   <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {sub.explanationFiles.map((f, i) => (
                         <div key={i} className="relative group/img h-20 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                            <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" alt="Sub explanation" />
                            <button onClick={() => {
                               const next = [...sub.explanationFiles];
                               next.splice(i, 1);
                               onUpdate(sub.key, { explanationFiles: next });
                            }} className="absolute top-1 right-1 w-6 h-6 bg-rose-500 text-white rounded-lg opacity-0 group-hover/img:opacity-100 transition-all flex items-center justify-center">
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
                <select value={sub.topicId} onChange={(e) => onUpdate(sub.key, { topicId: e.target.value, subtopicId: "" })} className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:border-primary transition-all">
                   <option value="">Select Topic</option>
                   {topics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
             </div>
             <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1 ml-1">Subtopic</label>
                <select value={sub.subtopicId} onChange={(e) => onUpdate(sub.key, { subtopicId: e.target.value })} className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:border-primary transition-all">
                   <option value="">Select Subtopic</option>
                   {filteredSubtopics.map(st => <option key={st.id} value={st.id}>{st.title}</option>)}
                </select>
             </div>
          </div>
        </div>

        {/* Right Side: Live Preview */}
        <div className="p-8 bg-blue-50/30 flex flex-col items-center justify-center space-y-8">
           <div className="text-[10px] font-black text-primary/40 uppercase tracking-[0.3em] mb-4">Student View Preview</div>
           
           <div className="w-full max-w-md bg-white border border-outline/30 shadow-soft-xl rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="text-[10px] font-black text-primary uppercase tracking-[0.2em] opacity-40">Item #{index + 1}</div>
              
              <div className="text-sm sm:text-base font-medium leading-relaxed">
                 <MathText text={sub.prompt || "Question prompt preview..."} />
              </div>

              {sub.questionFiles.length > 0 && (
                 <div className="space-y-4">
                    {sub.questionFiles.map((f, i) => (
                       <img key={i} src={URL.createObjectURL(f)} className="max-w-full h-auto rounded-2xl border border-outline/20 mx-auto" alt="Sub prompt preview" />
                    ))}
                 </div>
              )}

              {sub.type === 'mcq' ? (
                 <div className="space-y-3">
                    {sub.options.map((opt, i) => (
                       <div key={opt.key} className="flex items-center gap-4 p-4 border border-outline/30 rounded-2xl bg-white hover:border-primary/30 transition-all">
                          <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-xs font-black text-slate-400 border border-outline/20">
                             {String.fromCharCode(65 + i)}
                          </div>
                          <div className="flex-1">
                             <div className="text-sm font-bold text-slate-700">
                                <MathText text={opt.text} />
                             </div>
                             {opt.file && <img src={URL.createObjectURL(opt.file)} className="mt-2 max-w-full h-24 object-contain rounded-lg border border-outline/20" alt="Opt asset" />}
                          </div>
                       </div>
                    ))}
                 </div>
              ) : (
                 <div className="p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-center text-xs font-black text-slate-400">
                    Input Field Placeholder
                 </div>
              )}
           </div>

           {(sub.explanation || sub.explanationFiles.length > 0) && (
              <div className="w-full max-w-md bg-blue-50 border border-blue-100 rounded-3xl p-6 sm:p-8 space-y-4">
                 <div className="flex items-center gap-2 text-blue-600 mb-2">
                    <span className="material-symbols-outlined text-sm">lightbulb</span>
                    <span className="text-[10px] font-black uppercase tracking-widest">Explanation View</span>
                 </div>
                 <div className="text-sm font-medium text-blue-900 leading-relaxed">
                    <MathText text={sub.explanation} />
                 </div>
                 {sub.explanationFiles.map((f, i) => (
                    <img key={i} src={URL.createObjectURL(f)} className="max-w-full h-auto rounded-2xl border border-blue-200/50 mx-auto" alt="Sub expl preview" />
                 ))}
              </div>
           )}
        </div>
      </div>
    </div>
  );
});

const PageHeader = memo(({ exam, examId, saving, submit, onCancel }: { exam: any, examId: string | null, saving: boolean, submit: () => void, onCancel: () => void }) => (
  <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border border-outline/60 shadow-soft-xl rounded-2xl mb-8 p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
    <div className="flex items-center gap-4">
      <button onClick={onCancel} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-on-surface hover:bg-slate-200 transition-all active:scale-95">
        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
      </button>
      <div>
        <h1 className="font-headline text-2xl font-black text-primary tracking-tighter">New Question</h1>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary mt-1 truncate max-w-[200px] sm:max-w-md">
          {exam ? `#${exam.exam_number} • ${exam.title}` : `Exam ID: ${examId}`}
        </p>
      </div>
    </div>
    <div className="flex items-center gap-3 w-full sm:w-auto">
      <button onClick={onCancel} disabled={saving} className="flex-1 sm:flex-none px-6 py-3 font-black text-xs uppercase tracking-widest rounded-xl text-primary border border-outline hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50">Cancel</button>
      <button onClick={submit} disabled={saving} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-primary text-white px-8 py-3 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 active:scale-95">
        <span className="material-symbols-outlined text-[18px]">add_task</span>
        {saving ? "Creating..." : "Create Question"}
      </button>
    </div>
  </div>
));

const OptionInput = memo(({ opt, index, type, allowMultiple, onUpdate, onRemove, onSetCorrect }: { opt: NewOption, index: number, type: string, allowMultiple: boolean, onUpdate: (key: string, patch: Partial<NewOption>) => void, onRemove: (key: string) => void, onSetCorrect: (key: string, val: boolean) => void }) => (
  <div className="bg-white border border-outline/40 rounded-2xl p-5 space-y-4 hover:border-primary/30 transition-all">
    <div className="flex items-center justify-between">
       <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center font-black text-xs">
            {String.fromCharCode(65 + index)}
          </div>
          <label className="flex items-center gap-2 cursor-pointer group">
            <input 
              type={allowMultiple ? "checkbox" : "radio"}
              name={`correct_option_${opt.key}`}
              checked={opt.is_correct}
              onChange={(e) => onSetCorrect(opt.key, e.target.checked)}
              className="w-5 h-5 accent-emerald-500 cursor-pointer"
            />
            <span className={`text-[10px] font-black uppercase tracking-widest ${opt.is_correct ? 'text-emerald-600' : 'text-slate-400 group-hover:text-primary transition-colors'}`}>Correct</span>
          </label>
       </div>
       <button onClick={() => onRemove(opt.key)} className="text-slate-300 hover:text-rose-500 transition-colors">
         <span className="material-symbols-outlined text-[20px]">delete</span>
       </button>
    </div>
    <textarea
      value={opt.text}
      onChange={(e) => onUpdate(opt.key, { text: e.target.value })}
      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:border-primary outline-none transition-all text-sm font-medium"
      placeholder={`Enter option ${String.fromCharCode(65 + index)} text...`}
      rows={3}
    />
    {opt.text && (
       <div className="p-3 bg-indigo-50/30 border border-dashed border-indigo-200 rounded-xl">
          <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Preview</div>
          <MathText text={opt.text} />
       </div>
    )}
    <div className="flex items-center gap-4">
       <div className="relative group flex-1">
          <input type="file" accept="image/*" onChange={(e) => onUpdate(opt.key, { file: e.target.files?.[0] || null })} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
          <div className={`h-10 px-4 border border-dashed rounded-xl flex items-center gap-2 transition-all ${opt.file ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-400 group-hover:border-primary group-hover:text-primary'}`}>
             <span className="material-symbols-outlined text-[18px]">{opt.file ? 'check_circle' : 'add_photo_alternate'}</span>
             <span className="text-[10px] font-black uppercase truncate">{opt.file ? opt.file.name : 'Attach Image'}</span>
          </div>
       </div>
       {opt.file && (
         <button onClick={() => onUpdate(opt.key, { file: null })} className="text-rose-500 hover:text-rose-700 transition-colors">
            <span className="material-symbols-outlined text-[20px]">close</span>
         </button>
       )}
    </div>
  </div>
));

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

  const [questionFiles, setQuestionFiles] = useState<File[]>([]);
  const [explanationFiles, setExplanationFiles] = useState<File[]>([]);
  const [options, setOptions] = useState<NewOption[]>([
    { key: uid(), text: "", file: null, is_correct: false },
    { key: uid(), text: "", file: null, is_correct: false },
    { key: uid(), text: "", file: null, is_correct: false },
    { key: uid(), text: "", file: null, is_correct: false },
  ]);

  const [subQuestions, setSubQuestions] = useState<SubQuestion[]>([]);

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

        const topicsJson = await adminFetch(`/api/admin/topics?subject_id=${json.exam.subject_id}`);
        const subtopicsJson = await adminFetch(`/api/admin/subtopics?subject_id=${json.exam.subject_id}`);
        if (!mounted) return;
        setTopics(topicsJson.items ?? []);
        setAllSubtopics(subtopicsJson.items ?? []);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Something went wrong.";
        if (!mounted) return;
        setError(msg);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    run();
    return () => { mounted = false; };
  }, [examId]);

  const filteredSubtopics = useMemo(() => {
    if (!topicId) return [];
    return allSubtopics.filter(st => st.topic_id === topicId);
  }, [topicId, allSubtopics]);

  const updateOption = useCallback((key: string, patch: Partial<NewOption>) => {
    setOptions(prev => prev.map(o => o.key === key ? { ...o, ...patch } : o));
  }, []);

  const removeOption = useCallback((key: string) => {
    setOptions(prev => prev.filter(o => o.key !== key));
  }, []);

  const setOptionCorrect = useCallback((key: string, next: boolean) => {
    setOptions((prev) => {
      if (type !== "mcq") return prev;
      if (allowMultiple) return prev.map((o) => (o.key === key ? { ...o, is_correct: next } : o));
      if (!next) return prev.map((o) => (o.key === key ? { ...o, is_correct: false } : o));
      return prev.map((o) => ({ ...o, is_correct: o.key === key }));
    });
  }, [type, allowMultiple]);
  
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

  const updateSubQuestion = (key: string, patch: Partial<SubQuestion>) => {
    setSubQuestions(prev => prev.map(s => s.key === key ? { ...s, ...patch } : s));
  };

  const removeSubQuestion = (key: string) => {
    setSubQuestions(prev => prev.filter(s => s.key !== key));
  };

  const reorderSubQuestion = (key: string, direction: 'up' | 'down') => {
    setSubQuestions(prev => {
      const idx = prev.findIndex(s => s.key === key);
      if (idx === -1) return prev;
      const nextIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[nextIdx]] = [copy[nextIdx], copy[idx]];
      return copy;
    });
  };

  function resetForm() {
    setPrompt("");
    setCorrectText("");
    setExplanationText("");
    setQuestionFiles([]);
    setExplanationFiles([]);
    setOptions([
      { key: uid(), text: "", file: null, is_correct: false },
      { key: uid(), text: "", file: null, is_correct: false },
      { key: uid(), text: "", file: null, is_correct: false },
      { key: uid(), text: "", file: null, is_correct: false },
    ]);
    setSubQuestions([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    if (!examId) return;
    const pts = Math.trunc(Number(points));
    if (!Number.isFinite(pts) || pts < 0) {
      setError("Invalid points.");
      return;
    }

    // Basic Validation
    if (type === 'reference_block') {
      if (!prompt.trim() && questionFiles.length === 0) {
        setError("Reference block must have at least text or one image.");
        return;
      }
      if (subQuestions.length === 0) {
        setError("Reference block must have at least one sub-question.");
        return;
      }
      // Sub-questions validation
      for (let s of subQuestions) {
        if (!s.prompt.trim()) { setError("Sub-question is missing prompt."); return; }
        if (!s.subtopicId) { setError("Sub-question is missing subtopic."); return; }
        if (s.type === 'mcq') {
          const usable = s.options.filter(o => o.text.trim() || o.file);
          if (usable.length < 2) { setError("Each MCQ sub-question needs at least 2 options."); return; }
          if (!usable.some(o => o.is_correct)) { setError("Each sub-question must have a correct option."); return; }
        } else {
          if (!s.correctText.trim()) { setError("Fill sub-questions need a correct answer."); return; }
        }
      }
    } else {
      // Standard validation
      if (!prompt.trim() && questionFiles.length === 0) {
        setError("Add prompt text or at least one image.");
        return;
      }
      if (type === "fill") {
        if (!correctText.trim()) { setError("Correct text is required for Fill."); return; }
      } else {
        const usable = options.filter((o) => o.text.trim() || o.file);
        if (usable.length < 2) { setError("MCQ needs at least 2 options."); return; }
        if (!usable.some(o => o.is_correct)) { setError("Mark at least 1 correct option."); return; }
        if (!allowMultiple && usable.filter(o => o.is_correct).length !== 1) {
          setError("Single-answer MCQ must have exactly 1 correct option.");
          return;
        }
      }
      if (!subtopicId) { setError("Please select a subtopic."); return; }
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    const uploadAndGetAsset = async (questionId: string, file: File, kind: "prompt" | "explanation", i: number) => {
        const safeName = file.name.replaceAll(" ", "-");
        const path = `questions/${questionId}/${kind === 'explanation' ? 'explanations/' : ''}${Date.now()}-${i}-${safeName}`;
        const { error: upErr } = await supabase.storage.from(storageBucket).upload(path, file, { upsert: false });
        if (upErr) throw new Error(upErr.message);
        const publicUrl = supabase.storage.from(storageBucket).getPublicUrl(path).data.publicUrl;
        return { bucket: storageBucket, storage_path: path, url: publicUrl, alt: file.name, kind, sort_order: i };
    };

    const uploadAndGetOption = async (questionId: string, opt: NewOption, i: number) => {
        let url: string | null = null;
        let storagePath: string | null = null;
        if (opt.file) {
          const safeName = opt.file.name.replaceAll(" ", "-");
          const path = `questions/${questionId}/options/${Date.now()}-${uid()}-${safeName}`;
          const { error: upErr } = await supabase.storage.from(storageBucket).upload(path, opt.file, { upsert: false });
          if (upErr) throw new Error(upErr.message);
          url = supabase.storage.from(storageBucket).getPublicUrl(path).data.publicUrl;
          storagePath = path;
        }
        return { text: opt.text.trim() || null, bucket: storageBucket, storage_path: storagePath, url, is_correct: opt.is_correct };
    };

    try {
      if (type === 'reference_block') {
        // 1. Create Parent Block
        const blockCreated = await adminFetch(`/api/admin/exams/${examId}`, {
          method: "POST",
          body: JSON.stringify({
            action: "create_question",
            type: "reference_block",
            prompt_text: prompt.trim() || null,
            points: 0,
            topic_id: topicId || null,
            subtopic_id: subtopicId || null,
          })
        }) as { question: { id: string } };

        const blockId = blockCreated.question.id;

        // 2. Upload Block Assets
        if (questionFiles.length > 0) {
          const bAssets = await Promise.all(questionFiles.map((f, i) => uploadAndGetAsset(blockId, f, "prompt", i)));
          await adminFetch(`/api/admin/questions/${blockId}`, {
            method: "POST",
            body: JSON.stringify({ action: "batch_assets", assets: bAssets })
          });
        }

        // 3. Create Sub-questions
        for (let s of subQuestions) {
           const sCreated = await adminFetch(`/api/admin/exams/${examId}`, {
             method: "POST",
             body: JSON.stringify({
               action: "create_question",
               type: s.type,
               parent_id: blockId,
               prompt_text: s.prompt.trim(),
               explanation_text: s.explanation.trim() || null,
               points: Math.max(0, Math.trunc(Number(s.points))),
               correct_text: s.type === 'fill' ? s.correctText.trim() : null,
               topic_id: s.topicId || null,
               subtopic_id: s.subtopicId || null,
               allow_multiple: false 
             })
           }) as { question: { id: string } };

           const sId = sCreated.question.id;
           
           // Upload sub-question prompt + explanation assets
           const sAssetPromises = [
             ...s.questionFiles.map((f, i) => uploadAndGetAsset(sId, f, "prompt", i)),
             ...s.explanationFiles.map((f, i) => uploadAndGetAsset(sId, f, "explanation", i))
           ];
           const sAssets = await Promise.all(sAssetPromises);
           if (sAssets.length > 0) {
             await adminFetch(`/api/admin/questions/${sId}`, {
               method: "POST",
               body: JSON.stringify({ action: "batch_assets", assets: sAssets })
             });
           }

           // Upload sub-question options
           if (s.type === 'mcq') {
              const sOptions = await Promise.all(s.options.filter(o => o.text.trim() || o.file).map((o, i) => uploadAndGetOption(sId, o, i)));
              await adminFetch(`/api/admin/questions/${sId}`, {
                method: "POST",
                body: JSON.stringify({ action: "batch_options", options: sOptions })
              });
           }
        }

      } else {
        // Standard logic
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
            subtopic_id: subtopicId || null,
          }),
        })) as { question: { id: string } };

        const questionId = created.question.id;

        const assetPromises = [
          ...questionFiles.map((f, i) => uploadAndGetAsset(questionId, f, "prompt", i)),
          ...explanationFiles.map((f, i) => uploadAndGetAsset(questionId, f, "explanation", i))
        ];

        const optionPromises = type === "mcq" 
          ? options.filter(o => o.text.trim() || o.file).map((o, i) => uploadAndGetOption(questionId, o, i))
          : [];

        const [pAssets, pOptions] = await Promise.all([
            Promise.all(assetPromises),
            Promise.all(optionPromises)
        ]);

        const batchPromises = [];
        if (pAssets.length > 0) {
            batchPromises.push(adminFetch(`/api/admin/questions/${questionId}`, {
                method: "POST",
                body: JSON.stringify({ action: "batch_assets", assets: pAssets })
            }));
        }
        if (pOptions.length > 0) {
            batchPromises.push(adminFetch(`/api/admin/questions/${questionId}`, {
                method: "POST",
                body: JSON.stringify({ action: "batch_options", options: pOptions })
            }));
        }
        await Promise.all(batchPromises);
      }

      setMessage("Question added successfully!");
      resetForm();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-full">
      <PageHeader exam={exam} examId={examId} saving={saving} submit={submit} onCancel={() => router.push(`/dashboard/exams/${examId}`)} />

      {error ? (
        <div className="mb-8 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-3 animate-slide-up">
          <span className="material-symbols-outlined text-rose-500">error</span>
          <span className="text-sm font-bold">{error}</span>
        </div>
      ) : null}

      {message ? (
        <div className="mb-8 p-5 bg-emerald-50 border-2 border-emerald-200 text-emerald-800 rounded-2xl flex items-center justify-between gap-3 animate-bounce shadow-lg shadow-emerald-100">
          <div className="flex items-center gap-3">
             <span className="material-symbols-outlined text-emerald-500 text-3xl">check_circle</span>
             <span className="text-sm font-black uppercase tracking-tight">{message}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-emerald-400 hover:text-emerald-700">
             <span className="material-symbols-outlined">close</span>
          </button>
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
                      <div className="mt-4 p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl"><MathText text={prompt} /></div>
                    )}
                  </div>

                  {type !== "reference_block" && type === "fill" && (
                    <div className="animate-fade-in">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-3 ml-1">Correct Answer (Fill Only)</label>
                       <input
                        value={correctText}
                        onChange={(e) => setCorrectText(e.target.value)}
                        className="h-14 w-full px-6 bg-emerald-50 border border-emerald-100 rounded-2xl focus:border-emerald-500 focus:bg-white outline-none transition-all font-bold text-lg text-emerald-900"
                        placeholder="Exact text for correct answer..."
                      />
                    </div>
                  )}

                  <div className="pt-6 border-t border-outline/20">
                    <div className="text-xs font-black text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">imagesmode</span>{type === 'reference_block' ? 'Block Images' : 'Question Images'}
                    </div>
                    <input type="file" multiple accept="image/*" onChange={(e) => setQuestionFiles(Array.from(e.target.files ?? []))} className="mb-2 text-xs" />
                    <div className="text-[9px] font-bold text-slate-400">{questionFiles.length} files selected</div>
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
                     <button type="button" onClick={addSubQuestion} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-indigo-100">+ Add Sub-Question</button>
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
               <div className="p-8 space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3 ml-1">Step-by-step Solution</label>
                    <textarea
                      value={explanationText}
                      onChange={(e) => setExplanationText(e.target.value)}
                      rows={6}
                      className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl focus:border-amber-400 focus:bg-white outline-none transition-all font-medium text-base leading-relaxed"
                      placeholder="Why is it correct? Enter the step-by-step solution..."
                    />
                    {explanationText && (
                      <div className="mt-4 p-4 bg-amber-50/20 border border-dashed border-amber-200 rounded-xl">
                        <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2">Live Preview</div>
                        <MathText text={explanationText} />
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-black text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">attachment</span>Explanation Images
                    </div>
                    <input type="file" multiple accept="image/*" onChange={(e) => setExplanationFiles(Array.from(e.target.files ?? []))} className="text-xs" />
                  </div>
               </div>
            </div>
         )}

            {type === "mcq" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-primary/5 text-primary flex items-center justify-center">
                        <span className="material-symbols-outlined">checklist</span>
                      </div>
                      <h2 className="text-sm font-black uppercase tracking-widest text-primary">Answer Options</h2>
                   </div>
                   <button type="button" onClick={() => setOptions([...options, { key: uid(), text: "", file: null, is_correct: false }])} className="text-xs font-black uppercase text-secondary hover:text-primary transition-all flex items-center gap-1">+ Add Option</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {options.map((opt, idx) => (
                     <OptionInput key={opt.key} opt={opt} index={idx} type={type} allowMultiple={allowMultiple} onUpdate={updateOption} onRemove={removeOption} onSetCorrect={setOptionCorrect} />
                   ))}
                </div>
              </div>
            )}
          </div>

          <div className="xl:col-span-4 space-y-8">
            <div className="bg-white border border-outline/60 shadow-soft-xl rounded-3xl overflow-hidden p-8 space-y-8">
               <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Question Type</label>
                  <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-outline/40">
                     <button type="button" onClick={() => setType("mcq")} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${type === 'mcq' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-primary'}`}>MCQ</button>
                     <button type="button" onClick={() => setType("fill")} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${type === 'fill' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-primary'}`}>Fill</button>
                     <button type="button" onClick={() => setType("reference_block")} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${type === 'reference_block' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-primary'}`}>Reference</button>
                  </div>
               </div>

               {type === "mcq" && (
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Multiple Selection</label>
                    <button type="button" onClick={() => setAllowMultiple(!allowMultiple)} className={`w-full py-3 px-4 border-2 rounded-2xl flex items-center justify-between transition-all ${allowMultiple ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 text-slate-400'}`}>
                       <span className="text-xs font-black uppercase">Enable Multiple</span>
                       <span className="material-symbols-outlined">{allowMultiple ? 'toggle_on' : 'toggle_off'}</span>
                    </button>
                 </div>
               )}

               <div className="grid grid-cols-2 gap-6">
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Points</label>
                    <input type="number" value={points} onChange={(e) => setPoints(e.target.value)} className="h-12 w-full px-4 bg-slate-50 border border-slate-200 rounded-xl focus:border-primary outline-none font-bold text-center" />
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Reading Passage</label>
                    <select value={passageId} onChange={(e) => setPassageId(e.target.value)} className="h-12 w-full px-4 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-xs appearance-none">
                      <option value="">None</option>
                      {passages.map(p => <option key={p.id} value={p.id}>{p.title || p.kind}</option>)}
                    </select>
                 </div>
               </div>

               <div className="space-y-6 pt-6 border-t border-outline/20">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Topic</label>
                    <select value={topicId} onChange={(e) => { setTopicId(e.target.value); setSubtopicId(""); }} className="h-12 w-full px-4 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-xs">
                      <option value="">Select Topic</option>
                      {topics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Subtopic</label>
                    <select value={subtopicId} onChange={(e) => setSubtopicId(e.target.value)} disabled={!topicId} className="h-12 w-full px-4 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-xs disabled:opacity-50">
                      <option value="">{topicId ? "Select Subtopic" : "Select Topic First"}</option>
                      {filteredSubtopics.map(st => <option key={st.id} value={st.id}>{st.title}</option>)}
                    </select>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewQuestionPage() {
  return (
    <Suspense fallback={<LoadingAnimation />}>
      <NewQuestionContent />
    </Suspense>
  );
}
