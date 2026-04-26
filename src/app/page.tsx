import PlansSection from "./PlansSection";
import SiteHeader from "@/components/SiteHeader";
import Image from "next/image";
import Link from "next/link";
import logo from "./logo.png";
import HeroSection from "./HeroSection";
import FAQSection from "./FAQSection";
import SupportSection from "./SupportSection";

export default function Home() {
  const whatsappHref =
    "https://wa.me/201158954215?text=" +
    encodeURIComponent("I came from 800 Academy and I need help.");

  return (
    <>
      <SiteHeader active="home" />
      <main className="pt-[90px]">
        <HeroSection />
        <PlansSection showMoreLink />
        <section
          id="benefits"
          className="bg-brand-light py-32 border-y border-outline/30 relative scroll-mt-32 overflow-hidden"
        >
          {/* Decorative background flare */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-secondary/5 rounded-full blur-[120px] pointer-events-none" />

          <div className="max-w-[1440px] mx-auto px-8 lg:px-12 relative z-10">
            <div className="max-w-2xl mb-24">
              <div className="text-secondary font-extrabold text-[12px] uppercase tracking-[0.4em] mb-4">
                Excellence
              </div>
              <h2 className="font-headline text-5xl lg:text-7xl font-extrabold text-primary tracking-tighter leading-tight">
                Why 800 Academy
              </h2>
              <p className="mt-6 text-on-surface-variant text-xl font-medium opacity-70 leading-relaxed">
                The most advanced platform designed specifically for EST excellence.
                Everything you need to master the test in one place.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Card 1: True Exam Simulation */}
              <div className="group bg-white p-10 border border-outline/50 rounded-3xl shadow-premium hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 relative overflow-hidden">
                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-primary transition-all duration-500">
                  <span className="material-symbols-outlined text-primary text-3xl group-hover:text-white transition-colors">
                    desktop_windows
                  </span>
                </div>
                <h3 className="font-headline text-2xl font-extrabold text-primary mb-4 tracking-tight">
                  True Exam Simulation
                </h3>
                <p className="text-on-surface-variant leading-relaxed font-medium">
                  A 1:1 interface with the official EST environment, providing the most realistic Digital testing experience.
                </p>
              </div>

              {/* Card 2: Thousands of Questions */}
              <div className="group bg-white p-10 border border-outline/50 rounded-3xl shadow-premium hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 relative overflow-hidden">
                <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-amber-500 transition-all duration-500">
                  <span className="material-symbols-outlined text-amber-600 text-3xl group-hover:text-white transition-colors">
                    quiz
                  </span>
                </div>
                <h3 className="font-headline text-2xl font-extrabold text-primary mb-4 tracking-tight">
                  Thousands of Questions
                </h3>
                <p className="text-on-surface-variant leading-relaxed font-medium">
                  A massive library of high-quality questions covering all subjects, crafted by academic experts.
                </p>
              </div>

              {/* Card 3: Detailed Explanations */}
              <div className="group bg-white p-10 border border-outline/50 rounded-3xl shadow-premium hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 relative overflow-hidden">
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-emerald-500 transition-all duration-500">
                  <span className="material-symbols-outlined text-emerald-600 text-3xl group-hover:text-white transition-colors">
                    lightbulb
                  </span>
                </div>
                <h3 className="font-headline text-2xl font-extrabold text-primary mb-4 tracking-tight">
                  Detailed Explanations
                </h3>
                <p className="text-on-surface-variant leading-relaxed font-medium">
                  Step-by-step solution breakdowns for every question to help you learn from every mistake.
                </p>
              </div>

              {/* Card 4: Personalized Practice */}
              <div className="group bg-white p-10 border border-outline/50 rounded-3xl shadow-premium hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 relative overflow-hidden">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-indigo-600 transition-all duration-500">
                  <span className="material-symbols-outlined text-indigo-600 text-3xl group-hover:text-white transition-colors">
                    person
                  </span>
                </div>
                <h3 className="font-headline text-2xl font-extrabold text-primary mb-4 tracking-tight">
                  Personalized Practice
                </h3>
                <p className="text-on-surface-variant leading-relaxed font-medium">
                  Smart question selection that adapts to your performance, focusing on areas where you need it most.
                </p>
              </div>

              {/* Card 5: Performance Tracking */}
              <div className="group bg-white p-10 border border-outline/50 rounded-3xl shadow-premium hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 relative overflow-hidden">
                <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-rose-500 transition-all duration-500">
                  <span className="material-symbols-outlined text-rose-600 text-3xl group-hover:text-white transition-colors">
                    trending_up
                  </span>
                </div>
                <h3 className="font-headline text-2xl font-extrabold text-primary mb-4 tracking-tight">
                  Performance Tracking
                </h3>
                <p className="text-on-surface-variant leading-relaxed font-medium">
                  Real-time analytics and instant scoring on the real 800-scale to monitor your progress accurately.
                </p>
              </div>

              {/* Card 6: Lesson-wise Practice */}
              <div className="group bg-white p-10 border border-outline/50 rounded-3xl shadow-premium hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 relative overflow-hidden">
                <div className="w-14 h-14 bg-sky-50 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-sky-500 transition-all duration-500">
                  <span className="material-symbols-outlined text-sky-600 text-3xl group-hover:text-white transition-colors">
                    menu_book
                  </span>
                </div>
                <h3 className="font-headline text-2xl font-extrabold text-primary mb-4 tracking-tight">
                  Lesson-wise Practice
                </h3>
                <p className="text-on-surface-variant leading-relaxed font-medium">
                  Master the curriculum topic by topic with practice sessions organized exactly like your lessons.
                </p>
              </div>

            </div>
          </div>
        </section>
        <FAQSection />
        <SupportSection />
        <section
          id="contact"
          className="py-40 px-8 relative overflow-hidden bg-[#020617] section-curve scroll-mt-32"
        >
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-secondary rounded-full blur-[150px] -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-indigo-500 rounded-full blur-[150px] translate-x-1/3 translate-y-1/3" />
          </div>
          <div className="max-w-[1440px] mx-auto relative z-10 text-center">
            <h2 className="font-headline text-5xl md:text-7xl font-extrabold text-white mb-10 tracking-tighter leading-tight max-w-4xl mx-auto">
              Stop guessing. <br />
              <span className="text-secondary">Start simulating.</span>
            </h2>
            <p className="text-slate-300 text-xl mb-16 max-w-2xl mx-auto font-medium leading-relaxed">
              Join students who eliminated test-day anxiety with our high-fidelity mock
              environments.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-8">
              <Link
                href="/join?mode=signup"
                className="bg-secondary text-white px-14 py-6 font-bold text-xl hover:shadow-2xl hover:shadow-blue-500/40 hover:-translate-y-1 transition-all btn-sharp"
              >
                Create Free Account
              </Link>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="bg-white/5 text-white backdrop-blur-md border border-white/10 px-14 py-6 font-bold text-xl hover:bg-white/10 transition-all btn-sharp text-center"
              >
                Talk to a Mentor
              </a>
            </div>
            <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-12 max-w-4xl mx-auto border-t border-white/10 pt-20">
              <div>
                <div className="text-4xl font-extrabold text-white mb-2">500+</div>
                <div className="text-xs uppercase tracking-widest text-slate-400 font-bold">
                  Original Mock Exams
                </div>
              </div>
              <div>
                <div className="text-4xl font-extrabold text-white mb-2">2026</div>
                <div className="text-xs uppercase tracking-widest text-slate-400 font-bold">
                  Updated for 2026 Trails
                </div>
              </div>
              <div>
                <div className="text-4xl font-extrabold text-white mb-2">1:1</div>
                <div className="text-xs uppercase tracking-widest text-slate-400 font-bold">
                  Interface Fidelity
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="bg-surface-variant w-full pt-16 pb-8 border-t border-outline/30">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 px-8 max-w-7xl mx-auto mb-16">
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-6">
              <Image src={logo} alt="800 Academy" className="h-9 w-auto" />
            </div>
            <p className="text-on-surface-variant text-sm font-medium leading-relaxed opacity-80 mb-6">
              The premium destination for the Egyptian American Diploma. High-fidelity
              simulations for academic excellence.
            </p>
            <div className="flex gap-4 opacity-80">
              <a className="hover:opacity-100 transition-all text-primary" href="#">
                <span className="material-symbols-outlined">public</span>
              </a>
              <a className="hover:opacity-100 transition-all text-primary" href="#">
                <span className="material-symbols-outlined">forum</span>
              </a>
              <a className="hover:opacity-100 transition-all text-primary" href="#">
                <span className="material-symbols-outlined">alternate_email</span>
              </a>
            </div>
          </div>
          <div>
            <h5 className="text-xs font-bold text-primary uppercase tracking-widest mb-6">
              Resources
            </h5>
            <ul className="space-y-4 font-inter text-xs font-medium">
              <li>
                <a
                  className="text-on-surface/70 hover:text-primary hover:underline transition-all"
                  href="#"
                >
                  Platform Tour
                </a>
              </li>
              <li>
                <a
                  className="text-on-surface/70 hover:text-primary hover:underline transition-all"
                  href="#"
                >
                  EST 1 Guides
                </a>
              </li>
              <li>
                <a
                  className="text-on-surface/70 hover:text-primary hover:underline transition-all"
                  href="#"
                >
                  SAT Blueprints
                </a>
              </li>
              <li>
                <a
                  className="text-on-surface/70 hover:text-primary hover:underline transition-all"
                  href="#"
                >
                  FAQ
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h5 className="text-xs font-bold text-primary uppercase tracking-widest mb-6">
              Company
            </h5>
            <ul className="space-y-4 font-inter text-xs font-medium">
              <li>
                <a
                  className="text-on-surface/70 hover:text-primary hover:underline transition-all"
                  href="#"
                >
                  About Us
                </a>
              </li>
              <li>
                <a
                  className="text-on-surface/70 hover:text-primary hover:underline transition-all"
                  href="#"
                >
                  Contact Support
                </a>
              </li>
              <li>
                <a
                  className="text-on-surface/70 hover:text-primary hover:underline transition-all"
                  href="#"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <a
                  className="text-on-surface/70 hover:text-primary hover:underline transition-all"
                  href="#"
                >
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h5 className="text-xs font-bold text-primary uppercase tracking-widest mb-6">
              Newsletter
            </h5>
            <p className="text-xs text-on-surface-variant font-medium mb-4">
              Stay updated with the latest trial dates.
            </p>
            <div className="flex gap-2">
              <input
                className="bg-white border border-outline px-4 py-2 text-xs focus:ring-1 focus:ring-primary outline-none w-full btn-sharp"
                placeholder="Email address"
                type="email"
              />
              <button className="bg-primary text-white px-4 py-2 text-xs font-bold hover:bg-opacity-90 transition-all btn-sharp">
                Join
              </button>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-8 pt-8 border-t border-outline/20 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-xs font-medium text-on-surface-variant/60 font-inter">
            © 2024 Academic Architect Prep. All rights reserved. Built for Egyptian
            Scholars.
          </p>
          <div className="flex items-center gap-2 px-4 py-2 bg-white/50 border border-outline/30">
            <span className="text-[10px] font-extrabold text-on-surface-variant uppercase tracking-widest">
              Official Partner
            </span>
            <span
              className="material-symbols-outlined text-secondary text-sm"
              data-icon="verified"
            >
              verified
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}
