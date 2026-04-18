"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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

type SubjectRow = {
  id: string;
  title: string;
};

export default function DashboardTopics() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newSubjectId, setNewSubjectId] = useState("");

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

      const res = await fetch(`/api/admin/topics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json().catch(() => ({}))) as { items?: TopicRow[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load topics.");

      const sRes = await fetch(`/api/admin/packages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const sJson = (await sRes.json().catch(() => ({}))) as { items?: SubjectRow[] };
      setSubjects(sJson.items ?? []);
      
      const enrichedTopics = await Promise.all((json.items ?? []).map(async (t) => {
          if (!t.subject_id) return t;
          const s = (sJson.items ?? []).find(it => it.id === t.subject_id);
          return { ...t, subjects: s ? { title: s.title } : null };
      }));

      setTopics(enrichedTopics);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function createTopic() {
    if (!newTitle.trim()) {
      setError("Title is required.");
      return;
    }
    if (!newSubjectId) {
      setError("Please select a subject for this topic.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Not authenticated.");

      const res = await fetch(`/api/admin/topics`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ 
          title: newTitle.trim(), 
          description: newDescription.trim(),
          subject_id: newSubjectId
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { topic?: TopicRow; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Request failed.");
      
      setNewTitle("");
      setNewDescription("");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setCreating(false);
    }
  }

  async function deleteTopic(id: string) {
    if (!confirm("Are you sure you want to delete this topic? Questions linked to it will be unlinked.")) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Not authenticated.");

      const res = await fetch(`/api/admin/topics?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Delete failed.");
      }
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      alert(msg);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="bg-white border border-outline/60 shadow-soft-xl overflow-hidden rounded-2xl">
      <div className="p-8 border-b border-outline/40">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
          <div>
            <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
              Management
            </div>
            <h1 className="font-headline text-4xl font-extrabold text-primary tracking-tighter">
              Topics Management
            </h1>
            <p className="text-on-surface-variant font-medium mt-3">
              Manage question subjects and categories
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="h-12 px-6 bg-primary text-white font-bold text-sm rounded-xl hover:bg-slate-800 transition-all active:scale-95"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-6 border-b border-outline/40 bg-rose-50 text-rose-700 animate-fade-in flex items-center gap-3">
          <span className="material-symbols-outlined text-rose-500">error</span>
          <span className="text-sm font-bold">{error}</span>
        </div>
      ) : null}

      <div className="p-8 border-b border-outline/40 bg-slate-50/50">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
          <div className="lg:col-span-4">
            <div className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2 ml-1">
              Topic Title
            </div>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Algebra Basics"
              className="h-12 w-full px-4 bg-white border border-outline/60 focus:border-primary outline-none transition-all rounded-xl font-bold"
            />
          </div>
          <div className="lg:col-span-3">
            <div className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2 ml-1">
              Subject Package
            </div>
            <select
              value={newSubjectId}
              onChange={(e) => setNewSubjectId(e.target.value)}
              className="h-12 w-full px-4 bg-white border border-outline/60 focus:border-primary outline-none transition-all rounded-xl font-bold cursor-pointer"
            >
              <option value="">Select a subject...</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-3">
            <div className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2 ml-1">
              Description (Optional)
            </div>
            <input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Linear equations, etc."
              className="h-12 w-full px-4 bg-white border border-outline/60 focus:border-primary outline-none transition-all rounded-xl font-medium"
            />
          </div>
          <div className="lg:col-span-2">
            <button
              type="button"
              onClick={createTopic}
              disabled={creating}
              className="h-12 w-full bg-secondary text-white font-bold text-sm rounded-xl hover:bg-primary transition-all shadow-md shadow-secondary/20 active:scale-95 disabled:opacity-50"
            >
              {creating ? "Adding..." : "Add Topic"}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-20 flex flex-col items-center justify-center gap-4">
          <div className="w-10 h-10 border-4 border-slate-100 border-t-primary rounded-full animate-spin" />
          <div className="text-slate-400 font-bold text-xs uppercase tracking-widest animate-pulse">Loading Topics...</div>
        </div>
      ) : (
        <div className="overflow-auto pb-10">
          <table className="w-full text-left">
            <thead className="bg-slate-50">
              <tr className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant font-black">
                <th className="px-8 py-5">Topic</th>
                <th className="px-8 py-5">Subject</th>
                <th className="px-8 py-5">Description</th>
                <th className="px-8 py-5">Created At</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {topics.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center text-slate-400 font-medium italic">
                    No topics found. Add one above!
                  </td>
                </tr>
              ) : (
                topics.map((t) => (
                  <tr key={t.id} className="border-t border-outline/40 hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-5">
                      <div className="text-sm font-black text-primary">
                        {t.title}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm text-primary font-bold">
                      {t.subjects?.title || "—"}
                    </td>
                    <td className="px-8 py-5 text-sm text-on-surface-variant font-medium">
                      {t.description || "—"}
                    </td>
                    <td className="px-8 py-5 text-xs text-on-surface-variant font-medium">
                      {new Date(t.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button
                        onClick={() => deleteTopic(t.id)}
                        className="text-xs font-black text-rose-500 hover:text-rose-700 transition-colors uppercase tracking-widest flex items-center justify-end gap-1 ml-auto group"
                      >
                        <span className="material-symbols-outlined text-[18px] group-hover:scale-110 transition-transform">delete</span>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
