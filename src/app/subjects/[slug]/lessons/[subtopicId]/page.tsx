"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import MathText from "@/components/MathText";

function isHtmlContent(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}

type Point = {
   id: string;
   content_html: string;
   subtopic_point_assets: any[];
   subtopic_point_questions: any[];
};

export default function TopicLessonViewer() {
   const params = useParams<{ slug: string; subtopicId: string }>();
   const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [subtopic, setSubtopic] = useState<any>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [isAppMode, setIsAppMode] = useState(false);

  // Practice State - per point index
  const [answersByPoint, setAnswersByPoint] = useState<Record<number, Record<string, string>>>({});
  const [submittedPoints, setSubmittedPoints] = useState<Set<number>>(new Set());
  const [scoresByPoint, setScoresByPoint] = useState<Record<number, { correct: number; total: number }>>({});

  // Derived state for current point
  const answers = answersByPoint[currentIndex] || {};
  const isSubmitted = submittedPoints.has(currentIndex);
  const score = scoresByPoint[currentIndex] || null;

  // updateAnswers merges new answers into the current point's store
  const updateAnswers = (newAnswers: Record<string, string>) => {
    setAnswersByPoint(prev => ({ ...prev, [currentIndex]: { ...(prev[currentIndex] || {}), ...newAnswers } }));
  };
  // setAnswersByCallback supports the callback pattern used in JSX
  const setAnswers = (cb: ((prev: Record<string, string>) => Record<string, string>) | Record<string, string>) => {
    if (typeof cb === 'function') {
      const prev = answersByPoint[currentIndex] || {};
      const updated = cb(prev);
      setAnswersByPoint(p => ({ ...p, [currentIndex]: updated }));
    } else {
      setAnswersByPoint(p => ({ ...p, [currentIndex]: cb }));
    }
  };

  // Guest user detection
  const [isGuest, setIsGuest] = useState(false);
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);

  useEffect(() => {
    // Scroll to top on point change
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Reset practice state for new point ONLY if we haven't submitted it yet
    // This preserves answers when going back to previous points
  }, [currentIndex]);

  useEffect(() => {
    // Auto-enable App Mode for lessons
    if (localStorage.getItem("isAppMode") !== "true") {
      localStorage.setItem("isAppMode", "true");
      window.dispatchEvent(new Event("appModeChange"));
    }
    setIsAppMode(true);
  }, []);

useEffect(() => {
       async function load() {
          try {
             setLoading(true);
             const { data: sessionData } = await supabase.auth.getSession();
             
             // Check if user is guest (not logged in)
             setIsGuest(!sessionData?.session);

             // Load Subtopic metadata
             const { data: tData, error: tErr } = await supabase.from("subtopics").select("*").eq("id", params.subtopicId).single();
             if (tErr) {
                console.error("[TopicLessonViewer] Fetch subtopic error:", tErr);
             }
             setSubtopic(tData);

             // Load subtopic points via public API
             let pData: any[] = [];
             let pErr: any = null;
             
             try {
                const res = await fetch(`/api/lesson/points?subtopic_id=${params.subtopicId}`);
                const json = await res.json();
                if (!res.ok) throw new Error(json.error);
                pData = json.points || [];
             } catch (e) {
                console.error("[TopicLessonViewer] Fetch points exception:", e);
                pErr = e;
             }

             if (pErr) {
                console.error("[TopicLessonViewer] Fetch points error:", pErr);
             }
             
             console.log("[TopicLessonViewer] Loaded points:", pData.length, "for subtopic:", params.subtopicId);
             setPoints(pData);
          } catch (error) {
             console.error("[TopicLessonViewer] General error:", error);
          } finally {
             setLoading(false);
          }
       }
       load();
    }, [params.subtopicId]);

