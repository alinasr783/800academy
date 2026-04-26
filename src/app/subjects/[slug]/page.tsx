import SiteHeader from "@/components/SiteHeader";
import { supabase } from "@/lib/supabaseClient";
import SubjectOfferActions from "./SubjectOfferActions";
import SubjectCarousel from "./SubjectCarousel";
import Link from "next/link";
import SubjectScrollToExams from "./SubjectScrollToExams";
import BackButton from "@/components/BackButton";
import Breadcrumbs from "@/components/Breadcrumbs";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

type Subject = {
  id: string;
  slug: string;
  title: string;
  marketing_title: string | null;
  description: string | null;
  track: string | null;
};

type Offer = {
  id: string;
  label: string;
  expires_at: string;
  price_cents: number;
  original_price_cents: number | null;
  currency: string;
};

type Exam = {
  id: string;
  title: string;
  exam_number: number;
  is_free: boolean | null;
};

export default async function SubjectPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const focus = sp.focus;
  const hideOffers = sp.hideOffers;
  const shouldScroll = focus === "exams";
  const shouldHideOffers = hideOffers === "1" || hideOffers === "true";

  const { data: subject, error: subjectError } = await supabase
    .from("subjects")
    .select("id, slug, title, marketing_title, description, track")
    .eq("slug", slug)
    .single<Subject>();

  if (subjectError || !subject) {
    return (
      <>
        <SiteHeader />
        <main className="pt-24">
          <section className="max-w-[1440px] mx-auto px-8 lg:px-12 py-20">
            <h1 className="font-headline text-4xl font-extrabold text-primary">
              Subject not found
            </h1>
            <p className="text-on-surface-variant mt-4">This subject does not exist.</p>
          </section>
        </main>
      </>
    );
  }

  const { data: offers } = await supabase
    .from("subject_offers")
    .select("id, label, expires_at, price_cents, original_price_cents, currency")
    .eq("subject_id", subject.id)
    .order("expires_at", { ascending: true })
    .returns<Offer[]>();

  const { data: exams } = await supabase
    .from("exams")
    .select("id, title, exam_number, is_free")
    .eq("subject_id", subject.id)
    .order("exam_number", { ascending: true })
    .returns<Exam[]>();

  const { data: promoAssets } = await supabase
    .from("subject_assets")
    .select("id, url, bucket, storage_path, alt, sort_order")
    .eq("subject_id", subject.id)
    .order("sort_order", { ascending: true })
    .limit(6)
    .returns<
      {
        id: string;
        url: string | null;
        bucket: string | null;
        storage_path: string | null;
        alt: string | null;
        sort_order: number;
      }[]
    >();

  return (
    <>
      <SiteHeader />
      <main className="pt-24">
        <SubjectScrollToExams enabled={shouldScroll} />
        <div className="max-w-[1440px] mx-auto px-8 lg:px-12 pt-8">
          <div className="flex items-center justify-between gap-6">
            <BackButton fallbackHref="/" />
            <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: subject.title }]} />
          </div>
        </div>
        <section className="relative max-w-[1440px] mx-auto overflow-hidden mt-6 mb-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start px-8 lg:px-12">
            <div className="lg:col-span-7 py-12 lg:py-20 relative z-10 flex flex-col justify-center">
              <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
                {subject.track ?? "Subject"}
              </div>
              <h1 className="font-headline text-2xl sm:text-4xl lg:text-5xl xl:text-6xl font-extrabold text-primary leading-[1.1] mb-4 sm:mb-6 tracking-tight">
                {subject.marketing_title || subject.title}
              </h1>
              <p className="text-on-surface-variant text-sm sm:text-base lg:text-lg max-w-2xl leading-[1.7] font-medium opacity-90">
                {subject.description ??
                  "A premium exam-prep track with high-fidelity practice and structured progression."}
              </p>

              {shouldHideOffers ? null : (
                <div className="mt-10">
                  <SubjectOfferActions subjectId={subject.id} offers={offers ?? []} examsCount={exams?.length ?? 0} />
                </div>
              )}
            </div>

            <div className="lg:col-span-5 relative py-8 lg:py-20">
              {promoAssets && promoAssets.length > 0 ? (
                <SubjectCarousel assets={promoAssets} title={subject.title} />
              ) : null}
            </div>
          </div>
        </section>

        {/* What You Get — Benefits Section */}
        {!shouldHideOffers && (
          <section className="max-w-[1440px] mx-auto px-6 sm:px-8 lg:px-12 py-12 sm:py-16">
            <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-3">
              Included
            </div>
            <h2 className="font-headline text-2xl sm:text-3xl font-extrabold text-primary tracking-tight mb-8">
              What You Get
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {[
                { icon: "assignment", label: "20+ Mock Exams", desc: "Full-length practice tests" },
                { icon: "help", label: "1,000+ Questions", desc: "Comprehensive question bank" },
                { icon: "menu_book", label: "Detailed Explanations", desc: "Step-by-step for every question" },
                { icon: "speed", label: "Score out of 800", desc: "Real EST scoring algorithm" },
                { icon: "timer", label: "Timed Sessions", desc: "Official time limits enforced" },
                { icon: "desktop_windows", label: "EST Simulation", desc: "1:1 real exam interface" },
                { icon: "trending_up", label: "Progress Tracking", desc: "Watch your score improve" },
                { icon: "auto_awesome", label: "And Much More", desc: "Explore all features now" },
              ].map((item) => (
                <div
                  key={item.icon}
                  className="bg-white border border-outline/40 rounded-2xl p-4 sm:p-5 flex flex-col gap-3 hover:border-primary/30 hover:shadow-soft-md transition-all"
                >
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
                  </div>
                  <div>
                    <div className="text-sm font-black text-primary">{item.label}</div>
                    <div className="text-[11px] text-on-surface-variant/70 font-medium mt-0.5 leading-snug">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section id="exams-library" className="py-12 sm:py-24 px-6 sm:px-8 lg:px-12 max-w-[1440px] mx-auto">
          <div className="flex items-end justify-between gap-10 mb-12">
            <div>
              <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
                Content
              </div>
              <h2 className="font-headline text-2xl sm:text-3xl lg:text-5xl font-extrabold text-primary tracking-tighter">
                Exams Library
              </h2>
            </div>
            <div className="text-xs uppercase tracking-widest text-on-surface-variant font-bold">
              20 Exams Target
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {(exams ?? []).map((exam) => (
              <div
                key={exam.id}
                className="bg-white rounded-3xl border-2 border-slate-200 overflow-hidden flex flex-col transition-all duration-500 hover:shadow-soft-2xl hover:-translate-y-1 hover:border-blue-300 micro-interaction"
              >
                <div className="p-6 sm:p-8 border-b border-slate-200">
                  <div className="flex items-start justify-between gap-4">
                    <div className="text-[10px] uppercase tracking-[0.2em] font-black text-on-surface-variant bg-surface-variant px-3 py-1 rounded-full">
                      Exam {exam.exam_number}
                    </div>
                    <div
                      className={
                        exam.is_free
                          ? "px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black tracking-[0.2em] uppercase"
                          : "px-3 py-1 rounded-full bg-slate-100 text-on-surface-variant text-[10px] font-black tracking-[0.2em] uppercase"
                      }
                    >
                      {exam.is_free ? "Free" : "Paid"}
                    </div>
                  </div>
                  <div className="text-lg sm:text-2xl font-extrabold text-primary mt-5 tracking-tight">
                    {exam.title}
                  </div>
                </div>
                <div className="p-6 flex flex-col gap-4 mt-auto">
                  <Link
                    href={`/subjects/${subject.slug}/exams/${exam.exam_number}`}
                    className="w-full bg-white border-2 border-outline/40 py-4 font-bold text-primary hover:border-primary hover:bg-primary hover:text-white transition-all duration-300 flex items-center justify-center gap-2 rounded-full"
                  >
                    Open Exam
                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
