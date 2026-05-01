"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import MathText from "@/components/MathText";

type SubjectRow = { id: string; title: string };
type TopicRow = { id: string; subject_id: string; title: string };
type SubtopicRow = { id: string; topic_id: string; title: string };

type BankQuestionRow = {
  id: string;
  type: "mcq" | "fill" | "reference_block";
  prompt_text: string | null;
  points: number;
  topic_id: string | null;
  subtopic_id: string | null;
  created_at: string;
  question_bank_options?: any[];
  question_bank_assets?: any[];
};

export default function QuestionsBankPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<BankQuestionRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [subtopics, setSubtopics] = useState<SubtopicRow[]>([]);
  
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [selectedSubtopic, setSelectedSubtopic] = useState("");
  const [selectedType, setSelectedType] = useState("");
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkTargetPackage, setBulkTargetPackage] = useState("");
  const [bulkTargetExam, setBulkTargetExam] = useState("");
  const [exams, setExams] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      // Load subjects
      const subRes = await fetch("/api/admin/packages?limit=500", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const subJson = await subRes.json();
      setSubjects(subJson.items || []);

      // Load questions
      await fetchQuestions();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchQuestions() {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      let url = `/api/admin/question-bank?`;
      if (selectedTopic) url += `topic_id=${selectedTopic}&`;
      if (selectedSubtopic) url += `subtopic_id=${selectedSubtopic}&`;
      if (selectedType) url += `type=${selectedType}&`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      setItems(json.items || []);
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!loading) fetchQuestions();
  }, [selectedTopic, selectedSubtopic, selectedType]);

  // Load topics when subject changes
  useEffect(() => {
    if (!selectedSubject) {
      setTopics([]);
      return;
    }
    const loadTopics = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`/api/admin/topics?subject_id=${selectedSubject}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      setTopics(json.items || []);
      setSelectedTopic("");
      setSelectedSubtopic("");
    };
    loadTopics();
  }, [selectedSubject]);

  // Load exams for bulk target
  useEffect(() => {
    if (!bulkTargetPackage) { setExams([]); return; }
    const loadExams = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await fetch(`/api/admin/exams?package_id=${bulkTargetPackage}`, {
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` }
      });
      const json = await res.json();
      setExams(json.items || []);
    };
    loadExams();
  }, [bulkTargetPackage]);

  async function handleBulkImport() {
    if (!bulkTargetExam || selectedIds.length === 0) return;
    setImporting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await fetch(`/api/admin/exams/${bulkTargetExam}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ action: "import_from_bank", bank_question_ids: selectedIds })
      });
      if (!res.ok) throw new Error("Bulk import failed");
      alert(`Successfully imported ${selectedIds.length} questions!`);
      setSelectedIds([]);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setImporting(false);
    }
  }

  async function deleteQuestion(id: string) {
    if (!confirm("Are you sure you want to delete this question from the bank?")) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`/api/admin/question-bank/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to delete");
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white border border-outline/60 shadow-soft-xl p-8 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="text-secondary font-black text-[10px] uppercase tracking-[0.3em] mb-2">Central Repository</div>
          <h1 className="font-headline text-4xl font-black text-primary tracking-tighter">Questions Bank</h1>
          <p className="text-on-surface-variant font-medium mt-2">Manage and organize questions for reuse across exams.</p>
        </div>
        <Link 
          href="/dashboard/questions/new"
          className="h-14 px-8 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-lg shadow-primary/20 active:scale-95"
        >
          <span className="material-symbols-outlined">add_circle</span>
          Create New Question
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white border border-outline/60 shadow-soft-xl p-6 rounded-2xl grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Package (Subject)</label>
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
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Topic</label>
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
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Subtopic</label>
          <select 
            value={selectedSubtopic} 
            onChange={(e) => setSelectedSubtopic(e.target.value)}
            disabled={!selectedTopic}
            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary transition-all disabled:opacity-50"
          >
            <option value="">All Subtopics</option>
            {subtopics.map(st => <option key={st.id} value={st.id}>{st.title}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Question Type</label>
          <select 
            value={selectedType} 
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-primary transition-all"
          >
            <option value="">All Types</option>
            <option value="mcq">MCQ</option>
            <option value="fill">Fill In Blank</option>
            <option value="reference_block">Reference Block</option>
          </select>
        </div>
      </div>

      {/* List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-20 text-center font-bold text-on-surface-variant animate-pulse">Loading Question Bank...</div>
        ) : items.length === 0 ? (
          <div className="p-20 bg-white border border-dashed border-outline/60 rounded-3xl text-center">
             <span className="material-symbols-outlined text-[64px] text-outline/40 mb-4">database_off</span>
             <p className="font-bold text-on-surface-variant">No questions found in the bank matching your criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {items.map((item) => (
              <div 
                key={item.id} 
                className={`bg-white border shadow-soft-xl rounded-3xl overflow-hidden group transition-all ${
                  selectedIds.includes(item.id) ? 'border-primary ring-2 ring-primary/10' : 'border-outline/40 hover:border-primary/40'
                }`}
              >
                <div className="p-6 flex flex-col md:flex-row gap-6">
                  {/* Selection Checkbox */}
                  <div className="md:pt-1">
                    <button 
                      onClick={() => {
                        if (selectedIds.includes(item.id)) setSelectedIds(prev => prev.filter(id => id !== item.id));
                        else setSelectedIds(prev => [...prev, item.id]);
                      }}
                      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                        selectedIds.includes(item.id) ? 'bg-primary border-primary text-white' : 'border-slate-200 text-transparent hover:border-primary/40'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px] font-black">check</span>
                    </button>
                  </div>
                  
                  {/* Content Preview */}
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        item.type === 'mcq' ? 'bg-blue-100 text-blue-700' : 
                        item.type === 'fill' ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700'
                      }`}>
                        {item.type.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">Points: {item.points}</span>
                      <span className="text-[10px] font-bold text-slate-300 ml-auto">{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                    
                    <div className="text-sm font-medium leading-relaxed text-on-surface line-clamp-3">
                      <MathText text={item.prompt_text || "(No prompt text)"} />
                    </div>

                    {/* Metadata chips */}
                    <div className="flex flex-wrap gap-2">
                       {item.topic_id && (
                          <span className="px-2 py-1 bg-slate-100 text-slate-500 text-[9px] font-bold rounded-lg border border-slate-200">
                             {topics.find(t => t.id === item.topic_id)?.title || "Topic"}
                          </span>
                       )}
                       {item.subtopic_id && (
                          <span className="px-2 py-1 bg-slate-100 text-slate-500 text-[9px] font-bold rounded-lg border border-slate-200">
                             {subtopics.find(st => st.id === item.subtopic_id)?.title || "Subtopic"}
                          </span>
                       )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex md:flex-col gap-2 justify-end">
                    <Link 
                      href={`/dashboard/questions/${item.id}`}
                      className="h-10 px-6 bg-slate-50 text-primary border border-slate-200 rounded-xl font-bold text-xs flex items-center justify-center hover:bg-primary hover:text-white transition-all"
                    >
                      Edit
                    </Link>
                    <button 
                      onClick={() => deleteQuestion(item.id)}
                      className="w-10 h-10 flex items-center justify-center bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all"
                    >
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-10 duration-500">
           <div className="bg-slate-900 text-white p-6 rounded-[32px] shadow-2xl flex flex-col md:flex-row items-center gap-6 border border-white/10 backdrop-blur-xl">
              <div className="flex items-center gap-4 border-r border-white/10 pr-6 mr-2">
                 <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center font-black text-xs">{selectedIds.length}</div>
                 <div className="text-[10px] font-black uppercase tracking-widest opacity-60">Items Selected</div>
              </div>

              <div className="flex flex-wrap gap-4">
                 <select 
                   value={bulkTargetPackage} 
                   onChange={(e) => setBulkTargetPackage(e.target.value)}
                   className="h-12 px-5 bg-white/10 border border-white/20 rounded-2xl text-xs font-bold outline-none focus:border-primary transition-all text-white"
                 >
                    <option value="" className="text-slate-900">Target Package</option>
                    {subjects.map(s => <option key={s.id} value={s.id} className="text-slate-900">{s.title}</option>)}
                 </select>
                 
                 <select 
                   value={bulkTargetExam} 
                   onChange={(e) => setBulkTargetExam(e.target.value)}
                   disabled={!bulkTargetPackage}
                   className="h-12 px-5 bg-white/10 border border-white/20 rounded-2xl text-xs font-bold outline-none focus:border-primary transition-all text-white disabled:opacity-40"
                 >
                    <option value="" className="text-slate-900">Target Exam</option>
                    {exams.map(e => <option key={e.id} value={e.id} className="text-slate-900">{e.title}</option>)}
                 </select>
              </div>

              <div className="flex items-center gap-3">
                 <button onClick={() => setSelectedIds([])} className="h-12 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all opacity-60">Cancel</button>
                 <button 
                   onClick={handleBulkImport}
                   disabled={!bulkTargetExam || importing}
                   className="h-12 px-8 bg-primary text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                 >
                    {importing ? "Importing..." : `Import to Exam`}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
