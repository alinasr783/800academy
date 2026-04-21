"use client";

import Image from "next/image";

const benefits = [
  { text: "EST Simulation", icon: "desktop_windows", delay: "0s" },
  { text: "Thousands of Questions", icon: "quiz", delay: "1.2s" },
  { text: "Detailed Explanations", icon: "lightbulb", delay: "0.5s" },
  { text: "Personalized Practice", icon: "person", delay: "2s" },
  { text: "Past EST Exams", icon: "history_edu", delay: "2.5s" },
  { text: "Performance Tracking", icon: "trending_up", delay: "0.8s" },
  { text: "Lesson-wise Practice", icon: "menu_book", delay: "1.5s" },
];

export default function HeroSection() {
  return (
    <section className="relative min-h-[85vh] flex flex-col items-center justify-center pt-0 pb-12 overflow-hidden hero-grid">
      {/* Background Decorative Elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Floating Benefits - Desktop Only */}
      <div className="hidden lg:block absolute inset-0 pointer-events-none">
        <div className="relative w-full h-full max-w-[1240px] mx-auto">
          {/* Top Left */}
          <div
            className="absolute top-[18%] left-[8%] floating-pill animate-float pointer-events-auto"
            style={{ animationDelay: benefits[0].delay }}
          >
            <span className="material-symbols-outlined">{benefits[0].icon}</span>
            <p>{benefits[0].text}</p>
          </div>
          {/* Top Right */}
          <div
            className="absolute top-[22%] right-[10%] floating-pill animate-float pointer-events-auto"
            style={{ animationDelay: benefits[1].delay }}
          >
            <span className="material-symbols-outlined">{benefits[1].icon}</span>
            <p>{benefits[1].text}</p>
          </div>
          {/* Middle Far Left */}
          <div
            className="absolute top-[48%] -left-[2%] floating-pill animate-float pointer-events-auto"
            style={{ animationDelay: benefits[2].delay }}
          >
            <span className="material-symbols-outlined">{benefits[2].icon}</span>
            <p>{benefits[2].text}</p>
          </div>
          {/* Middle Far Right */}
          <div
            className="absolute top-[52%] -right-[2%] floating-pill animate-float pointer-events-auto"
            style={{ animationDelay: benefits[3].delay }}
          >
            <span className="material-symbols-outlined">{benefits[3].icon}</span>
            <p>{benefits[3].text}</p>
          </div>
          {/* Bottom Left */}
          <div
            className="absolute bottom-[22%] left-[5%] floating-pill animate-float pointer-events-auto"
            style={{ animationDelay: benefits[4].delay }}
          >
            <span className="material-symbols-outlined">{benefits[4].icon}</span>
            <p>{benefits[4].text}</p>
          </div>
          {/* Bottom Right */}
          <div
            className="absolute bottom-[18%] right-[5%] floating-pill animate-float pointer-events-auto"
            style={{ animationDelay: benefits[5].delay }}
          >
            <span className="material-symbols-outlined">{benefits[5].icon}</span>
            <p>{benefits[5].text}</p>
          </div>
          {/* Top Center-ish (Replacing Bottom Center) */}
          <div
            className="absolute top-[4%] left-[50%] -translate-x-1/2 floating-pill animate-float pointer-events-auto"
            style={{ animationDelay: benefits[6].delay }}
          >
            <span className="material-symbols-outlined">{benefits[6].icon}</span>
            <p>{benefits[6].text}</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-8 relative z-10 text-center flex flex-col items-center">
        
        {/* TOP BENEFITS - Mobile Only (Pyramid Shape: 1 then 2) */}
        <div className="lg:hidden flex flex-col items-center gap-3 mb-8 w-full max-w-[340px]">
          {/* Row 1: 1 item */}
          <div className="floating-pill py-1.5 px-3 animate-float" style={{ animationDelay: benefits[0].delay }}>
            <span className="material-symbols-outlined text-[16px]">{benefits[0].icon}</span>
            <p className="text-[10px] font-bold">{benefits[0].text}</p>
          </div>
          {/* Row 2: 2 items */}
          <div className="grid grid-cols-2 gap-3 w-full">
            {benefits.slice(1, 3).map((benefit, index) => (
              <div key={index} className="floating-pill py-1.5 px-3 animate-float" style={{ animationDelay: benefit.delay }}>
                <span className="material-symbols-outlined text-[16px]">{benefit.icon}</span>
                <p className="text-[10px] font-bold">{benefit.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* LOGO (Mobile/Desktop) */}
        <div className="mb-8 w-44 h-18 md:w-60 md:h-28 relative group">
          <div className="absolute inset-0 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all duration-700" />
          <div className="relative w-full h-full p-0 bg-transparent overflow-hidden flex items-center justify-center">
            <Image
              src="/logo.png"
              alt="800 Academy Logo"
              width={528}
              height={228}
              className="object-contain opacity-90 group-hover:opacity-100 transition-opacity drop-shadow-sm"
            />
          </div>
        </div>

        {/* Headlines */}
        <h1 className="font-headline text-3xl md:text-5xl lg:text-[4.2rem] font-extrabold text-primary leading-[1.2] lg:leading-[1.1] mb-6 lg:mb-8 tracking-tight">
          Everything you need to <br />
          <span className="gradient-text">ace the EST exam</span>
        </h1>
        
        <p className="text-on-surface-variant text-[14px] md:text-lg lg:text-xl max-w-2xl mb-10 lg:mb-12 font-medium opacity-80 leading-relaxed px-2">
          Full EST simulation, Mistake Bank, Comprehensive explanations. <br className="hidden md:block" />
          Subscribe now and watch your score skyrocket.
        </p>

        {/* CTA Button */}
        <div className="flex flex-col sm:flex-row gap-5 mb-10 lg:mb-0">
          <a
            href="#plans"
            className="bg-[#001a3d] text-white px-10 py-5 font-bold text-lg transition-all active:scale-[0.98] btn-sharp text-center shadow-2xl hover:shadow-blue-900/30 hover:-translate-y-1 relative group overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <span className="relative z-10">Explore Packages</span>
          </a>
        </div>

        {/* BOTTOM BENEFITS - Mobile Only (Remaining 4 items in 2x2) */}
        <div className="lg:hidden grid grid-cols-2 gap-3 w-full max-w-[340px]">
          {benefits.slice(3, 7).map((benefit, index) => (
             <div key={index} className="floating-pill py-1.5 px-3 animate-float" style={{ animationDelay: benefit.delay }}>
              <span className="material-symbols-outlined text-[16px]">{benefit.icon}</span>
              <p className="text-[10px] font-bold">{benefit.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
