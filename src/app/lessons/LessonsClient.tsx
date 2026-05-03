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

type Topic = {
  id: string;
  subject_id: string;
  title: string;
  description: string | null;
};

type Subtopic = {
  id: string;
  topic_id: string;
  subject_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
  is_free: boolean;
};

export default function LessonsClient() {
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [subscribedSubjectIds, setSubscribedSubjectIds] = useState<Set<string>>(new Set());
  const [completedSubtopicIds, setCompletedSubtopicIds] = useState<Set<string>>(new Set());
  const [isGuest, setIsGuest] = useState(true);

  // Fetch completed lessons for the selected subject
  useEffect(() => {
    if (!selectedSubjectId) return;
    async function fetchProgress() {
      try {
        // Always read from localStorage first for instant results
        const stored = JSON.parse(localStorage.getItem("completed_lessons") || "[]");
        setCompletedSubtopicIds(new Set(stored));
        
        // Also try to sync from server for logged-in users (in case they have data from another device)
        const { data: sess } = await supabase.auth.getSession();
        if (sess?.session?.access_token) {
          fetch(`/api/lesson/completions?subject_id=${selectedSubjectId}`, {
            headers: { Authorization: `Bearer ${sess.session.access_token}` }
          }).then(async (res) => {
            if (res.ok) {
              const json = await res.json();
              if (json.completed?.length > 0) {
                // Merge server data with localStorage (server wins for dedup)
                const merged = new Set([...stored, ...json.completed]);
                setCompletedSubtopicIds(merged);
                localStorage.setItem("completed_lessons", JSON.stringify([...merged]));
              }
            }
          }).catch(() => {});
        }
      } catch (e) {
        console.error("Failed to fetch progress:", e);
      }
    }
    fetchProgress();
  }, [selectedSubjectId, subtopics]);

  // Listen for storage changes from other tabs
  useEffect(() => {
    const handler = () => {
      try {
        const stored = JSON.parse(localStorage.getItem("completed_lessons") || "[]");
        setCompletedSubtopicIds(new Set(stored));
      } catch (e) {
        console.error("Parse error:", e);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const { data: sess } = await supabase.auth.getSession();
        const currentUser = sess.session?.user ?? null;

        // Fetch Subjects
        const { data: subjectRows } = await supabase
          .from("subjects")
          .select("*")
          .order("title");

        // Fetch All Topics
        const { data: topicRows } = await supabase
          .from("topics")
          .select("*")
          .order("title");

        // Fetch All Subtopics
        const { data: subtopicRows } = await supabase
          .from("subtopics")
          .select("*")
          .order("sort_order", { ascending: true })
          .order("title");

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
        setTopics(topicRows ?? []);
        setSubtopics(subtopicRows ?? []);
        
        // Detect if user is guest
        setIsGuest(!currentUser);
        
        // Restore from localStorage
        const savedSubjectId = localStorage.getItem("lessons_selected_subject");
        const savedTopicId = localStorage.getItem("lessons_selected_topic");

        if (savedSubjectId && subjectRows?.some(s => s.id === savedSubjectId)) {
          setSelectedSubjectId(savedSubjectId);
          if (savedTopicId && topicRows?.some(t => t.id === savedTopicId && t.subject_id === savedSubjectId)) {
             setSelectedTopicId(savedTopicId);
          }
        } else if (subjectRows && subjectRows.length > 0) {
          setSelectedSubjectId(subjectRows[0].id);
        }

      } catch (err) {
        console.error("Failed to load lessons data:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Save selection changes
  useEffect(() => {
    if (selectedSubjectId) localStorage.setItem("lessons_selected_subject", selectedSubjectId);
  }, [selectedSubjectId]);

  useEffect(() => {
    if (selectedTopicId) localStorage.setItem("lessons_selected_topic", selectedTopicId);
  }, [selectedTopicId]);

  const currentSubject = subjects.find(s => s.id === selectedSubjectId);
  const filteredTopics = topics.filter(t => t.subject_id === selectedSubjectId);
  const currentTopic = topics.find(t => t.id === selectedTopicId);
  
  // Logic to update topic if current selection is invalid for new subject
  useEffect(() => {
    if (selectedSubjectId && selectedTopicId) {
       const isValid = topics.some(t => t.id === selectedTopicId && t.subject_id === selectedSubjectId);
       if (!isValid && filteredTopics.length > 0) {
          setSelectedTopicId(filteredTopics[0].id);
       }
    }
  }, [selectedSubjectId]);

  const filteredSubtopics = subtopics.filter(st => st.topic_id === selectedTopicId);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <LoadingAnimation />
        <p className="text-on-surface-variant font-medium mt-4">Loading curriculum...</p>
      </div>
    );
  }

  return (
    <section className="max-w-[1440px] mx-auto px-6 sm:px-8 lg:px-12 py-12 sm:py-20">
      <div className="mb-12">
        <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
          Learning Portal
        </div>
        <h1 className="font-headline text-3xl sm:text-4xl lg:text-5xl font-extrabold text-primary tracking-tighter">
          Interactive Lessons
        </h1>
        <p className="text-on-surface-variant font-medium mt-4 max-w-2xl leading-relaxed">
          Master the EST curriculum with step-by-step explanations, visual examples, and practice questions.
        </p>
      </div>

      {/* Progress Bar */}
      {selectedSubjectId && (
        <div className="mb-10 bg-white rounded-3xl border border-outline/40 p-6 shadow-soft-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black text-slate-800">Your Progress</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                {currentSubject?.title || 'Subject'}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xl font-black text-primary">
                {subtopics.filter(st => st.subject_id === selectedSubjectId && completedSubtopicIds.has(st.id)).length}
              </span>
              <span className="text-xs font-bold text-slate-400"> / {subtopics.filter(st => st.subject_id === selectedSubjectId).length} lessons</span>
            </div>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            {(() => {
              const total = subtopics.filter(st => st.subject_id === selectedSubjectId).length;
              const done = subtopics.filter(st => st.subject_id === selectedSubjectId && completedSubtopicIds.has(st.id)).length;
              const pct = total > 0 ? (done / total) * 100 : 0;
              return (
                <div 
                  className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${pct}%` }}
                />
              );
            })()}
            </div>
          </div>
      )}

      {/* CTA for guest users */}
      {isGuest && (
        <div className="mb-10 bg-amber-50 border-2 border-amber-200 rounded-3xl p-6 shadow-soft-xl text-center">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-2xl">cloud_upload</span>
          </div>
          <h3 className="text-sm font-black text-amber-900 mb-1">Save Your Progress</h3>
          <p className="text-xs font-medium text-amber-700 mb-4">Create a free account to keep your progress saved across devices and never lose it.</p>
          <Link href="/join" className="inline-flex items-center gap-2 px-6 py-3 bg-amber-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-amber-700 transition-all active:scale-95 shadow-lg shadow-amber-600/20">
            Create Free Account
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left Sidebar: Packages & Topics */}
        <div className="lg:col-span-4 space-y-8 lg:sticky lg:top-24">
          {/* Package Selection */}
          <div className="bg-white rounded-3xl border border-outline/40 p-6 shadow-soft-xl">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-secondary mb-4 px-2">Select Package</h3>
            <div className="space-y-2">
              {subjects.map(subject => (
                <button
                  key={subject.id}
                  onClick={() => setSelectedSubjectId(subject.id)}
                  className={`w-full text-left px-4 py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-between ${
                    selectedSubjectId === subject.id 
                      ? "bg-primary text-white shadow-lg" 
                      : "text-on-surface hover:bg-slate-50"
                  }`}
                >
                  <span>{subject.title}</span>
                  {selectedSubjectId === subject.id && (
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Topic Selection */}
          {filteredTopics.length > 0 && (
            <div className="bg-white rounded-3xl border border-outline/40 p-6 shadow-soft-xl">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-secondary mb-4 px-2">Main Topics</h3>
              <div className="space-y-2">
                {filteredTopics.map(topic => (
                  <button
                    key={topic.id}
                    onClick={() => setSelectedTopicId(topic.id)}
                    className={`w-full text-left px-4 py-3 rounded-2xl font-bold text-sm transition-all flex items-center gap-3 ${
                      selectedTopicId === topic.id 
                        ? "bg-secondary text-white shadow-lg" 
                        : "text-on-surface hover:bg-slate-50"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px] opacity-70">
                      {selectedTopicId === topic.id ? 'folder_open' : 'folder'}
                    </span>
                    <span className="flex-1">{topic.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main Content: Subtopics (Lessons) */}
        <div className="lg:col-span-8">
          {selectedTopicId ? (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-primary tracking-tight">
                    {currentTopic?.title}
                  </h2>
                  <p className="text-sm text-on-surface-variant font-medium mt-1">
                     {filteredSubtopics.length} Lessons &bull; {filteredSubtopics.filter(st => completedSubtopicIds.has(st.id)).length} completed
                  </p>
                </div>
              </div>

<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredSubtopics.map((subtopic) => {
                  const isSubscribed = subscribedSubjectIds.has(selectedSubjectId!);
                  const canAccess = isSubscribed || subtopic.is_free;

                  return (
                    <div
                      key={subtopic.id}
                      className="group relative h-[320px] bg-white rounded-[2.5rem] border border-white/20 overflow-hidden flex flex-col transition-all duration-700 hover:shadow-premium-2xl hover:-translate-y-2"
                    >
                      {/* Full Background Image */}
                      <div className="absolute inset-0 z-0 transition-transform duration-1000 group-hover:scale-110">
                        {subtopic.image_url ? (
                          <img src={subtopic.image_url} alt={subtopic.title} className="w-full h-full object-cover transition-all duration-700" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary to-secondary" />
                        )}
{/* Glass Overlays */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent opacity-90 group-hover:opacity-70 transition-opacity duration-700" />
                      <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-transparent opacity-60" />
                      </div>

                      {/* Glass Content Container */}
                      <div className="mt-auto relative z-10 p-2">
                      <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[2rem] p-5 sm:p-6 group-hover:bg-white/15 transition-all duration-500">
                           <div className="flex items-start justify-between gap-2">
                              <h3 className="text-lg sm:text-xl font-black text-white leading-tight mb-2">
                                {subtopic.title}
                              </h3>
                              {completedSubtopicIds.has(subtopic.id) && (
                                <div className="shrink-0 w-7 h-7 rounded-full bg-emerald-400 flex items-center justify-center shadow-lg">
                                  <span className="material-symbols-outlined text-sm text-white">check</span>
                                </div>
                              )}
                           </div>
                          <p className="text-xs text-white/70 line-clamp-2 mb-4 font-medium">
                            {subtopic.description || "Start mastering this subtopic now."}
                          </p>
                          
                          {canAccess ? (
                            <Link
                              href={`/subjects/${currentSubject?.slug}/lessons/${subtopic.id}`}
                              className="w-full py-3.5 font-black text-[10px] uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 rounded-2xl bg-white text-primary hover:bg-secondary hover:text-white shadow-lg active:scale-[0.98]"
                            >
                              Start Lesson
                              <span className="material-symbols-outlined text-lg">school</span>
                            </Link>
                          ) : (
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2 text-rose-400 font-bold text-[10px] uppercase tracking-widest justify-center">
                                <span className="material-symbols-outlined text-sm">lock</span>
                                Locked Lesson
                              </div>
                              <Link
                                href={`/subjects/${currentSubject?.slug}`}
                                className="w-full py-3.5 bg-white/10 backdrop-blur-md text-white font-black text-[10px] uppercase tracking-widest hover:bg-white/20 transition-all rounded-2xl text-center border border-white/10"
                              >
                                Unlock with Plan
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {filteredSubtopics.length === 0 && (
                <div className="p-20 bg-white rounded-3xl border-2 border-dashed border-slate-200 text-center">
                  <span className="material-symbols-outlined text-5xl text-slate-300 mb-4">menu_book</span>
                  <p className="font-bold text-on-surface-variant">No lessons found in this topic yet.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-20 bg-white rounded-3xl border border-outline/40 shadow-soft-xl text-center">
              <span className="material-symbols-outlined text-6xl text-primary/20 mb-6">auto_awesome</span>
              <h2 className="text-2xl font-black text-primary tracking-tight mb-2">Ready to learn?</h2>
              <p className="text-on-surface-variant font-medium">Select a package and topic from the sidebar to begin your journey.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
