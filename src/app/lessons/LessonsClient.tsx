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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left Sidebar: Packages & Topics */}
        <div className="lg:col-span-4 space-y-8 sticky top-24">
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
                    {filteredSubtopics.length} Lessons in this topic
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
                      className={`group relative bg-white rounded-[32px] border-2 border-outline/40 shadow-soft-xl overflow-hidden flex flex-col transition-all duration-500 hover:shadow-soft-2xl hover:-translate-y-2 hover:border-primary/30 ${!subtopic.image_url ? 'justify-between min-h-[200px]' : ''}`}
                    >
                      {subtopic.image_url ? (
                         <div className="relative h-48 bg-slate-100 overflow-hidden">
                           <img src={subtopic.image_url} alt={subtopic.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                           <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent mix-blend-multiply opacity-80" />
                           <div className="absolute top-4 right-4 z-10">
                             <div className={`px-3 py-1.5 rounded-full text-[9px] font-black tracking-[0.2em] uppercase shadow-xl backdrop-blur-md border border-white/20 ${subtopic.is_free ? "bg-emerald-500/90 text-white" : "bg-white/10 text-white"}`}>
                               {subtopic.is_free ? "Free Preview" : "Premium"}
                             </div>
                           </div>
                           <div className="absolute bottom-4 left-4 right-4 z-10">
                             <div className="text-[10px] font-black text-white/70 uppercase tracking-widest mb-1 drop-shadow-md">
                               {subtopic.category || 'General'}
                             </div>
                             <h3 className="text-lg font-black text-white leading-tight drop-shadow-lg">
                               {subtopic.title}
                             </h3>
                           </div>
                         </div>
                      ) : (
                         <div className="p-8 flex-1 flex flex-col">
                             <div className="flex justify-between items-start mb-4">
                                <div className="text-[10px] font-black text-primary/60 uppercase tracking-widest bg-primary/5 px-3 py-1 rounded-full">
                                   {subtopic.category || 'General'}
                                </div>
                                <div className={`px-3 py-1 rounded-full text-[9px] font-black tracking-[0.2em] uppercase shadow-sm ${subtopic.is_free ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                                  {subtopic.is_free ? "Free Preview" : "Premium"}
                                </div>
                             </div>
                             <h3 className="text-xl font-black text-slate-800 leading-tight">
                               {subtopic.title}
                             </h3>
                             <p className="text-xs text-on-surface-variant mt-2 line-clamp-2">
                                {subtopic.description || "Start mastering this subtopic now."}
                             </p>
                         </div>
                      )}
                      
                      <div className="p-6 mt-auto">
                        {canAccess ? (
                          <Link
                            href={`/subjects/${currentSubject?.slug}/lessons/${subtopic.id}`}
                            className={`w-full py-4 font-black text-[11px] uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 rounded-2xl ${subtopic.image_url ? 'bg-slate-50 border-2 border-slate-100 text-primary hover:border-primary hover:bg-primary hover:text-white' : 'bg-primary text-white shadow-lg shadow-primary/20 hover:bg-slate-800 active:scale-95'}`}
                          >
                            Start Lesson
                            <span className="material-symbols-outlined text-lg">school</span>
                          </Link>
                        ) : (
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2 text-rose-500 font-bold text-[10px] uppercase tracking-widest justify-center">
                              <span className="material-symbols-outlined text-sm">lock</span>
                              Locked Lesson
                            </div>
                            <Link
                              href={`/subjects/${currentSubject?.slug}`}
                              className="w-full py-4 bg-slate-100 text-on-surface-variant font-black text-[11px] uppercase tracking-widest hover:bg-slate-200 transition-all rounded-2xl text-center"
                            >
                              Unlock with Plan
                            </Link>
                          </div>
                        )}
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
