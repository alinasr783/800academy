"use client";

import { useState } from "react";

const FAQ_ITEMS = [
  {
    q: "What makes 800 Academy different from a regular question bank?",
    a: "800 Academy isn't just another PDF or question bank — it's a full exam simulation platform. You get real-time scoring on the 800 scale, an enforced timer, a dedicated Mistake Bank that re-trains you on your weak spots, and personalized practice sessions. In short: you train smart, not random.",
  },
  {
    q: "Are the questions the same difficulty as the real EST?",
    a: "Yes. Every question is either sourced or crafted to match the actual difficulty level of the EST. Our goal is to make you so used to exam-level challenges that the real test feels familiar, not surprising.",
  },
  {
    q: "I'm a beginner — is this platform right for me?",
    a: "Absolutely. The platform is designed for every level. You start at your own pace, uncover your weak areas, and improve step by step. You don't need to be great to start — you'll be great once you do.",
  },
  {
    q: "Will this actually save me study time?",
    a: "Significantly. Instead of wasting hours studying without direction, every minute on 800 Academy targets your specific weaknesses. No random practice — just focused, measurable improvement toward your goal.",
  },
  {
    q: "Is there a system that tracks my progress?",
    a: "Yes. You can see your score trends, accuracy by topic, answers from previous exams, and which areas need more attention. It gives you a clear picture of where you stand and exactly what to focus on next.",
  },
];

export default function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section
      id="faq"
      className="py-32 px-8 lg:px-12 bg-slate-50 border-y border-outline/20 scroll-mt-32 relative overflow-hidden"
    >
      {/* Subtle background flares */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-primary/[0.03] rounded-full blur-[120px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-secondary/[0.03] rounded-full blur-[120px] pointer-events-none translate-x-1/3 translate-y-1/3" />

      <div className="max-w-[1440px] mx-auto relative z-10">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
            FAQ
          </div>
          <h2 className="font-headline text-4xl sm:text-5xl lg:text-6xl font-extrabold text-primary tracking-tighter leading-tight mb-6">
            Still Hesitating?
          </h2>
          <p className="text-on-surface-variant text-base sm:text-lg font-medium opacity-70 leading-relaxed max-w-xl mx-auto">
            Maybe you have a question that hasn&apos;t been answered yet. We&apos;re here to make everything clear — simply and honestly.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-3">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className={`bg-white border rounded-2xl overflow-hidden transition-all duration-300 ${
                  isOpen ? "border-primary/30 shadow-soft-xl" : "border-outline/40 hover:border-outline/80"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between gap-4 p-6 text-left"
                >
                  <span className="text-sm sm:text-base font-black text-primary leading-snug">
                    {item.q}
                  </span>
                  <span
                    className={`material-symbols-outlined text-primary text-xl flex-shrink-0 transition-transform duration-300 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  >
                    expand_more
                  </span>
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="px-6 pb-6 pt-0 text-on-surface-variant text-sm sm:text-base font-medium leading-relaxed">
                    {item.a}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
