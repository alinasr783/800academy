"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import LoadingAnimation from "@/components/LoadingAnimation";

type Subject = {
  id: string;
  slug: string;
  title: string;
  track: string | null;
  marketing_title: string | null;
  description: string | null;
};

type Exam = {
  id: string;
  subject_id: string;
  title: string;
  exam_number: number;
};

export default function SimulationClient() {
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [examsBySubject, setExamsBySubject] = useState<Map<string, Exam[]>>(new Map());
  const [subscribedSubjectIds, setSubscribedSubjectIds] = useState<Set<string>>(new Set());
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const { data: sess } = await supabase.auth.getSession();
        const currentUser = sess.session?.user ?? null;
        setUser(currentUser);

        const { data: subjectRows } = await supabase
          .from("subjects")
          .select("*")
          .order("title");

        const { data: examRows } = await supabase
          .from("exams")
          .select("id, subject_id, title, exam_number")
          .order("exam_number");

        if (currentUser) {
          const nowIso = new Date().toISOString();
          const { data: entRows } = await supabase
            .from("entitlements")
            .select("subject_id")
            .eq("user_id", currentUser.id)
            .gte("access_expires_at", nowIso);

          const subscribedIds = new Set((entRows ?? []).map((e) => e.subject_id));
          setSubscribedSubjectIds(subscribedIds);
        }

        setSubjects(subjectRows ?? []);
        
        const eMap = new Map<string, Exam[]>();
        (examRows ?? []).forEach((e) => {
          const list = eMap.get(e.subject_id) ?? [];
          list.push(e);
          eMap.set(e.subject_id, list);
        });
        setExamsBySubject(eMap);
      } catch (err) {
        console.error("Failed to load simulation data:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <LoadingAnimation />
        <p className="text-on-surface-variant font-medium mt-4">Loading simulation portal...</p>
      </div>
    );
  }

  return (
    <section className="max-w-[1440px] mx-auto px-6 sm:px-8 lg:px-12 py-12 sm:py-20">
      <div className="mb-12">
        <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
          Simulation Portal
        </div>
        <h1 className="font-headline text-3xl sm:text-4xl lg:text-5xl font-extrabold text-primary tracking-tighter">
          EST Simulation Exams
        </h1>
        <p className="text-on-surface-variant font-medium mt-4 max-w-2xl leading-relaxed">
          Access full-length simulations for your subscribed subjects. Experience the real exam interface and get instant results.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {subjects.map((subject) => {
          const isSubscribed = subscribedSubjectIds.has(subject.id);
          const subjectExams = examsBySubject.get(subject.id) ?? [];

          return (
            <div
              key={subject.id}
              className={`bg-white border-2 rounded-3xl overflow-hidden transition-all duration-300 flex flex-col ${
                isSubscribed 
                  ? "border-slate-200 hover:border-primary hover:shadow-soft-2xl" 
                  : "border-slate-100 opacity-80"
              }`}
            >
              <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] uppercase tracking-[0.2em] font-black text-on-surface-variant bg-white px-3 py-1 rounded-full border border-slate-200">
                    {subject.track ?? "EST"}
                  </span>
                  {isSubscribed ? (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <span className="material-symbols-outlined text-[18px]">check_circle</span>
                      <span className="text-[10px] font-black tracking-widest uppercase">Subscribed</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-on-surface-variant/60">
                      <span className="material-symbols-outlined text-[18px]">lock</span>
                      <span className="text-[10px] font-black tracking-widest uppercase">Locked</span>
                    </span>
                  )}
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-primary tracking-tight">
                  {subject.title}
                </h3>
                <p className="text-xs text-on-surface-variant mt-2 font-medium line-clamp-2">
                  {subject.description || "Comprehensive practice for the real EST exam."}
                </p>
              </div>

              <div className="p-6 flex flex-col gap-4 flex-1">
                <div className="text-xs font-bold text-on-surface-variant mb-2">
                  {subjectExams.length} Exams Available
                </div>
                
                {isSubscribed ? (
                  <div className="space-y-2">
                    {subjectExams.slice(0, 3).map((exam) => (
                      <Link
                        key={exam.id}
                        href={`/subjects/${subject.slug}/exams/${exam.exam_number}`}
                        className="flex items-center justify-between p-3 rounded-xl border border-outline/40 hover:border-primary hover:bg-primary/5 transition-all group"
                      >
                        <span className="text-sm font-bold text-primary">Exam {exam.exam_number}</span>
                        <span className="material-symbols-outlined text-sm text-on-surface-variant group-hover:text-primary transition-all">arrow_forward</span>
                      </Link>
                    ))}
                    {subjectExams.length > 3 && (
                      <Link
                        href={`/subjects/${subject.slug}#exams-library`}
                        className="block text-center text-[11px] font-bold text-secondary hover:text-primary transition-all mt-2"
                      >
                        View all {subjectExams.length} exams
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 px-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                    <p className="text-xs text-on-surface-variant font-medium mb-4">
                      Unlock this subject to access simulation exams.
                    </p>
                    <Link
                      href={`/subjects/${subject.slug}`}
                      className="px-6 py-2 bg-primary text-white text-xs font-bold rounded-full hover:bg-slate-800 transition-all"
                    >
                      View Plans
                    </Link>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
