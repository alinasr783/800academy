"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type SubjectRow = { id: string; slug: string; title: string; track: string | null; created_at: string };
type ExamRow = {
  id: string;
  subject_id: string;
  exam_number: number;
  title: string;
  is_free: boolean;
  duration_seconds: number;
  pass_percent: number;
  max_attempts: number | null;
  min_score: number;
  total_points: number;
  created_at: string;
};

export default function DashboardExams() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [subjectId, setSubjectId] = useState<string>("");
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [newNumber, setNewNumber] = useState("");
  const [newTitle, setNewTitle] = useState("");

  async function getToken() {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("Not authenticated.");
    return token;
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();

      const subjectsRes = await fetch(`/api/admin/packages?limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const subjectsJson = (await subjectsRes.json().catch(() => ({}))) as {
        items?: SubjectRow[];
        error?: string;
      };
      if (!subjectsRes.ok) throw new Error(subjectsJson.error ?? "Failed to load packages.");
      const list = (subjectsJson.items ?? []).slice().sort((a, b) => a.title.localeCompare(b.title));
      setSubjects(list);
      const chosen = subjectId || list[0]?.id || "";
      setSubjectId(chosen);

      if (chosen) {
        const examsRes = await fetch(`/api/admin/exams?subject_id=${encodeURIComponent(chosen)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const examsJson = (await examsRes.json().catch(() => ({}))) as { items?: ExamRow[]; error?: string };
        if (!examsRes.ok) throw new Error(examsJson.error ?? "Failed to load exams.");
        setExams(examsJson.items ?? []);
      } else {
        setExams([]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function loadExams(nextSubjectId: string) {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const examsRes = await fetch(`/api/admin/exams?subject_id=${encodeURIComponent(nextSubjectId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const examsJson = (await examsRes.json().catch(() => ({}))) as { items?: ExamRow[]; error?: string };
      if (!examsRes.ok) throw new Error(examsJson.error ?? "Failed to load exams.");
      setExams(examsJson.items ?? []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function createExam() {
    const num = Math.trunc(Number(newNumber));
    if (!Number.isFinite(num) || num < 1) {
      setError("Invalid exam number.");
      return;
    }
    if (!newTitle.trim()) {
      setError("Title is required.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/exams`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ subject_id: subjectId, exam_number: num, title: newTitle.trim() }),
      });
      const json = (await res.json().catch(() => ({}))) as { exam?: ExamRow; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Request failed.");
      setNewNumber("");
      setNewTitle("");
      await loadExams(subjectId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const subject = useMemo(() => subjects.find((s) => s.id === subjectId) ?? null, [subjects, subjectId]);

  return (
    <div className="bg-white border border-outline/60 shadow-soft-xl overflow-hidden">
      <div className="p-8 border-b border-outline/40">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
          <div>
            <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
              Exams
            </div>
            <h1 className="font-headline text-4xl font-extrabold text-primary tracking-tighter">
              Exams Management
            </h1>
            <p className="text-on-surface-variant font-medium mt-3">
              {subject ? `${subject.title} • ${exams.length} exams` : "Pick a package"}
            </p>
          </div>
          <div className="flex gap-3">
            <select
              value={subjectId}
              onChange={(e) => {
                const next = e.target.value;
                setSubjectId(next);
                loadExams(next);
              }}
              className="h-12 px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={load}
              className="h-12 px-6 bg-primary text-white font-bold text-sm hover:bg-slate-800 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="p-6 border-b border-outline/40 bg-rose-50 text-rose-700">{error}</div>
      ) : null}

      <div className="p-8 border-b border-outline/40 bg-surface-variant">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-2">
            <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">
              Exam #
            </div>
            <input
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              placeholder="21"
              className="h-12 w-full px-4 bg-white border border-outline/60 focus:border-primary outline-none transition-colors"
            />
          </div>
          <div className="lg:col-span-8">
            <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">
              Title
            </div>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Mock Exam 21"
              className="h-12 w-full px-4 bg-white border border-outline/60 focus:border-primary outline-none transition-colors"
            />
          </div>
          <div className="lg:col-span-2">
            <button
              type="button"
              onClick={createExam}
              disabled={creating || !subjectId}
              className="h-12 w-full bg-secondary text-white font-bold text-sm hover:bg-primary transition-colors disabled:opacity-60"
            >
              Create
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-on-surface-variant font-medium">Loading…</div>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-variant">
              <tr className="text-xs uppercase tracking-widest text-on-surface-variant font-bold">
                <th className="px-6 py-4">Exam</th>
                <th className="px-6 py-4">Access</th>
                <th className="px-6 py-4">Duration</th>
                <th className="px-6 py-4">Pass</th>
                <th className="px-6 py-4" />
              </tr>
            </thead>
            <tbody>
              {exams.map((e) => (
                <tr key={e.id} className="border-t border-outline/40">
                  <td className="px-6 py-5">
                    <div className="text-sm font-extrabold text-primary">
                      #{e.exam_number} • {e.title}
                    </div>
                    <div className="text-xs text-on-surface-variant font-medium mt-1">
                      Min score: {e.min_score} • Total points: {e.total_points}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    {e.is_free ? (
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black tracking-[0.2em] uppercase">
                        Free
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-slate-100 text-slate-800 text-[10px] font-black tracking-[0.2em] uppercase">
                        Paid
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-5 text-sm text-on-surface-variant font-medium">
                    {Math.round(e.duration_seconds / 60)} min
                  </td>
                  <td className="px-6 py-5 text-sm text-on-surface-variant font-medium">
                    {e.pass_percent}%
                  </td>
                  <td className="px-6 py-5 text-right">
                    <Link
                      href={`/dashboard/exams/${e.id}`}
                      className="text-sm font-bold text-primary hover:text-secondary transition-colors"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