const handleNext = useCallback(async () => {
        // Scroll to top before moving to next step
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Record streak activity when progressing
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
           fetch("/api/user/streak", {
              method: "POST",
              headers: { "Authorization": `Bearer ${session.access_token}` }
           }).catch(() => { });
        }

        if (currentIndex < points.length - 1) {
           setCurrentIndex(prev => prev + 1);
        } else {
           // Finished - Record lesson completion
           try {
              // Always store in localStorage for instant feedback
              const stored = JSON.parse(localStorage.getItem("completed_lessons") || "[]");
              if (!stored.includes(params.subtopicId)) {
                 stored.push(params.subtopicId);
                 localStorage.setItem("completed_lessons", JSON.stringify(stored));
              }
              
              // Also sync to server for logged-in users
              if (session?.access_token) {
                 fetch("/api/lesson/completions", {
                    method: "POST",
                    headers: { 
                       Authorization: `Bearer ${session.access_token}`,
                       "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ subtopic_id: params.subtopicId, subject_id: subtopic?.subject_id })
                 }).catch(() => {});
              }
           } catch (e) {
              console.error("[TopicLessonViewer] Record completion error:", e);
           }
           
           // Show completion popup for guests
           if (isGuest) {
              setShowCompletionPopup(true);
              return; // Don't redirect yet
           }
           
           // Redirect to Lessons Portal
           router.push('/lessons');
        }
    }, [currentIndex, points.length, router, params.slug, params.subtopicId, subtopic?.subject_id, isGuest]);

