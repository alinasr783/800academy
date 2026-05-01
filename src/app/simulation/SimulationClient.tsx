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
  is_free: boolean;
};

export default function SimulationClient() {
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [subscribedSubjectIds, setSubscribedSubjectIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const { data: sess } = await supabase.auth.getSession();
        const currentUser = sess.session?.user ?? null;

        const { data: subjectRows } = await supabase
          .from("subjects")
          .select("*")
          .order("title");

        const { data: examRows } = await supabase
          .from("exams")
          .select("id, subject_id, title, exam_number, is_free")
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
        setExams(examRows ?? []);
        
        if (subjectRows && subjectRows.length > 0) {
          setSelectedSubjectId(subjectRows[0].id);
        }
      } catch (err) {
        console.error("Failed to load simulation data:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const currentSubject = subjects.find(s => s.id === selectedSubjectId);
  const filteredExams = exams.filter(e => e.subject_id === selectedSubjectId);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <LoadingAnimation />
        <p className="text-on-surface-variant font-medium mt-4">Opening simulation portal...</p>
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
          Experience full-length simulations in the official EST environment. Real scoring, real timers, real results.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left Sidebar: Package Selection */}
        <div className="lg:col-span-4 space-y-6 sticky top-24">
          <div className="bg-white rounded-3xl border border-outline/40 p-6 shadow-soft-xl">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-secondary mb-4 px-2">Select Package</h3>
            <div className="space-y-2">
              {subjects.map(subject => {
                const isSubscribed = subscribedSubjectIds.has(subject.id);
                return (
                  <button
                    key={subject.id}
                    onClick={() => setSelectedSubjectId(subject.id)}
                    className={`w-full text-left px-4 py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-between ${
                      selectedSubjectId === subject.id 
                        ? "bg-primary text-white shadow-lg" 
                        : "text-on-surface hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span>{subject.title}</span>
                    </div>
                    {!isSubscribed && (
                      <span className="material-symbols-outlined text-[16px] opacity-50">lock</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          
          {currentSubject && (
            <div className="p-6 bg-slate-100 rounded-3xl border border-slate-200">
               <div className="text-[10px] font-black uppercase text-slate-400 mb-2">Subject Info</div>
               <p className="text-xs font-bold text-primary leading-relaxed">
                  {currentSubject.description || "Start practicing with real EST simulation exams today."}
               </p>
            </div>
          )}
        </div>

        {/* Right Content: Exams List */}
        <div className="lg:col-span-8">
          {selectedSubjectId ? (
            <div className="space-y-8">
              <div className="flex items-center justify-between px-2">
                <div>
                  <h2 className="text-2xl font-black text-primary tracking-tight">
                    {currentSubject?.title} Exams
                  </h2>
                  <p className="text-sm text-on-surface-variant font-medium mt-1">
                    {filteredExams.length} Full-length simulations
                  </p>
                </div>
                {!subscribedSubjectIds.has(selectedSubjectId) && (
                   <Link href={`/subjects/${currentSubject?.slug}`} className="px-5 py-2 bg-secondary text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-primary transition-all">
                      Unlock Full Access
                   </Link>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredExams.map((exam) => {
                  const isSubscribed = subscribedSubjectIds.has(selectedSubjectId);
                  const canAccess = isSubscribed || exam.is_free;

                  return (
                    <div
                      key={exam.id}
                      className="group bg-white rounded-3xl border-2 border-slate-200 p-8 flex flex-col transition-all duration-300 hover:shadow-soft-2xl hover:border-primary/30"
                    >
                      <div className="flex items-start justify-between gap-4 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-primary font-black text-lg border border-slate-100">
                          {exam.exam_number}
                        </div>
                        <div className={`px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase ${exam.is_free ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                          {exam.is_free ? 'Free Sample' : 'Premium'}
                        </div>
                      </div>
                      
                      <h3 className="text-xl font-extrabold text-primary mb-2">
                        {exam.title}
                      </h3>
                      <p className="text-xs text-on-surface-variant font-medium mb-8 leading-relaxed">
                        Official EST simulation format. {canAccess ? 'Access is available for your account.' : 'Please subscribe to unlock this simulation.'}
                      </p>

                      <div className="mt-auto pt-6 border-t border-slate-100">
                        {canAccess ? (
                          <Link
                            href={`/subjects/${currentSubject?.slug}/exams/${exam.exam_number}`}
                            className="w-full bg-primary text-white py-4 font-black text-[11px] uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-primary/20 active:scale-[0.98]"
                          >
                            Open Simulation
                            <span className="material-symbols-outlined text-lg">arrow_forward</span>
                          </Link>
                        ) : (
                          <div className="flex flex-col gap-3">
                             <div className="flex items-center gap-2 text-rose-500 font-bold text-[10px] uppercase tracking-widest justify-center">
                              <span className="material-symbols-outlined text-sm">lock</span>
                              Locked Simulation
                            </div>
                            <Link
                              href={`/subjects/${currentSubject?.slug}`}
                              className="w-full py-4 bg-slate-100 text-on-surface-variant font-black text-[11px] uppercase tracking-widest hover:bg-slate-200 transition-all rounded-2xl text-center"
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

              {filteredExams.length === 0 && (
                <div className="p-20 bg-white rounded-3xl border-2 border-dashed border-slate-200 text-center">
                  <span className="material-symbols-outlined text-5xl text-slate-300 mb-4">assignment_late</span>
                  <p className="font-bold text-on-surface-variant">Coming soon: New simulations are being prepared.</p>
                </div>
              )}
            </div>
          ) : (
             <div className="p-20 bg-white rounded-3xl border border-outline/40 shadow-soft-xl text-center">
                <span className="material-symbols-outlined text-6xl text-primary/20 mb-6">rocket_launch</span>
                <h2 className="text-2xl font-black text-primary tracking-tight mb-2">Simulation Portal</h2>
                <p className="text-on-surface-variant font-medium">Select a package from the sidebar to begin your mock exam.</p>
             </div>
          )}
        </div>
      </div>
    </section>
  );
}
