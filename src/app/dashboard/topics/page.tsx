"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import LoadingAnimation from "@/components/LoadingAnimation";

type TopicRow = {
  id: string;
  title: string;
  description: string | null;
  subject_id: string | null;
  created_at: string;
  subjects?: {
    title: string;
  } | null;
};

type SubtopicRow = {
  id: string;
  topic_id: string;
  subject_id: string;
  title: string;
  description: string | null;
  created_at: string;
};

type SubjectRow = {
  id: string;
  title: string;
};

export default function DashboardTopics() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [subtopics, setSubtopics] = useState<SubtopicRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null);

  // Topic creation/editing
  const [editingTopic, setEditingTopic] = useState<TopicRow | null>(null);
  const [topicModalOpen, setTopicModalOpen] = useState(false);
  const [topicForm, setTopicForm] = useState({ title: "", description: "", subjectId: "" });
  const [submittingTopic, setSubmittingTopic] = useState(false);

  // Subtopic creation/editing
  const [editingSubtopic, setEditingSubtopic] = useState<SubtopicRow | null>(null);
  const [subtopicModalOpen, setSubtopicModalOpen] = useState(false);
  const [subtopicForm, setSubtopicForm] = useState({ title: "", description: "", topicId: "", subjectId: "" });
  const [submittingSubtopic, setSubmittingSubtopic] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        router.push("/join?mode=login");
        return;
      }

      // Load Subjects
      const sRes = await fetch(`/api/admin/packages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const sJson = (await sRes.json().catch(() => ({}))) as { items?: SubjectRow[] };
      setSubjects(sJson.items ?? []);

      // Load Topics
      const tRes = await fetch(`/api/admin/topics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const tJson = (await tRes.json().catch(() => ({}))) as { items?: TopicRow[]; error?: string };
      if (!tRes.ok) throw new Error(tJson.error ?? "Failed to load topics.");

      const enrichedTopics = (tJson.items ?? []).map((t) => {
        if (!t.subject_id) return t;
        const s = (sJson.items ?? []).find((it) => it.id === t.subject_id);
        return { ...t, subjects: s ? { title: s.title } : null };
      });
      setTopics(enrichedTopics);

      // Load All Subtopics
      const stRes = await fetch(`/api/admin/subtopics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const stJson = (await stRes.json().catch(() => ({}))) as { items?: SubtopicRow[] };
      setSubtopics(stJson.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function saveTopic() {
    if (!topicForm.title.trim() || !topicForm.subjectId) {
      alert("Title and Subject are required.");
      return;
    }
    setSubmittingTopic(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const method = editingTopic ? "PATCH" : "POST";
      const url = editingTopic ? `/api/admin/topics?id=${editingTopic.id}` : `/api/admin/topics`;

      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: topicForm.title.trim(),
          description: topicForm.description.trim() || null,
          subject_id: topicForm.subjectId,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Save failed.");
      }
      setTopicModalOpen(false);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error saving topic.");
    } finally {
      setSubmittingTopic(false);
    }
  }

  async function deleteTopic(id: string) {
    if (!confirm("Are you sure? This will delete all subtopics and questions under this topic.")) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`/api/admin/topics?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Delete failed.");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error deleting topic.");
    }
  }

  async function saveSubtopic() {
    if (!subtopicForm.title.trim() || !subtopicForm.topicId || !subtopicForm.subjectId) {
      alert("Title, Topic, and Subject are required.");
      return;
    }
    setSubmittingSubtopic(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const method = editingSubtopic ? "PATCH" : "POST";
      const url = editingSubtopic ? `/api/admin/subtopics?id=${editingSubtopic.id}` : `/api/admin/subtopics`;

      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: subtopicForm.title.trim(),
          description: subtopicForm.description.trim() || null,
          topic_id: subtopicForm.topicId,
          subject_id: subtopicForm.subjectId,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Save failed.");
      }
      setSubtopicModalOpen(false);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error saving subtopic.");
    } finally {
      setSubmittingSubtopic(false);
    }
  }

  async function deleteSubtopic(id: string) {
    if (!confirm("Are you sure you want to delete this subtopic? Questions will be unlinked.")) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`/api/admin/subtopics?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Delete failed.");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error deleting subtopic.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const openTopicModal = (topic?: TopicRow) => {
    if (topic) {
      setEditingTopic(topic);
      setTopicForm({ title: topic.title, description: topic.description ?? "", subjectId: topic.subject_id ?? "" });
    } else {
      setEditingTopic(null);
      setTopicForm({ title: "", description: "", subjectId: "" });
    }
    setTopicModalOpen(true);
  };

  const openSubtopicModal = (topicId: string, subjectId: string, subtopic?: SubtopicRow) => {
    if (subtopic) {
        setEditingSubtopic(subtopic);
        setSubtopicForm({ title: subtopic.title, description: subtopic.description ?? "", topicId, subjectId });
    } else {
        setEditingSubtopic(null);
        setSubtopicForm({ title: "", description: "", topicId, subjectId });
    }
    setSubtopicModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="bg-white border-b border-outline/40 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-8 py-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div>
                <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
                Management
                </div>
                <h1 className="font-headline text-4xl font-extrabold text-primary tracking-tighter">
                Topics & Subtopics
                </h1>
                <p className="text-on-surface-variant font-medium mt-3">
                Organize your question categories into topics and nested subtopics.
                </p>
            </div>
            <div className="flex items-center gap-4">
                <button
                    onClick={load}
                    className="h-12 px-6 bg-white border border-outline/60 text-primary font-bold text-sm rounded-xl hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                >
                    Refresh
                </button>
                <button
                    onClick={() => openTopicModal()}
                    className="h-12 px-8 bg-primary text-white font-bold text-sm rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-primary/20 active:scale-95 flex items-center gap-2"
                >
                    <span className="material-symbols-outlined text-[20px]">add</span>
                    New Topic
                </button>
            </div>
            </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-10">
        {error && (
            <div className="mb-8 p-6 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl flex items-center gap-4 animate-fade-in shadow-sm">
                <span className="material-symbols-outlined text-rose-500">error</span>
                <span className="text-sm font-bold">{error}</span>
            </div>
        )}

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-6">
            <LoadingAnimation />
            <p className="text-slate-400 font-bold text-sm animate-pulse">Initializing data hierarchy...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {topics.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-20 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                    <span className="material-symbols-outlined text-[32px]">inventory_2</span>
                </div>
                <h3 className="text-xl font-bold text-primary mb-2">No Topics Yet</h3>
                <p className="text-slate-400 font-medium mb-8">Start by creating your first question category topic.</p>
                <button onClick={() => openTopicModal()} className="px-8 py-3 bg-primary text-white font-bold rounded-xl active:scale-95 transition-all">Create Topic</button>
              </div>
            ) : (
              topics.map((t) => {
                const mySubtopics = subtopics.filter(st => st.topic_id === t.id);
                const isExpanded = expandedTopicId === t.id;

                return (
                  <div key={t.id} className={`group bg-white border transition-all duration-300 rounded-3xl overflow-hidden shadow-soft-xl ${isExpanded ? 'border-primary shadow-lg ring-1 ring-primary/10' : 'border-outline/40 hover:border-primary/40'}`}>
                    <div className={`p-6 flex items-center justify-between gap-6 cursor-pointer select-none transition-colors ${isExpanded ? 'bg-primary/5' : 'hover:bg-slate-50/50'}`} onClick={() => setExpandedTopicId(isExpanded ? null : t.id)}>
                        <div className="flex items-center gap-6">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isExpanded ? 'bg-primary text-white scale-110' : 'bg-slate-100 text-slate-400 group-hover:bg-primary/10 group-hover:text-primary'}`}>
                                <span className="material-symbols-outlined text-[24px]">category</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-primary tracking-tight">{t.title}</h3>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-black uppercase tracking-wider">{t.subjects?.title || 'No Subject'}</span>
                                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{mySubtopics.length} Subtopics</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 px-2">
                            <button
                                onClick={(e) => { e.stopPropagation(); openTopicModal(t); }}
                                className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-white rounded-xl transition-all"
                            >
                                <span className="material-symbols-outlined text-[20px]">edit</span>
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); deleteTopic(t.id); }}
                                className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                            >
                                <span className="material-symbols-outlined text-[20px]">delete</span>
                            </button>
                            <div className={`w-10 h-10 flex items-center justify-center text-slate-300 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                <span className="material-symbols-outlined">expand_more</span>
                            </div>
                        </div>
                    </div>

                    {isExpanded && (
                        <div className="border-t border-outline/20 p-8 space-y-6 animate-slide-up">
                            {t.description && (
                                <p className="text-sm font-medium text-on-surface-variant italic bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100">
                                    {t.description}
                                </p>
                            )}
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {mySubtopics.map((st) => (
                                    <div key={st.id} className="relative group/st p-6 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:border-primary hover:shadow-md transition-all">
                                        <div className="flex items-center justify-between gap-4 mb-3">
                                            <h4 className="font-extrabold text-primary text-sm tracking-tight">{st.title}</h4>
                                            <div className="flex items-center opacity-0 group-hover/st:opacity-100 transition-opacity">
                                                <button onClick={() => openSubtopicModal(t.id, t.subject_id!, st)} className="p-1.5 text-slate-400 hover:text-primary"><span className="material-symbols-outlined text-[18px]">edit</span></button>
                                                <button onClick={() => deleteSubtopic(st.id)} className="p-1.5 text-slate-400 hover:text-rose-500"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                                            </div>
                                        </div>
                                        <p className="text-[11px] font-medium text-slate-400 line-clamp-2 leading-relaxed">
                                            {st.description || 'No description provided.'}
                                        </p>
                                    </div>
                                ))}
                                <button
                                    onClick={() => openSubtopicModal(t.id, t.subject_id!)}
                                    className="p-6 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-primary hover:text-primary transition-all group/addst"
                                >
                                    <span className="material-symbols-outlined text-[24px] group-hover/addst:scale-110 transition-transform">add_circle</span>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Add Subtopic</span>
                                </button>
                            </div>
                        </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Topic Modal */}
      {topicModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-primary/20 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-up border border-outline/20">
                <div className="p-10 border-b border-outline/20">
                    <h2 className="text-2xl font-black text-primary tracking-tight">{editingTopic ? 'Edit Topic' : 'Create New Topic'}</h2>
                    <p className="text-sm text-on-surface-variant font-medium mt-1">Define a top-level category for questions.</p>
                </div>
                <div className="p-10 space-y-8">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3 ml-1">Subject Package</label>
                        <select
                            value={topicForm.subjectId}
                            onChange={(e) => setTopicForm({ ...topicForm, subjectId: e.target.value })}
                            className="w-full h-14 px-6 bg-slate-50 border border-slate-200 rounded-2xl focus:border-primary focus:bg-white outline-none font-bold transition-all cursor-pointer"
                        >
                            <option value="">Select a subject...</option>
                            {subjects.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3 ml-1">Topic Title</label>
                        <input
                            value={topicForm.title}
                            onChange={(e) => setTopicForm({ ...topicForm, title: e.target.value })}
                            placeholder="e.g., Algebraic Foundations"
                            className="w-full h-14 px-6 bg-slate-50 border border-slate-200 rounded-2xl focus:border-primary focus:bg-white outline-none font-bold transition-all"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3 ml-1">Description (Optional)</label>
                        <textarea
                            value={topicForm.description}
                            onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })}
                            rows={3}
                            placeholder="Briefly describe what this topic covers..."
                            className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-2xl focus:border-primary focus:bg-white outline-none font-medium transition-all resize-none"
                        />
                    </div>
                </div>
                <div className="p-10 bg-slate-50 flex items-center justify-end gap-4">
                    <button onClick={() => setTopicModalOpen(false)} className="px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-primary transition-colors">Cancel</button>
                    <button
                        onClick={saveTopic}
                        disabled={submittingTopic}
                        className="px-10 py-3 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {submittingTopic ? 'Saving...' : (editingTopic ? 'Update Topic' : 'Create Topic')}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Subtopic Modal */}
        {subtopicModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-secondary/10 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-scale-up border border-outline/20">
                <div className="p-10 border-b border-outline/20">
                    <h2 className="text-2xl font-black text-secondary tracking-tight">{editingSubtopic ? 'Edit Subtopic' : 'New Subtopic'}</h2>
                    <p className="text-sm text-on-surface-variant font-medium mt-1">Questions will be linked directly to this specific sub-category.</p>
                </div>
                <div className="p-10 space-y-8">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3 ml-1">Subtopic Title</label>
                        <input
                            value={subtopicForm.title}
                            onChange={(e) => setSubtopicForm({ ...subtopicForm, title: e.target.value })}
                            placeholder="e.g., Linear Equations in One Variable"
                            className="w-full h-14 px-6 bg-slate-50 border border-slate-200 rounded-2xl focus:border-secondary focus:bg-white outline-none font-bold transition-all"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3 ml-1">Description (Optional)</label>
                        <textarea
                            value={subtopicForm.description}
                            onChange={(e) => setSubtopicForm({ ...subtopicForm, description: e.target.value })}
                            rows={3}
                            placeholder="What specific skills or concepts does this subtopic include?"
                            className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-2xl focus:border-secondary focus:bg-white outline-none font-medium transition-all resize-none"
                        />
                    </div>
                </div>
                <div className="p-10 bg-slate-50 flex items-center justify-end gap-4">
                    <button onClick={() => setSubtopicModalOpen(false)} className="px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-secondary transition-colors">Cancel</button>
                    <button
                        onClick={saveSubtopic}
                        disabled={submittingSubtopic}
                        className="px-10 py-3 bg-secondary text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-secondary/20 hover:bg-primary transition-all active:scale-95 disabled:opacity-50"
                    >
                        {submittingSubtopic ? 'Saving...' : (editingSubtopic ? 'Update Subtopic' : 'Add Subtopic')}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
