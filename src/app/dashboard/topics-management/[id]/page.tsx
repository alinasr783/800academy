"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import MathText from "@/components/MathText";
import LoadingAnimation from "@/components/LoadingAnimation";
import QuestionBankPicker from "@/app/dashboard/exams/QuestionBankPicker";

type SubtopicRow = {
  id: string;
  topic_id: string;
  subject_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
  is_free: boolean;
};

type SubtopicPoint = {
  id?: string;
  key: string;
  content_html: string;
  assets: any[];
  newAssets: File[];
  questions: any[];
};

function uid() { return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }

export default function TopicBuilderPage() {
  const params = useParams<{ id: string }>();
  const subtopicId = params.id;
  const storageBucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "assets";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subtopic, setSubtopic] = useState<SubtopicRow | null>(null);
  const [points, setPoints] = useState<SubtopicPoint[]>([]);
  const [showPickerForPoint, setShowPickerForPoint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState("");

  async function load() {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const topicRes = await fetch(`/api/admin/subtopics?id=${subtopicId}`, { headers: { Authorization: `Bearer ${token}` } });
      const topicJson = await topicRes.json();
      const t = topicJson.items?.find((x: any) => x.id === subtopicId);
      if (!t) throw new Error("Subtopic not found");
      setSubtopic(t);
      setTitle(t.title);
      setDescription(t.description ?? "");
      setCategory(t.category ?? "");
      setIsFree(t.is_free);
      setCoverUrl(t.image_url ?? "");

      const pointsRes = await fetch(`/api/admin/topic-lessons?subtopic_id=${subtopicId}`, { headers: { Authorization: `Bearer ${token}` } });
      const pointsJson = await pointsRes.json();
      
      const mappedPoints: SubtopicPoint[] = (pointsJson.points ?? []).map((p: any) => ({
        id: p.id,
        key: uid(),
        content_html: p.content_html ?? "",
        assets: p.subtopic_point_assets ?? [],
        newAssets: [],
        questions: (p.subtopic_point_questions ?? []).map((q: any) => ({ ...q.question_bank, pivot_id: q.id }))
      }));
      setPoints(mappedPoints);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [subtopicId]);

  async function saveAll() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      let finalCoverUrl = coverUrl;
      if (coverFile) {
         const safeName = coverFile.name.replaceAll(" ", "-");
         const path = `subtopics/${subtopicId}/cover-${Date.now()}-${safeName}`;
         const { error: upErr } = await supabase.storage.from(storageBucket).upload(path, coverFile);
         if (upErr) throw upErr;
         finalCoverUrl = supabase.storage.from(storageBucket).getPublicUrl(path).data.publicUrl;
      }

      await fetch(`/api/admin/subtopics?id=${subtopicId}`, {
         method: "PATCH",
         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
         body: JSON.stringify({ title, description, category, is_free: isFree, image_url: finalCoverUrl })
      });

      const pointsPayload = [];
      for (const p of points) {
         const uploadedAssets = [];
         for (let i = 0; i < p.newAssets.length; i++) {
            const f = p.newAssets[i];
            const safeName = f.name.replaceAll(" ", "-");
            const path = `subtopics/${subtopicId}/points/${Date.now()}-${i}-${safeName}`;
            const { error: upErr } = await supabase.storage.from(storageBucket).upload(path, f);
            if (upErr) throw upErr;
            const url = supabase.storage.from(storageBucket).getPublicUrl(path).data.publicUrl;
            uploadedAssets.push({ url, storage_path: path, bucket: storageBucket });
         }
         
         pointsPayload.push({
            id: p.id,
            content_html: p.content_html,
            assets: [
               ...p.assets.map((a, idx) => ({ ...a, sort_order: idx })), 
               ...uploadedAssets.map((a, idx) => ({ ...a, sort_order: p.assets.length + idx }))
            ],
            questions: p.questions.map(q => q.id)
         });
      }

      const syncRes = await fetch(`/api/admin/topic-lessons`, {
         method: "POST",
         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
         body: JSON.stringify({ action: "sync_subtopic_points", subtopic_id: subtopicId, points: pointsPayload })
      });
      if (!syncRes.ok) throw new Error("Failed to sync lesson points.");

      setMessage("Lesson saved successfully!");
      setCoverFile(null);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const handleImportQuestions = (bankIds: string[]) => {
    if (!showPickerForPoint) return;
    setPoints(prev => prev.map(p => {
       if (p.key !== showPickerForPoint) return p;
       const newQs = bankIds.map(id => ({ id, prompt_text: "Imported from Bank (Save to view details)" }));
       return { ...p, questions: [...p.questions, ...newQs] };
    }));
    setShowPickerForPoint(null);
  };

  if (loading) return <LoadingAnimation />;

  return (
    <div className="max-w-4xl mx-auto pb-32">
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border border-outline/60 shadow-soft-xl rounded-2xl mb-10 p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <Link href="/dashboard/topics-management" className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 transition-all active:scale-95 group">
             <span className="material-symbols-outlined text-slate-500 group-hover:text-primary">arrow_back</span>
          </Link>
          <div>
            <h1 className="font-headline text-2xl font-black text-primary tracking-tighter leading-none">Lesson Builder</h1>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-secondary mt-2">Subtopic: {subtopic?.title}</p>
          </div>
        </div>
        <button onClick={saveAll} disabled={saving} className="h-12 bg-primary text-white px-8 rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50">
          {saving ? "Publishing..." : "Save Lesson"}
        </button>
      </div>

      <div className="space-y-10">
         <div className="bg-white border border-outline/40 shadow-soft-xl rounded-2xl p-8 flex flex-col md:flex-row gap-8">
            <div className="w-48 h-48 rounded-2xl border-2 border-dashed border-outline/60 bg-slate-50 relative overflow-hidden group flex-shrink-0">
               {coverFile ? (
                  <img src={URL.createObjectURL(coverFile)} className="w-full h-full object-cover" alt="cover" />
               ) : coverUrl ? (
                  <img src={coverUrl} className="w-full h-full object-cover" alt="cover" />
               ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300">
                     <span className="material-symbols-outlined text-4xl mb-2">add_photo_alternate</span>
                     <span className="text-[10px] font-black uppercase tracking-widest text-center px-4">Upload Cover Image</span>
                  </div>
               )}
               <input type="file" accept="image" onChange={e => setCoverFile(e.target.files?.[0] ?? null)} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
            
            <div className="flex-1 space-y-6">
               <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Lesson Title</label>
                  <input value={title} onChange={e => setTitle(e.target.value)} className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-lg font-black text-primary outline-none focus:border-primary transition-all" />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Category / Tag</label>
                     <input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Algebra, Grammar" className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:border-primary transition-all" />
                  </div>
                  <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Access Type</label>
                     <select value={isFree ? "free" : "paid"} onChange={e => setIsFree(e.target.value === "free")} className={`w-full h-12 px-4 border rounded-xl text-xs font-black uppercase tracking-widest outline-none transition-all ${isFree ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                        <option value="free">Free Preview</option>
                        <option value="paid">Premium (Requires Package)</option>
                     </select>
                  </div>
               </div>
            </div>
         </div>

         <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
               <h2 className="text-xl font-black text-primary tracking-tighter">Explanation Points</h2>
               <button onClick={() => setPoints([...points, { key: uid(), content_html: "", assets: [], newAssets: [], questions: [] }])} className="h-10 px-5 bg-secondary text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md shadow-secondary/20 hover:bg-primary transition-all active:scale-95">
                  + Add Point
               </button>
            </div>

            {points.length === 0 && (
               <div className="p-20 bg-white border border-dashed border-outline/60 rounded-2xl text-center text-slate-400">
                  <span className="material-symbols-outlined text-5xl mb-4 opacity-50">timeline</span>
                  <p className="font-bold text-sm">No points added yet. Start building your lesson!</p>
               </div>
            )}

            {points.map((pt, pIdx) => (
               <div key={pt.key} className="bg-white border border-outline/40 shadow-soft-xl rounded-2xl overflow-hidden">
                  <div className="p-3 bg-slate-50 border-b border-outline/30 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center font-black text-xs">{pIdx + 1}</div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">Content Point</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <button onClick={() => {
                           if (pIdx === 0) return;
                           const next = [...points];
                           [next[pIdx], next[pIdx - 1]] = [next[pIdx - 1], next[pIdx]];
                           setPoints(next);
                        }} disabled={pIdx === 0} className="w-8 h-8 bg-white rounded-md border border-slate-200 flex items-center justify-center text-slate-400 hover:text-primary disabled:opacity-30"><span className="material-symbols-outlined text-[18px]">arrow_upward</span></button>
                        <button onClick={() => {
                           if (pIdx === points.length - 1) return;
                           const next = [...points];
                           [next[pIdx], next[pIdx + 1]] = [next[pIdx + 1], next[pIdx]];
                           setPoints(next);
                        }} disabled={pIdx === points.length - 1} className="w-8 h-8 bg-white rounded-md border border-slate-200 flex items-center justify-center text-slate-400 hover:text-primary disabled:opacity-30"><span className="material-symbols-outlined text-[18px]">arrow_downward</span></button>
                        <button onClick={() => setPoints(points.filter(x => x.key !== pt.key))} className="w-8 h-8 ml-2 bg-rose-50 text-rose-500 rounded-md flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                     </div>
                  </div>
                  
                  <div className="p-6 space-y-6">
                     <div className="flex items-center justify-between">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Visual Examples (Images) — Drag to Reorder</label>
                       <div className="relative">
                          <input type="file" multiple accept="image" onChange={e => {
                             const next = [...points];
                             next[pIdx].newAssets = [...next[pIdx].newAssets, ...Array.from(e.target.files ?? [])];
                             setPoints(next);
                          }} className="absolute inset-0 opacity-0 cursor-pointer" />
                          <button className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/5 px-4 py-2 rounded-lg border border-primary/10 hover:bg-primary hover:text-white transition-all">+ Add Images</button>
                       </div>
                     </div>
                     {(pt.assets.length > 0 || pt.newAssets.length > 0) && (
                        <div className="flex flex-wrap gap-4 p-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                           {pt.assets.map((a, aIdx) => (
                              <div 
                                 key={a.id} 
                                 draggable
                                 onDragStart={(e) => e.dataTransfer.setData("assetIndex", aIdx.toString())}
                                 onDragOver={(e) => e.preventDefault()}
                                 onDrop={(e) => {
                                    e.preventDefault();
                                    const fromIdx = parseInt(e.dataTransfer.getData("assetIndex"));
                                    const toIdx = aIdx;
                                    if (fromIdx === toIdx) return;
                                    
                                    const next = [...points];
                                    const pointAssets = [...next[pIdx].assets];
                                    const [moved] = pointAssets.splice(fromIdx, 1);
                                    pointAssets.splice(toIdx, 0, moved);
                                    next[pIdx].assets = pointAssets;
                                    setPoints(next);
                                 }}
                                 className="relative w-32 h-24 rounded-xl border border-outline/30 overflow-hidden bg-white cursor-move active:scale-95 transition-transform"
                              >
                                 <img src={a.url} className="w-full h-full object-cover pointer-events-none" alt="asset" />
                                 <button onClick={() => {
                                    const next = [...points];
                                    next[pIdx].assets = next[pIdx].assets.filter(x => x.id !== a.id);
                                    setPoints(next);
                                 }} className="absolute top-1 right-1 bg-rose-500 text-white rounded w-6 h-6 flex items-center justify-center opacity-0 hover:opacity-100 transition-all z-10"><span className="material-symbols-outlined text-[14px]">close</span></button>
                              </div>
                           ))}
                           {pt.newAssets.map((f, i) => (
                              <div 
                                 key={`new-${i}`} 
                                 draggable
                                 onDragStart={(e) => e.dataTransfer.setData("newAssetIndex", i.toString())}
                                 onDragOver={(e) => e.preventDefault()}
                                 onDrop={(e) => {
                                    e.preventDefault();
                                    const fromIdx = parseInt(e.dataTransfer.getData("newAssetIndex"));
                                    if (isNaN(fromIdx)) return; 
                                    const toIdx = i;
                                    if (fromIdx === toIdx) return;
                                    
                                    const next = [...points];
                                    const newAssets = [...next[pIdx].newAssets];
                                    const [moved] = newAssets.splice(fromIdx, 1);
                                    newAssets.splice(toIdx, 0, moved);
                                    next[pIdx].newAssets = newAssets;
                                    setPoints(next);
                                 }}
                                 className="relative w-32 h-24 rounded-xl border-2 border-primary/30 overflow-hidden bg-white cursor-move active:scale-95 transition-transform"
                              >
                                 <img src={URL.createObjectURL(f)} className="w-full h-full object-cover pointer-events-none" alt="new" />
                                 <button onClick={() => {
                                    const next = [...points];
                                    next[pIdx].newAssets = next[pIdx].newAssets.filter((_, idx) => idx !== i);
                                    setPoints(next);
                                 }} className="absolute top-1 right-1 bg-rose-500 text-white rounded w-6 h-6 flex items-center justify-center opacity-0 hover:opacity-100 transition-all z-10"><span className="material-symbols-outlined text-[14px]">close</span></button>
                                 <div className="absolute bottom-0 inset-x-0 bg-primary opacity-80 text-[7px] font-black text-white text-center py-0.5 uppercase pointer-events-none">New</div>
                              </div>
                           ))}
                        </div>
                     )}
                  </div>

                  <div>
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Explanation Content (Supports Math & HTML)</label>
                     <textarea value={pt.content_html} onChange={e => {
                        const next = [...points];
                        next[pIdx].content_html = e.target.value;
                        setPoints(next);
                     }} rows={6} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-primary transition-all" placeholder="Write the lesson content here..." />
                  </div>

                  <div className="space-y-4 pt-4 border-t border-outline/20">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <span className="material-symbols-outlined text-indigo-500 text-[18px]">quiz</span>
                           <label className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Attached Practice Questions</label>
                        </div>
                        <button onClick={() => setShowPickerForPoint(pt.key)} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all">+ Add from Bank</button>
                     </div>
                     
                     {pt.questions.length > 0 ? (
                        <div className="space-y-2">
                           {pt.questions.map((q, qIdx) => (
                              <div key={`q-${pIdx}-${qIdx}`} className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between">
                                 <div className="flex items-center gap-3">
                                    <div className="w-5 h-5 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center text-[9px] font-black">{qIdx + 1}</div>
                                    <div className="text-xs font-medium text-slate-700 line-clamp-1"><MathText text={q.prompt_text ?? "Imported Question"} /></div>
                                 </div>
                                 <button onClick={() => {
                                    const next = [...points];
                                    next[pIdx].questions = next[pIdx].questions.filter((_, idx) => idx !== qIdx);
                                    setPoints(next);
                                 }} className="w-6 h-6 bg-white text-rose-400 rounded flex items-center justify-center opacity-0 hover:opacity-100 transition-all hover:text-rose-600 shadow-sm"><span className="material-symbols-outlined text-[14px]">close</span></button>
                              </div>
                           ))}
                        </div>
                     ) : (
                        <div className="p-3 border border-dashed border-outline/40 rounded-xl text-center text-[9px] font-black text-slate-300 uppercase tracking-widest">No questions attached</div>
                     )}
                  </div>
               </div>
            ))}
         </div>
      </div>

      <QuestionBankPicker 
        isOpen={!!showPickerForPoint} 
        onClose={() => setShowPickerForPoint(null)} 
        onImport={handleImportQuestions} 
      />
    </div>
  );
}