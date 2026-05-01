"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import MathText from "@/components/MathText";

export default function QuestionBankPicker({ isOpen, onClose, onImport }: { isOpen: boolean, onClose: () => void, onImport: (ids: string[]) => void }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [subjects, setSubjects] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [subtopics, setSubtopics] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [selectedSubtopic, setSelectedSubtopic] = useState("");

  async function loadFilters() {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    
    const subRes = await fetch("/api/admin/packages?limit=200", { headers: { Authorization: `Bearer ${token}` } });
    const subJson = await subRes.json();
    setSubjects(subJson.items || []);
  }

  async function fetchQuestions() {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      let url = `/api/admin/question-bank?`;
      if (selectedTopic) url += `topic_id=${selectedTopic}&`;
      if (selectedSubtopic) url += `subtopic_id=${selectedSubtopic}&`;
      
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      setItems(json.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (isOpen) loadFilters(); }, [isOpen]);
  useEffect(() => { if (isOpen) fetchQuestions(); }, [isOpen, selectedTopic, selectedSubtopic]);

  useEffect(() => {
    if (!selectedSubject) { setTopics([]); return; }
    supabase.auth.getSession().then(({ data }) => {
      fetch(`/api/admin/topics?subject_id=${selectedSubject}`, { headers: { Authorization: `Bearer ${data.session?.access_token}` } })
        .then(res => res.json())
        .then(json => {
          setTopics(json.items || []);
          setSelectedTopic("");
          setSubtopics([]);
          setSelectedSubtopic("");
        });
    });
  }, [selectedSubject]);

  useEffect(() => {
    if (!selectedTopic) { setSubtopics([]); return; }
    supabase.auth.getSession().then(({ data }) => {
      fetch(`/api/admin/subtopics?topic_id=${selectedTopic}`, { headers: { Authorization: `Bearer ${data.session?.access_token}` } })
        .then(res => res.json())
        .then(json => {
          setSubtopics(json.items || []);
          setSelectedSubtopic("");
        });
    });
  }, [selectedTopic]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="p-8 border-b border-outline/30 flex items-center justify-between bg-slate-50">
           <div>
              <h2 className="text-2xl font-black text-primary tracking-tighter">Question Bank</h2>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Select questions to import into this exam</p>
           </div>
           <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-200 transition-all">
              <span className="material-symbols-outlined">close</span>
           </button>
        </div>

        {/* Filters */}
        <div className="p-6 border-b border-outline/20 flex flex-wrap gap-4 bg-white">
           <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none">
              <option value="">Select Package</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
           </select>
           <select value={selectedTopic} onChange={e => setSelectedTopic(e.target.value)} disabled={!selectedSubject} className="h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none disabled:opacity-50">
              <option value="">Select Topic</option>
              {topics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
           </select>
           <select value={selectedSubtopic} onChange={e => setSelectedSubtopic(e.target.value)} disabled={!selectedTopic} className="h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none disabled:opacity-50">
              <option value="">Select Subtopic</option>
              {subtopics.map(st => <option key={st.id} value={st.id}>{st.title}</option>)}
           </select>
           <div className="ml-auto text-xs font-black text-primary bg-primary/5 px-4 py-3 rounded-xl border border-primary/10">
              Selected: {selectedIds.length}
           </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
           {loading ? (
              <div className="p-20 text-center font-bold text-primary animate-pulse">Scanning repository...</div>
           ) : items.length === 0 ? (
              <div className="p-20 text-center text-slate-400 font-bold">No questions found.</div>
           ) : (
              items.map(q => (
                 <div 
                   key={q.id} 
                   onClick={() => {
                      if (selectedIds.includes(q.id)) setSelectedIds(prev => prev.filter(id => id !== q.id));
                      else setSelectedIds(prev => [...prev, q.id]);
                   }}
                   className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex gap-4 ${selectedIds.includes(q.id) ? 'border-primary bg-primary/5' : 'border-outline/20 hover:border-slate-300 bg-white'}`}
                 >
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedIds.includes(q.id) ? 'bg-primary border-primary text-white' : 'border-slate-200 text-transparent'}`}>
                       <span className="material-symbols-outlined text-[16px] font-black">check</span>
                    </div>
                    <div className="flex-1 space-y-2">
                       <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{q.type}</span>
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">• Points: {q.points}</span>
                       </div>
                       <div className="text-sm font-medium leading-relaxed line-clamp-2">
                          <MathText text={q.prompt_text || ""} />
                       </div>
                    </div>
                 </div>
              ))
           )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-outline/30 bg-slate-50 flex justify-end gap-3">
           <button onClick={onClose} className="px-8 h-12 rounded-xl font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-200 transition-all">Cancel</button>
           <button 
             disabled={selectedIds.length === 0}
             onClick={() => onImport(selectedIds)} 
             className="px-10 h-12 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
           >
              Import {selectedIds.length} Questions
           </button>
        </div>
      </div>
    </div>
  );
}
