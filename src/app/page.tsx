import PlansSection from "./PlansSection";
import SiteHeader from "@/components/SiteHeader";
import Image from "next/image";
import logo from "./logo.png";

export default function Home() {
  return (
    <>
      <SiteHeader active="home" />
      <main className="pt-24">
        <section
          id="home"
          className="relative max-w-[1440px] mx-auto overflow-hidden scroll-mt-32"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 items-center">
            <div className="lg:col-span-6 px-8 lg:px-12 py-20 lg:py-32 relative z-10">
              <h1 className="font-headline text-6xl lg:text-[5.5rem] font-extrabold text-primary leading-[1.05] mb-10 tracking-tight">
                Master the EST with <span className="gradient-text">Precision</span>.
              </h1>
              <p className="text-on-surface-variant text-lg lg:text-xl max-w-xl mb-12 leading-[1.6] font-medium opacity-80">
                Experience the most faithful digital recreation of official Egyptian
                Scholastic Test environments. Built for the modern student.
              </p>
              <div className="flex flex-col sm:flex-row gap-5">
                <button className="bg-secondary text-white px-10 py-5 font-bold text-lg transition-all active:scale-[0.98] btn-sharp">
                  Explore Packages
                </button>
                <button className="bg-white text-primary border border-outline px-10 py-5 font-bold text-lg hover:bg-surface-variant transition-all flex items-center gap-2 group btn-sharp">
                  Explore Mocks
                  <span className="material-symbols-outlined text-xl group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </button>
              </div>
              <div className="mt-16 flex items-center gap-3">
                <span
                  className="material-symbols-outlined text-secondary font-variation-settings-fill-1"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  verified
                </span>
                <p className="text-sm font-bold text-on-surface uppercase tracking-widest">
                  Quality Guaranteed • Expertly Crafted Questions
                </p>
              </div>
            </div>
            <div className="lg:col-span-6 h-full relative">
              <img
                alt="Focused 18-year-old male student studying"
                className="w-full h-full object-cover min-h-[600px] block"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuB9aI_JT1Wtrztthvf3pEUcIC1cro79Oce2-b0bTnNfwOAlAx6x6OsSYWANEPNEi6_24dXxEs_HC7Rhq4WJ1SfzdDQBNaKUoBhIAxehtepUJZp3puqtCJSb68JeJ4mwq1u3nop8UuvumMRXBJvhtyRZplisUkQF4teaUcEw6BXaALEDOCO_3pTHo6CxCyTfN-mKzwhMciFiuNBPvy8G3G15ZGL25If1hQHccb-cjNxNIXCK6vpSENm82_lkZhQaoLH2VrJnk1T56vd6"
              />
              <div className="absolute top-10 right-10 bg-white/90 backdrop-blur-xl p-6 shadow-soft-xl border border-white/50 flex flex-col items-center">
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className="material-symbols-outlined text-rose-500 font-variation-settings-fill-1 text-2xl"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    timer
                  </span>
                  <span className="font-headline font-bold text-2xl text-primary tracking-tighter">
                    24:59
                  </span>
                </div>
                <div className="text-[10px] uppercase font-extrabold text-on-surface-variant tracking-[0.2em]">
                  Remaining
                </div>
              </div>
              <div className="absolute bottom-10 left-10 bg-primary/95 backdrop-blur-xl p-5 shadow-soft-xl border border-white/10 flex items-center gap-4">
                <div className="w-12 h-12 bg-secondary flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-2xl">
                    insights
                  </span>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                    Interface
                  </div>
                  <div className="text-white font-bold text-xl">1:1 Fidelity</div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <PlansSection />
        <section
          id="benefits"
          className="bg-slate-50 py-32 border-y border-outline/30 relative scroll-mt-32"
        >
          <div className="max-w-[1440px] mx-auto px-8 lg:px-12">
            <div className="max-w-2xl mb-20">
              <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
                Excellence
              </div>
              <h2 className="font-headline text-5xl lg:text-6xl font-extrabold text-primary tracking-tighter">
                Why 800 Academy
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="bg-white p-10 border border-outline shadow-premium hover:shadow-soft-xl transition-all group">
                <div className="w-16 h-16 bg-blue-50 flex items-center justify-center mb-10 group-hover:scale-110 group-hover:bg-blue-600 transition-all">
                  <span
                    className="material-symbols-outlined text-secondary text-3xl group-hover:text-white transition-colors"
                    data-icon="schedule"
                  >
                    schedule
                  </span>
                </div>
                <h3 className="font-headline text-2xl font-extrabold text-primary mb-5 tracking-tight">
                  Time Pressure Logic
                </h3>
                <p className="text-on-surface-variant leading-relaxed font-medium">
                  Native countdown modules that perfectly replicate the mental strain and
                  pace of the official testing center.
                </p>
              </div>
              <div className="bg-white p-10 border border-outline shadow-premium hover:shadow-soft-xl transition-all group">
                <div className="w-16 h-16 bg-indigo-50 flex items-center justify-center mb-10 group-hover:scale-110 group-hover:bg-indigo-600 transition-all">
                  <span
                    className="material-symbols-outlined text-indigo-600 text-3xl group-hover:text-white transition-colors"
                    data-icon="fact_check"
                  >
                    fact_check
                  </span>
                </div>
                <h3 className="font-headline text-2xl font-extrabold text-primary mb-5 tracking-tight">
                  Curated Question Banks
                </h3>
                <p className="text-on-surface-variant leading-relaxed font-medium">
                  Forget generic questions. Access a proprietary database vetted by Diploma
                  veterans specifically for 2026 trial patterns.
                </p>
              </div>
              <div className="bg-white p-10 border border-outline shadow-premium hover:shadow-soft-xl transition-all group">
                <div className="w-16 h-16 bg-emerald-50 flex items-center justify-center mb-10 group-hover:scale-110 group-hover:bg-emerald-600 transition-all">
                  <span
                    className="material-symbols-outlined text-emerald-600 text-3xl group-hover:text-white transition-colors"
                    data-icon="bolt"
                  >
                    bolt
                  </span>
                </div>
                <h3 className="font-headline text-2xl font-extrabold text-primary mb-5 tracking-tight">
                  Neural Feedback
                </h3>
                <p className="text-on-surface-variant leading-relaxed font-medium">
                  Proprietary scoring engine that predicts your official band score with high
                  precision using machine learning.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section
          id="contact"
          className="py-40 px-8 relative overflow-hidden bg-[#0A192F] section-curve scroll-mt-32"
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
              <button className="bg-secondary text-white px-14 py-6 font-bold text-xl hover:shadow-2xl hover:shadow-blue-500/40 hover:-translate-y-1 transition-all btn-sharp">
                Create Free Account
              </button>
              <button className="bg-white/5 text-white backdrop-blur-md border border-white/10 px-14 py-6 font-bold text-xl hover:bg-white/10 transition-all btn-sharp">
                Talk to a Mentor
              </button>
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
