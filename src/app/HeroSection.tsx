"use client";

import Image from "next/image";

const benefits = [
  { text: "EST Simulation", icon: "desktop_windows", delay: "0s" },
  { text: "+1000 Questions", icon: "quiz", delay: "1.2s" },
  { text: "Detailed Explanations", icon: "lightbulb", delay: "0.5s" },
  { text: "Personalized Practice", icon: "person", delay: "2s" },
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
        <div className="relative w-full h-full max-w-[1400px] mx-auto">
          {/* Left Side - 3 Items */}
          <div className="absolute left-[4%] top-[22%] floating-pill animate-float pointer-events-auto" style={{ animationDelay: benefits[0].delay }}>
            <span className="material-symbols-outlined">{benefits[0].icon}</span>
            <p>{benefits[0].text}</p>
          </div>
          <div className="absolute left-[1%] top-[48%] floating-pill animate-float pointer-events-auto" style={{ animationDelay: benefits[1].delay }}>
            <span className="material-symbols-outlined">{benefits[1].icon}</span>
            <p>{benefits[1].text}</p>
          </div>
          <div className="absolute left-[5%] top-[74%] floating-pill animate-float pointer-events-auto" style={{ animationDelay: benefits[2].delay }}>
            <span className="material-symbols-outlined">{benefits[2].icon}</span>
            <p>{benefits[2].text}</p>
          </div>

          {/* Right Side - 3 Items */}
          <div className="absolute right-[4%] top-[22%] floating-pill animate-float pointer-events-auto" style={{ animationDelay: benefits[3].delay }}>
            <span className="material-symbols-outlined">{benefits[3].icon}</span>
            <p>{benefits[3].text}</p>
          </div>
          <div className="absolute right-[1%] top-[48%] floating-pill animate-float pointer-events-auto" style={{ animationDelay: benefits[4].delay }}>
            <span className="material-symbols-outlined">{benefits[4].icon}</span>
            <p>{benefits[4].text}</p>
          </div>
          <div className="absolute right-[5%] top-[74%] floating-pill animate-float pointer-events-auto" style={{ animationDelay: benefits[5].delay }}>
            <span className="material-symbols-outlined">{benefits[5].icon}</span>
            <p>{benefits[5].text}</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 relative z-10 text-center flex flex-col items-center">

        {/* TOP BENEFITS - Mobile Only (Manual Positioning) */}
        <div className="lg:hidden relative w-full h-[120px] mb-8 pointer-events-none">
          {/* Row 1: Top Center */}
          <div
            className="absolute left-1/2 -translate-x-1/2 top-[5px] floating-pill py-1.5 px-3 animate-float w-fit pointer-events-auto"
            style={{ animationDelay: benefits[3].delay }}
          >
            <span className="material-symbols-outlined text-[14px]">{benefits[3].icon}</span>
            <p className="text-[10px] font-bold">{benefits[3].text}</p>
          </div>
          {/* Row 2: Left */}
          <div
            className="absolute left-[5px] top-[65px] floating-pill py-1.5 px-3 animate-float w-fit pointer-events-auto"
            style={{ animationDelay: benefits[1].delay }}
          >
            <span className="material-symbols-outlined text-[14px]">{benefits[1].icon}</span>
            <p className="text-[10px] font-bold tracking-tight">{benefits[1].text}</p>
          </div>
          {/* Row 2: Right */}
          <div
            className="absolute right-[5px] top-[105px] floating-pill py-1.5 px-3 animate-float w-fit pointer-events-auto"
            style={{ animationDelay: benefits[0].delay }}
          >
            <span className="material-symbols-outlined text-[14px]">{benefits[0].icon}</span>
            <p className="text-[10px] font-bold tracking-tight">{benefits[0].text}</p>
          </div>
        </div>

        {/* LOGO (Mobile/Desktop) */}
        <div className="mb-8 w-64 h-28 md:w-60 md:h-28 relative group">
          <div className="relative w-full h-full p-0 bg-transparent overflow-hidden flex items-center justify-center">
            <Image
              src="/logo.png"
              alt="800 Academy Logo"
              width={628}
              height={328}
              className="object-contain opacity-90 group-hover:opacity-100 transition-opacity drop-shadow-sm"
              priority={true}
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
        <div className="flex flex-col sm:flex-row gap-5 mb-10 lg:mb-0 w-full justify-center px-4 md:px-0">
          <a
            href="#plans"
            className="bg-[#001a3d] text-white w-full sm:w-auto px-10 py-5 font-bold text-lg transition-all active:scale-[0.98] btn-sharp text-center shadow-2xl hover:shadow-blue-900/30 hover:-translate-y-1 relative group overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <span className="relative z-10">Explore Packages</span>
          </a>
        </div>

        {/* BOTTOM BENEFITS - Mobile Only (Manual Positioning) */}
        <div className="lg:hidden relative w-full h-[130px] mt-10 pointer-events-none">
          {/* Row 1: Left */}
          <div
            className="absolute left-[10px] top-[-50px] floating-pill py-1.5 px-3 animate-float w-fit pointer-events-auto"
            style={{ animationDelay: benefits[3].delay }}
          >
            <span className="material-symbols-outlined text-[14px]">{benefits[3].icon}</span>
            <p className="text-[10px] font-bold tracking-tight">{benefits[3].text}</p>
          </div>
          {/* Row 1: Right */}
          <div
            className="absolute right-[10px] top-[15px] floating-pill py-1.5 px-3 animate-float w-fit pointer-events-auto"
            style={{ animationDelay: benefits[4].delay }}
          >
            <span className="material-symbols-outlined text-[14px]">{benefits[4].icon}</span>
            <p className="text-[10px] font-bold tracking-tight">{benefits[4].text}</p>
          </div>
          {/* Row 2: Bottom Center */}
          <div
            className="absolute left-[10px] top-[75px] floating-pill py-1.5 px-3 animate-float w-fit pointer-events-auto"
            style={{ animationDelay: benefits[5].delay }}
          >
            <span className="material-symbols-outlined text-[14px]">{benefits[5].icon}</span>
            <p className="text-[10px] font-bold">{benefits[5].text}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
