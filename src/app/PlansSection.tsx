"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type PlansFilter = "est" | "sat" | null;

function filterButtonClass(active: boolean) {
  return active
    ? "bg-white text-primary px-10 py-3.5 font-bold text-sm shadow-sm border border-outline/50 btn-sharp"
    : "text-on-surface-variant px-10 py-3.5 font-bold text-sm hover:text-primary transition-all";
}

export default function PlansSection() {
  const [filter, setFilter] = useState<PlansFilter>(null);

  const showEst = useMemo(() => filter !== "sat", [filter]);
  const showSat = useMemo(() => filter !== "est", [filter]);

  return (
    <section
      id="plans"
      className="py-32 px-8 lg:px-12 max-w-[1440px] mx-auto overflow-hidden scroll-mt-32"
    >
      <div className="flex flex-col md:flex-row justify-between items-end mb-24 gap-12">
        <div className="max-w-2xl">
          <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
            Discovery
          </div>
          <h2 className="font-headline text-5xl lg:text-6xl font-extrabold text-primary mb-8 tracking-tighter">
            Choose Your Path
          </h2>
          <p className="text-on-surface-variant text-xl font-medium opacity-70">
            Bespoke training modules tailored for the Egyptian American Diploma tracks.
          </p>
        </div>
        <div className="flex bg-slate-50 p-2 border border-outline shadow-inner">
          <button
            className={filterButtonClass(filter === "est")}
            type="button"
            onClick={() => setFilter((v) => (v === "est" ? null : "est"))}
          >
            EST Trials
          </button>
          <button
            className={filterButtonClass(filter === "sat")}
            type="button"
            onClick={() => setFilter((v) => (v === "sat" ? null : "sat"))}
          >
            Digital SAT
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {showEst ? (
          <div className="group bg-white border border-outline/60 overflow-hidden flex flex-col transition-all duration-500 hover:shadow-soft-xl hover:border-blue-200 micro-interaction relative">
            <div className="h-56 bg-blue-50 overflow-hidden relative">
              <img
                alt="Math"
                className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-110"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCtF5aqjom0wzHrWwJFSH86vJOguJQq9rMBky4gE27_avqTrxXukAQZdtAfu5gjYo4bolyJRQITlNGq7vGP7tS63dGmMBk2NedkjyCLbZZMyr3EaXQoqRV4o6cm4LYHvirk8B_tOFjQPgvWwQcezW1QPVpQhqQC5gzlUETKlDWyfx8QWuRPyTvepksPjj3xSdbeIo4HrjpW3-uMCMu-UuLGrAlf4DeBcvUhghnK-FiQOGuiRwaVXo0XbveG8UsNLSqihd2yC1uBSn29"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-blue-900/20 to-transparent" />
              <div className="absolute top-6 left-6 bg-primary text-white px-4 py-2 text-xs font-black uppercase tracking-[0.2em] shadow-xl ring-2 ring-white/20 z-20">
                EST 1
              </div>
            </div>
            <div className="p-10 flex flex-col flex-grow">
              <h4 className="text-3xl font-extrabold text-primary mb-4 tracking-tight">
                EST 1 : Math Core
              </h4>
              <p className="text-on-surface-variant leading-relaxed mb-10 font-medium">
                Advanced algebraic concepts and data analysis specifically modeled for the
                EST 1 environment.
              </p>
              <div className="mt-auto">
                <Link
                  href="/subjects/est-1-math-core"
                  className="w-full bg-slate-50 border border-outline py-4 font-bold text-primary group-hover:bg-primary group-hover:text-white transition-all flex items-center justify-center gap-2 rounded-full"
                >
                  View Details
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        {showEst ? (
          <div className="group bg-white border border-outline/60 overflow-hidden flex flex-col transition-all duration-500 hover:shadow-soft-xl hover:border-amber-200 micro-interaction relative">
            <div className="h-56 bg-amber-50 overflow-hidden relative">
              <img
                alt="Literacy"
                className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-110"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAD42vkdJBe5Lv04TV6HRapZKUzmP62kF1U08pW_ji9UqZPxf33dWUJHkcGgSPptV_g6kuRNs5JPS5oTVknD1a9wSN99e7ezrui-BsWidF6XtvEQW1oSWuX5huqqYs775XP4OgqKtzaINTaimlSkSCpkE-rIua8UWZU_AVMwKvUtQ4xI-hmlwbHg-vYmZx-cj3eiDyS-bFrj7-52tRzjgS-HDh9IZ_UmY0jfiWrjPHVRvm7bhS_O2kMl9grtOMgliqF_Dsz0dzgqlUw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-amber-900/20 to-transparent" />
              <div className="absolute top-6 left-6 bg-primary text-white px-4 py-2 text-xs font-black uppercase tracking-[0.2em] shadow-xl ring-2 ring-white/20 z-20">
                EST 1
              </div>
            </div>
            <div className="p-10 flex flex-col flex-grow">
              <h4 className="text-3xl font-extrabold text-primary mb-4 tracking-tight">
                EST 1 : Literacy
              </h4>
              <p className="text-on-surface-variant leading-relaxed mb-10 font-medium">
                Comprehensive reading comprehension and grammar modules designed for EST 1
                mastery.
              </p>
              <div className="mt-auto">
                <Link
                  href="/subjects/est-1-literacy"
                  className="w-full bg-slate-100 border border-outline/70 py-4 font-bold text-primary group-hover:bg-primary group-hover:text-white transition-all flex items-center justify-center gap-2 rounded-full"
                >
                  View Details
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        {showEst ? (
          <div className="group bg-white border border-outline/60 overflow-hidden flex flex-col transition-all duration-500 hover:shadow-soft-xl hover:border-indigo-200 micro-interaction relative">
            <div className="h-56 bg-indigo-50 overflow-hidden relative">
              <img
                alt="Advanced Math"
                className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-110"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuC9HE23_4ZI0lRw5mU88FjIunV4yn-cb8av5_cJOG6-rSWJB_F_Ff7rJS2P3G18XgtpgnCxmCla6_uzVovGoSr0PJQwZrTUnNWNEdRgguo80gKW5E9YC-c9WIWGVcSw8dotBkqIzprNl7SWGBSFjIrHdavgEgaTz5aM8XT9CGRG2Q5w7qmc_lxVrN9Z5OmIzK4odBPi39L52MTiwSX0uLKlbKvuG_PLOC2iyU1G87ZDV9kVSRUPrOXoJrRUywd2hq7VC-rvKWlJ9yLp"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/20 to-transparent" />
              <div className="absolute top-6 left-6 bg-indigo-600 text-white px-4 py-2 text-xs font-black uppercase tracking-[0.2em] shadow-xl ring-2 ring-white/20 z-20">
                EST 2
              </div>
            </div>
            <div className="p-10 flex flex-col flex-grow">
              <h4 className="text-3xl font-extrabold text-primary mb-4 tracking-tight">
                EST 2 : Math Level 1
              </h4>
              <p className="text-on-surface-variant leading-relaxed mb-10 font-medium">
                Specialized modules covering trigonometry, functions, and advanced geometric
                properties.
              </p>
              <div className="mt-auto">
                <Link
                  href="/subjects/est-2-math-level-1"
                  className="w-full bg-slate-100 border border-outline/70 py-4 font-bold text-primary group-hover:bg-primary group-hover:text-white transition-all flex items-center justify-center gap-2 rounded-full"
                >
                  View Details
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        {showEst ? (
          <div className="group bg-white border border-outline/60 overflow-hidden flex flex-col transition-all duration-500 hover:shadow-soft-xl hover:border-emerald-200 micro-interaction relative">
            <div className="h-56 bg-emerald-50 overflow-hidden relative">
              <img
                alt="Biology"
                className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-110"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBjqP3W8iXFls4wSg3dCfiLDzKLWJH8mn2NcYblwOgnW6h1zkXkGVz72Gh4rVjGCPTWmG5cODaOU3rOxtTNcPaIfsEWdiRukpsctBQcuHT6pd7wWi4nz_QaskiWkypcy9ub_vzt9S2GlquYbeVSzjR_aKqlFn9MCBop5iyTVAZYAN_6FQ0TaQn45vvPM3CfCazZcMLGj3KefDyjLBpLI-_xgpKXrXR5wHHUeiB41HsNKi1RVevGNV6jzAOk35iRvncZwNK-sqhaLIHy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/20 to-transparent" />
              <div className="absolute top-6 left-6 bg-emerald-600 text-white px-4 py-2 text-xs font-black uppercase tracking-[0.2em] shadow-xl ring-2 ring-white/20 z-20">
                EST 2
              </div>
            </div>
            <div className="p-10 flex flex-col flex-grow">
              <h4 className="text-3xl font-extrabold text-primary mb-4 tracking-tight">
                EST 2 : Biology Specialist
              </h4>
              <p className="text-on-surface-variant leading-relaxed mb-10 font-medium">
                In-depth molecular biology, genetics, and ecology trials designed by subject
                experts.
              </p>
              <div className="mt-auto">
                <Link
                  href="/subjects/est-2-biology-specialist"
                  className="w-full bg-slate-100 border border-outline/70 py-4 font-bold text-primary group-hover:bg-primary group-hover:text-white transition-all flex items-center justify-center gap-2 rounded-full"
                >
                  View Details
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        {showSat ? (
          <div className="group bg-white border border-outline/60 overflow-hidden flex flex-col transition-all duration-500 hover:shadow-soft-xl hover:border-blue-300 micro-interaction relative">
            <div className="h-56 bg-blue-50 overflow-hidden relative">
              <img
                alt="SAT R&W"
                className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-110"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAGU0b-ZHU9Nwb9-DVVrSFf7s8j9b5KWACdGYdq31w37pzYZLu4FYfeaJzJnKbHwYYVwkyaUwpyCLdoSMpmhTvPQyHywvSxHcH1TeMy_AcJcZ7PIP9ESqIbrS6xn8PGliso7wEIQtug3wh7vHb7Ok2L2QZUb_8tzm9wHnVMlrQsJWsA_NoTC-RgnRJRWqn4jZKibja3TCthou6xqH6v_1BmiCSfP5w7nFHqvcd2_lc2Nt5bnaQO5N49R2JAH6JR04A3C7cnmivQ5zuq"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-blue-900/20 to-transparent" />
              <div className="absolute top-6 left-6 bg-blue-500 text-white px-4 py-2 text-xs font-black uppercase tracking-[0.2em] shadow-xl ring-2 ring-white/20 z-20">
                DIGITAL SAT
              </div>
            </div>
            <div className="p-10 flex flex-col flex-grow">
              <h4 className="text-3xl font-extrabold text-primary mb-4 tracking-tight">
                SAT Literacy
              </h4>
              <p className="text-on-surface-variant leading-relaxed mb-10 font-medium">
                Master the new Digital SAT Reading and Writing structure with our adaptive
                testing engine.
              </p>
              <div className="mt-auto">
                <Link
                  href="/subjects/sat-literacy"
                  className="w-full bg-slate-100 border border-outline/70 py-4 font-bold text-primary group-hover:bg-primary group-hover:text-white transition-all flex items-center justify-center gap-2 rounded-full"
                >
                  View Details
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        {showSat ? (
          <div className="group bg-white border border-outline/60 overflow-hidden flex flex-col transition-all duration-500 hover:shadow-soft-xl hover:border-blue-200 micro-interaction relative">
            <div className="h-56 bg-blue-50 overflow-hidden relative">
              <img
                alt="SAT Math"
                className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-110"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBFZwjxf0x5qIUWCFUqn3Qu5Bb_aIDYYZt3JMqA2tZOd6iLfn9GBjdkHMQvlffBxdi-V68PU0teEY8V8gZpgWa2ladIMDFaMWp5hQNSSR1UcA3xtWmscV44pc42OqJpoTtbXMJ2j5Uh2sCjfcRZE97_BEqV8zbRXiSWaKhwxyqXDAxZHjxgU6yRAnZrH5jxlzhSZVppkGu9E_stLmxLWTXrbTNWU907OAhNwaeFMMeEQK7nKLTTSdfApLH7bRy1hxSSFYn5KauhayfA"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-blue-900/20 to-transparent" />
              <div className="absolute top-6 left-6 bg-blue-600 text-white px-4 py-2 text-xs font-black uppercase tracking-[0.2em] shadow-xl ring-2 ring-white/20 z-20">
                DIGITAL SAT
              </div>
            </div>
            <div className="p-10 flex flex-col flex-grow">
              <h4 className="text-3xl font-extrabold text-primary mb-4 tracking-tight">
                SAT Digital Math
              </h4>
              <p className="text-on-surface-variant leading-relaxed mb-10 font-medium">
                Master the Desmos calculator and specific digital interface tools for SAT
                success.
              </p>
              <div className="mt-auto">
                <Link
                  href="/subjects/sat-digital-math"
                  className="w-full bg-slate-100 border border-outline/70 py-4 font-bold text-primary group-hover:bg-primary group-hover:text-white transition-all flex items-center justify-center gap-2 rounded-full"
                >
                  View Details
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