const handleSubmitPractice = useCallback(() => {
     const currentPoint = points[currentIndex];
     if (!currentPoint?.subtopic_point_questions) return;

     let correctCount = 0;
     const total = currentPoint.subtopic_point_questions.length;

     currentPoint.subtopic_point_questions.forEach((qData: any) => {
       const q = qData.question_bank;
       if (!q) return;

       const userAnswer = (answers[q.id] || "").trim().toLowerCase();
       
       if (q.type === 'mcq') {
          const correctOpt = q.question_bank_options?.find((o: any) => o.is_correct);
          if (correctOpt && answers[q.id] === correctOpt.id) {
             correctCount++;
          }
       } else if (q.type === 'fill') {
          const correctVal = (q.correct_text || "").trim().toLowerCase();
          if (userAnswer === correctVal) {
             correctCount++;
          }
       }
     });

     setScoresByPoint(prev => ({ ...prev, [currentIndex]: { correct: correctCount, total } }));
     setSubmittedPoints(prev => new Set(prev).add(currentIndex));
     
     // Scroll to show ~50px above the practice result
     setTimeout(() => {
       const resultEl = document.getElementById('practice-result');
       if (resultEl) {
         const rect = resultEl.getBoundingClientRect();
         const scrollTarget = window.scrollY + rect.top - 50;
         window.scrollTo({ top: scrollTarget, behavior: 'smooth' });
       }
     }, 100);
     
   }, [currentIndex, points, answers, isGuest]);

   const handlePrev = useCallback(() => {
      if (currentIndex > 0) {
         setCurrentIndex(prev => prev - 1);
      }
   }, [currentIndex]);

   useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
         if (e.code === "Space" && e.target === document.body) {
            e.preventDefault();
            handleNext();
         } else if (e.code === "ArrowRight") {
            handleNext();
         } else if (e.code === "ArrowLeft") {
            handlePrev();
         }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
   }, [handleNext, handlePrev]);

   if (loading) {
      return (
         <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
         </div>
      );
   }

   if (!subtopic) {
      return (
         <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 text-center">
            <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">construction</span>
            <h1 className="text-2xl font-black text-primary mb-2">Lesson Under Construction</h1>
            <p className="text-slate-500 mb-8">This subtopic doesn't exist or hasn't been created yet.</p>
            <Link href={`/subjects/${params.slug}`} className="px-8 py-4 bg-primary text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all">Go Back</Link>
         </div>
      );
   }

   // Check if subtopic is free for guest access
   const canGuestAccess = subtopic?.is_free === true;
   const showAccessDenied = isGuest && !canGuestAccess;

   if (showAccessDenied) {
      return (
         <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 text-center">
            <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">lock</span>
            <h1 className="text-2xl font-black text-primary mb-2">Login Required</h1>
            <p className="text-slate-500 mb-8">This lesson is for subscribers only. Please login to access.</p>
            <div className="flex gap-4">
               <Link href="/join" className="px-8 py-4 bg-primary text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all">Create Free Account</Link>
               <Link href={`/subjects/${params.slug}`} className="px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Go Back</Link>
            </div>
         </div>
      );
   }

   // If we have points, compute current point and related state
   const currentPoint = points.length > 0 ? points[currentIndex] : null;
   const progress = points.length > 0 ? ((currentIndex + 1) / points.length) * 100 : 0;
   const allAnswered = currentPoint?.subtopic_point_questions?.every((q: any) => answers[q.question_bank.id]) ?? false;

   return (
      <div className="min-h-screen bg-slate-50 flex flex-col">

         {/* Main Content Area */}
         <main className={`flex-1 pt-4 pb-40 px-4 md:px-12 w-full max-w-none mx-auto transition-all duration-300 ${isAppMode ? 'lg:pl-[72px]' : ''}`}>
            {currentPoint ? (
               <div key={currentPoint.id} className="animate-in fade-in slide-in-from-bottom-8 duration-500">

                  {/* Visuals Carousel */}
                  {currentPoint.subtopic_point_assets?.length > 0 && (
                  <div className="mb-8 group/carousel relative">
                     <div className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar gap-4 pb-2" id={`carousel-${currentPoint.id}`}>
                        {currentPoint.subtopic_point_assets.sort((a, b) => a.sort_order - b.sort_order).map((asset, i) => (
                           <div key={asset.id} className="snap-center shrink-0 w-full md:w-[85%] lg:w-[75%]">
                              <img src={asset.url} alt="lesson asset" className="w-full h-auto max-h-[65vh] object-contain rounded-xl border border-outline/20 shadow-soft-lg" />
                           </div>
                        ))}
                     </div>
                     {/* Carousel Navigation Buttons */}
                     {currentPoint.subtopic_point_assets.length > 1 && (
                        <div className="flex items-center justify-center gap-4 mt-4">
                           <button 
                              onClick={() => document.getElementById(`carousel-${currentPoint.id}`)?.scrollBy({ left: -400, behavior: 'smooth' })}
                              className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-600 hover:bg-primary hover:text-white transition-all active:scale-90"
                           >
                              <span className="material-symbols-outlined">chevron_left</span>
                           </button>
                           <div className="flex gap-1.5">
                              {currentPoint.subtopic_point_assets.map((_, i) => (
                                 <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                              ))}
                           </div>
                           <button 
                              onClick={() => document.getElementById(`carousel-${currentPoint.id}`)?.scrollBy({ left: 400, behavior: 'smooth' })}
                              className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-600 hover:bg-primary hover:text-white transition-all active:scale-90"
                           >
                              <span className="material-symbols-outlined">chevron_right</span>
                           </button>
                        </div>
                     )}
                  </div>
               )}

{/* Explanation */}
                {currentPoint.content_html && (
                  <div className="mb-12">
                    {isHtmlContent(currentPoint.content_html) ? (
                      <div 
                        className="bg-white p-6 md:p-12 rounded-3xl border border-outline/20 shadow-soft-md"
                        dangerouslySetInnerHTML={{ __html: currentPoint.content_html }}
                      />
                    ) : (
                      <div className="prose prose-lg prose-slate max-w-none text-slate-700 leading-loose bg-white p-6 md:p-12 rounded-3xl border border-outline/20 shadow-soft-md">
                        <MathText text={currentPoint.content_html} />
                      </div>
                    )}
                  </div>
                )}

               {/* Practice Questions / Result Section */}
               {currentPoint.subtopic_point_questions?.length > 0 && (
                  <div className="space-y-6 pt-10">
                     <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                           <span className="material-symbols-outlined text-xl">psychology</span>
                        </div>
                        <div>
                           <h3 className="text-lg font-black text-indigo-900 tracking-tight">Practice</h3>
                           <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Test your understanding</p>
                        </div>
                     </div>
                     
{isSubmitted && score ? (
                         <div id="practice-result" className="animate-in zoom-in-95 duration-500 space-y-4">
                            <div className="bg-white rounded-2xl p-8 text-center border-2 border-indigo-100 shadow-soft-xl">
                               <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                  <span className="material-symbols-outlined text-3xl">emoji_events</span>
                               </div>
                               <h2 className="text-xl font-black text-indigo-900 mb-1">Practice Complete!</h2>
                               <p className="text-sm text-slate-500 mb-6">Review your answers below before continuing.</p>
                               <div className="flex items-center justify-center gap-6">
                                  <div className="bg-emerald-50 px-6 py-3 rounded-xl border border-emerald-100">
                                     <div className="text-2xl font-black text-emerald-600">{score.correct}</div>
                                     <div className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Correct</div>
                                  </div>
                                  <div className="bg-rose-50 px-6 py-3 rounded-xl border border-rose-100">
                                     <div className="text-2xl font-black text-rose-600">{score.total - score.correct}</div>
                                     <div className="text-[9px] font-black text-rose-400 uppercase tracking-widest">Wrong</div>
                                  </div>
                                  <div className="bg-slate-50 px-6 py-3 rounded-xl border border-slate-100">
                                     <div className="text-2xl font-black text-slate-600">{score.total}</div>
                                     <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total</div>
                                  </div>
                               </div>
                            </div>

                            {/* Detailed Question Analysis */}
                            <div className="space-y-6">
                               <h3 className="text-lg font-black text-slate-800 px-2">Question Analysis</h3>
                               {currentPoint.subtopic_point_questions.sort((a, b) => a.sort_order - b.sort_order).map((qData, qIdx) => {
                                  const q = qData.question_bank;
                                  if (!q) return null;
                                  
                                  let isCorrect = false;

                                  if (q.type === 'mcq') {
                                     const correctOpt = q.question_bank_options?.find((o: any) => o.is_correct);
                                     isCorrect = answers[q.id] === correctOpt?.id;
                                  } else if (q.type === 'fill') {
                                     isCorrect = (answers[q.id] || "").trim().toLowerCase() === (q.correct_text || "").trim().toLowerCase();
                                  }

                                  return (
                                     <div key={q.id} className={`bg-white rounded-2xl border-2 shadow-soft-xl overflow-hidden ${isCorrect ? 'border-emerald-200' : 'border-rose-200'}`}>
                                        {/* Question Header */}
                                        <div className="p-6 border-b border-slate-100">
                                           <div className="flex items-center gap-4">
                                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${isCorrect ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                                 {isCorrect ? (
                                                    <span className="material-symbols-outlined text-lg">check</span>
                                                 ) : (
                                                    <span className="material-symbols-outlined text-lg">close</span>
                                                 )}
                                              </div>
                                              <div>
                                                 <div className="text-xs font-black uppercase tracking-widest text-slate-400">Question {qIdx + 1}</div>
                                                 <div className={`text-xs font-bold uppercase tracking-widest ${isCorrect ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {isCorrect ? 'Correct Answer' : 'Wrong Answer'}
                                                 </div>
                                              </div>
                                           </div>
                                        </div>

                                        {/* Question Content */}
                                        <div className="p-6">
                                           <div className="text-base font-medium text-slate-800 mb-6">
                                              <MathText text={q.prompt_text || ""} />
                                           </div>

                                           {/* Options */}
                                           {q.type === 'mcq' && (
                                              <div className="space-y-2">
                                                 {(q.question_bank_options || []).sort((a: any, b: any) => a.option_number - b.option_number).map((opt: any, i: number) => {
                                                    const isSelected = answers[q.id] === opt.id;
                                                    const isCorrectOpt = opt.is_correct;
                                                    const border = isCorrectOpt ? 'border-emerald-400' : isSelected ? 'border-rose-400' : 'border-slate-200';
                                                    const bg = isCorrectOpt ? 'bg-emerald-50' : isSelected ? 'bg-rose-50' : 'bg-slate-50';
                                                    return (
                                                       <div key={opt.id} className={`border-2 ${border} ${bg} px-4 py-3 rounded-xl flex items-center justify-between`}>
                                                          <div className="flex items-center gap-3">
                                                             <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${isCorrectOpt ? 'bg-emerald-200 text-emerald-700' : isSelected ? 'bg-rose-200 text-rose-700' : 'bg-slate-200 text-slate-500'}`}>
                                                                {String.fromCharCode(65 + i)}
                                                             </div>
                                                             <div className="text-sm font-bold text-slate-700">
                                                                <MathText text={opt.text} />
                                                             </div>
                                                          </div>
                                                          <div className="flex gap-2">
                                                             {isSelected && <span className="px-2 py-0.5 bg-primary/10 text-primary text-[9px] font-black uppercase rounded">Your Choice</span>}
                                                             {isCorrectOpt && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase rounded">Correct</span>}
                                                          </div>
                                                       </div>
                                                    );
                                                 })}
                                              </div>
                                           )}

                                           {/* Fill in the blank */}
                                           {q.type === 'fill' && (
                                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                 <div className={`p-4 rounded-xl border-2 ${isCorrect ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50'}`}>
                                                    <div className="text-[10px] font-black uppercase tracking-widest mb-1 text-slate-500">Your Answer</div>
                                                    <div className="text-sm font-bold text-slate-700">{answers[q.id] || '—'}</div>
                                                 </div>
                                                 <div className="bg-emerald-50 p-4 rounded-xl border-2 border-emerald-200">
                                                    <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Correct Answer</div>
                                                    <div className="text-sm font-bold text-emerald-700">{q.correct_text}</div>
                                                 </div>
                                              </div>
                                           )}

                                           {/* Explanation */}
                                           {q.explanation_text && (
                                              <div className="mt-6 p-5 bg-blue-50 rounded-2xl border-2 border-blue-100/50">
                                                 <div className="flex items-center gap-2 mb-3 text-blue-700">
                                                    <span className="material-symbols-outlined text-sm">lightbulb</span>
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Explanation</span>
                                                 </div>
                                                 <div className="text-sm font-medium text-blue-900">
                                                    <MathText text={q.explanation_text} />
                                                 </div>
                                              </div>
                                           )}
                                        </div>
                                     </div>
                                  );
                               })}
                            </div>
                         </div>
                      ) : (
                        currentPoint.subtopic_point_questions.sort((a, b) => a.sort_order - b.sort_order).map((qData, qIdx) => {
                           const q = qData.question_bank;
                           if (!q) return null;
                           return (
                              <div key={q.id} className="bg-white rounded-2xl border border-indigo-100 p-6 md:p-8 shadow-soft-xl">
                                 <div className="flex items-start gap-4 mb-8">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-sm flex-shrink-0 mt-1">Q</div>
                                    <div className="text-lg font-medium text-slate-800 leading-relaxed pt-1">
                                       <MathText text={q.prompt_text || ""} />
                                    </div>
                                 </div>
                                 
                                 {q.type === 'mcq' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                                       {(q.question_bank_options || []).sort((a: any, b: any) => a.option_number - b.option_number).map((opt: any, i: number) => {
                                          const isSelected = answers[q.id] === opt.id;
                                          return (
                                             <div 
                                                key={opt.id} 
                                                onClick={() => setAnswers(prev => ({ ...prev, [q.id]: opt.id }))}
                                                className={`p-4 border-2 rounded-xl flex items-center gap-4 transition-all cursor-pointer group ${
                                                   isSelected ? 'border-primary bg-indigo-50/50 ring-2 ring-primary/10' : 'border-slate-100 hover:border-indigo-300 hover:bg-indigo-50'
                                                }`}
                                             >
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs transition-all ${
                                                   isSelected ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600'
                                                }`}>{String.fromCharCode(65 + i)}</div>
                                                <div className={`text-sm font-bold transition-all ${isSelected ? 'text-primary' : 'text-slate-700'}`}><MathText text={opt.text} /></div>
                                             </div>
                                          );
                                       })}
                                    </div>
                                 )}
                                 {q.type === 'fill' && (
                                    <div className="mt-6">
                                       <input 
                                          type="text" 
                                          value={answers[q.id] || ""}
                                          onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                                          placeholder="Type your answer..." 
                                          className="w-full h-12 px-5 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-indigo-500 outline-none transition-all font-bold text-lg" 
                                       />
                                    </div>
                                 )}
                              </div>
                           );
                        })
                     )}
                  </div>
                  )}
               </div>
            ) : (
               <div className="p-8 text-center">
                  <h1 className="text-2xl font-bold text-slate-800 mb-4">{subtopic?.title}</h1>
                  <p className="text-slate-500">This lesson has no practice questions yet. Enjoy the content!</p>
               </div>
            )}
         </main>

         {/* Navigation Footer - only show if we have points */}
         {points.length > 0 && currentPoint && (
            <footer className={`fixed bottom-0 inset-x-0 h-16 md:h-18 bg-white border-t border-outline/20 z-50 flex p-2 md:p-3 gap-2 md:gap-4 shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.05)] transition-all duration-300 ${isAppMode ? 'lg:left-[72px]' : ''}`}>
            <button
               onClick={handlePrev}
               disabled={currentIndex === 0}
               className="w-[20%] h-full rounded-xl border border-slate-200 font-black text-[10px] uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-30 flex items-center justify-center gap-2"
            >
               <span className="material-symbols-outlined text-sm">arrow_back</span>
               <span className="hidden sm:inline">Prev</span>
            </button>

            <button
               onClick={currentPoint.subtopic_point_questions?.length > 0 && !isSubmitted ? handleSubmitPractice : handleNext}
               disabled={currentPoint.subtopic_point_questions?.length > 0 && !isSubmitted && !allAnswered}
               className={`w-[80%] h-full rounded-xl text-white font-black text-[10px] md:text-xs uppercase tracking-[0.2em] shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-3 ${
                  currentPoint.subtopic_point_questions?.length > 0 && !isSubmitted 
                  ? 'bg-indigo-600 shadow-indigo-600/20 hover:bg-indigo-700 disabled:opacity-40 disabled:grayscale' 
                  : 'bg-primary shadow-primary/10 hover:bg-slate-800'
               }`}
            >
               {currentPoint.subtopic_point_questions?.length > 0 && !isSubmitted ? (
                  <>
                    {allAnswered ? 'Submit Practice' : 'Answer All Questions'} 
                    <span className="material-symbols-outlined text-sm">{allAnswered ? 'send' : 'pending_actions'}</span>
                  </>
               ) : currentIndex === points.length - 1 ? (
                  <>Finish Lesson <span className="material-symbols-outlined text-sm">done_all</span></>
) : (
                   <>Next Step <span className="material-symbols-outlined text-sm">arrow_forward</span></>
                )}
              </button>
           </footer>
            )}

           {/* Lesson Completion Popup for Guests */}
           {showCompletionPopup && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                 <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => { setShowCompletionPopup(false); router.push('/lessons'); }} />
                 <div className="relative bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300">
                    <button onClick={() => { setShowCompletionPopup(false); router.push('/lessons'); }} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-all">
                       <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                    <div className="text-center">
                       <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                          <span className="material-symbols-outlined text-3xl">school</span>
                       </div>
                       <h2 className="text-2xl font-black text-slate-800 mb-2">Lesson Complete!</h2>
                       <p className="text-slate-500 mb-6">Create a free account to track your progress across all lessons and see how much you've completed!</p>
                       <div className="space-y-3">
                          <Link href="/join" className="w-full py-4 bg-primary text-white font-black text-sm uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-all">
                             Create Free Account
                             <span className="material-symbols-outlined text-lg">arrow_forward</span>
                          </Link>
                          <button onClick={() => { setShowCompletionPopup(false); router.push('/lessons'); }} className="w-full py-3 text-slate-400 font-bold text-sm hover:text-slate-600 transition-all">
                             Maybe Later
                          </button>
                       </div>
                    </div>
                 </div>
              </div>
           )}

        </div>
     );
  }
