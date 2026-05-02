"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type SubjectRow = { id: string; title: string };
type SubtopicRow = {
  id: string;
  topic_id: string;
  subject_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
  is_free: boolean;
  created_at: string;
  sort_order?: number;
};
type TopicRow = { id: string; title: string };

export default function TopicsManagementPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalOrder, setOriginalOrder] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [subtopics, setSubtopics] = useState<SubtopicRow[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Add sort_order to type for subtopics
  async function loadData() {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const subRes = await fetch("/api/admin/packages?limit=500", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const subJson = await subRes.json();
      setSubjects(subJson.items || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Update sort_order function
  async function updateSortOrder(reorderedSubtopics: SubtopicRow[]) {
    setSubtopics(reorderedSubtopics);
    const newOrderIds = reorderedSubtopics.map(st => st.id);
    const changed = JSON.stringify(newOrderIds) !== JSON.stringify(originalOrder);
    setHasChanges(changed);
    
    // Auto-save immediately
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const updates = reorderedSubtopics.map((st, index) => ({
        id: st.id,
        sort_order: index * 10
      }));

      for (const update of updates) {
        await fetch(`/api/admin/subtopics?id=${update.id}`, {
          method: "PATCH",
          headers: { 
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ sort_order: update.sort_order })
        });
      }

      setOriginalOrder(newOrderIds);
      setHasChanges(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function fetchTopics() {
    if (!selectedSubject) {
       setTopics([]);
       setSelectedTopic("");
       return;
    }
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`/api/admin/topics?subject_id=${selectedSubject}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      setTopics(json.items || []);
      setSelectedTopic("");
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function fetchSubtopics() {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      let url = `/api/admin/subtopics?`;
      if (selectedSubject) url += `subject_id=${selectedSubject}&`;
      if (selectedTopic) url += `topic_id=${selectedTopic}`;

      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      setSubtopics(json.items || []);
      // Store original order for change detection
      setOriginalOrder((json.items || []).map((st: SubtopicRow) => st.id));
      setHasChanges(false);
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!loading) fetchTopics();
  }, [selectedSubject]);

  useEffect(() => {
    if (!loading) fetchSubtopics();
  }, [selectedSubject, selectedTopic, loading]);

  return (
    <div className="space-y-8 pb-32">
      {/* Header */}
      <div className="bg-white border border-outline/60 shadow-soft-xl p-8 rounded-[24px] flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="text-secondary font-black text-[10px] uppercase tracking-[0.3em] mb-2">Curriculum Builder</div>
          <h1 className="font-headline text-4xl font-black text-primary tracking-tighter">Lessons (Subtopics)</h1>
          <p className="text-on-surface-variant font-medium mt-2">Manage categories, cover images, and build interactive lessons for subtopics.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-outline/60 shadow-soft-xl p-6 rounded-[24px] grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Filter by Package</label>
          <select 
            value={selectedSubject} 
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary transition-all"
          >
            <option value="">All Packages</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Filter by Topic</label>
          <select 
            value={selectedTopic} 
            onChange={(e) => setSelectedTopic(e.target.value)}
            disabled={!selectedSubject}
            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary transition-all disabled:opacity-50"
          >
            <option value="">All Topics</option>
            {topics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </div>
      </div>

      {/* List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
            {selectedTopic ? 'Drag to reorder lessons' : 'Select a topic to reorder lessons'}
          </span>
          <div className="flex items-center gap-3">
            {hasChanges && (
              <span className="text-xs font-black text-amber-600 bg-amber-50 px-3 py-1 rounded-full">Unsaved Changes</span>
            )}
            {saving ? (
              <span className="text-xs font-black text-primary animate-pulse flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                Saving...
              </span>
            ) : !hasChanges && selectedTopic ? (
              <span className="text-xs font-black text-emerald-600 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                Saved
              </span>
            ) : null}
          </div>
        </div>
        
        {loading ? (
          <div className="p-20 text-center font-bold text-on-surface-variant animate-pulse">Loading Lessons...</div>
        ) : subtopics.length === 0 ? (
          <div className="p-20 bg-white border border-dashed border-outline/60 rounded-[24px] text-center">
             <span className="material-symbols-outlined text-[64px] text-outline/40 mb-4">menu_book</span>
             <p className="font-bold text-on-surface-variant">No subtopics found. Create subtopics first.</p>
          </div>
        ) : selectedTopic ? (
          <div className="grid grid-cols-1 gap-3">
            {subtopics.map((subtopic, index) => {
               const subject = subjects.find(s => s.id === subtopic.subject_id);
               return (
                 <div 
                   key={subtopic.id}
                   draggable
                   onDragStart={(e) => e.dataTransfer.setData("lessonIndex", index.toString())}
                   onDragOver={(e) => e.preventDefault()}
                   onDrop={(e) => {
                      e.preventDefault();
                      const fromIdx = parseInt(e.dataTransfer.getData("lessonIndex"));
                      const toIdx = index;
                      if (fromIdx === toIdx) return;
                      
                      const newOrder = [...subtopics];
                      const [moved] = newOrder.splice(fromIdx, 1);
                      newOrder.splice(toIdx, 0, moved);
                      updateSortOrder(newOrder);
                   }}
                   className="bg-white border-2 border-slate-200 rounded-xl p-4 flex items-center gap-4 cursor-move active:scale-[0.99] transition-all hover:border-primary/40 hover:shadow-md"
                 >
                   <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                      <span className="material-symbols-outlined text-lg">drag_indicator</span>
                   </div>
                   <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center font-black text-primary text-sm">
                      {index + 1}
                   </div>
                   <div className="w-16 h-16 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                      {subtopic.image_url ? (
                        <img src={subtopic.image_url} alt={subtopic.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                           <span className="material-symbols-outlined text-slate-300 text-xl">image</span>
                        </div>
                      )}
                   </div>
                   <div className="flex-1 min-w-0">
                      <div className="text-[9px] font-black text-primary/60 uppercase tracking-widest">{subtopic.category || 'General'}</div>
                      <h3 className="font-bold text-slate-800 leading-tight truncate">{subtopic.title}</h3>
                   </div>
                   <Link 
                     href={`/dashboard/topics-management/${subtopic.id}`}
                     className="h-10 px-4 bg-primary text-white rounded-lg font-black text-[9px] uppercase tracking-widest flex items-center justify-center hover:bg-slate-800 transition-all shrink-0"
                   >
                     Build
                   </Link>
                 </div>
               );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {subtopics.map((subtopic) => {
               const subject = subjects.find(s => s.id === subtopic.subject_id);
               return (
                 <div key={subtopic.id} className="bg-white border border-outline/40 shadow-soft-xl rounded-[24px] overflow-hidden group hover:border-primary/40 transition-all flex flex-col">
                   <div className="relative h-40 bg-slate-100 overflow-hidden">
                      {subtopic.image_url ? (
                         <img src={subtopic.image_url} alt={subtopic.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                         <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                            <span className="material-symbols-outlined text-4xl">image</span>
                            <span className="text-[10px] font-black uppercase mt-2">No Cover Image</span>
                         </div>
                      )}
                      <div className="absolute top-3 right-3">
                         <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${subtopic.is_free ? 'bg-emerald-500 text-white shadow-lg' : 'bg-amber-500 text-white shadow-lg'}`}>
                            {subtopic.is_free ? 'Free Preview' : 'Premium'}
                         </span>
                      </div>
                   </div>
                   <div className="p-6 flex flex-col flex-1">
                      <div className="text-[9px] font-black text-primary/60 uppercase tracking-widest mb-1">{subtopic.category || 'General'}</div>
                      <h3 className="font-headline text-xl font-black text-slate-800 leading-tight mb-2">{subtopic.title}</h3>
                      <p className="text-xs font-medium text-slate-500 line-clamp-2 mb-4">{subtopic.description || 'No description provided.'}</p>
                      
                      <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                         <div className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md">{subject?.title || 'No Package'}</div>
                         <Link 
                           href={`/dashboard/topics-management/${subtopic.id}`}
                           className="h-10 px-6 bg-primary text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center hover:bg-slate-800 transition-all shadow-md active:scale-95"
                         >
                           Build Lesson
                         </Link>
                      </div>
                   </div>
                 </div>
               );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
