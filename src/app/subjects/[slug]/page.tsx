import SiteHeader from "@/components/SiteHeader";
import { supabase } from "@/lib/supabaseClient";
import SubjectOfferActions from "./SubjectOfferActions";
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
  description: string | null;
  track: string | null;
};

type Offer = {
  id: string;
  label: string;
  expires_at: string;
  price_cents: number;
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
    .select("id, slug, title, description, track")
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
    .select("id, label, expires_at, price_cents, currency")
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
        <section className="relative max-w-[1440px] mx-auto overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 items-start">
            <div className="lg:col-span-7 px-8 lg:px-12 py-20 lg:py-24 relative z-10">
              <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
                {subject.track ?? "Subject"}
              </div>
              <h1 className="font-headline text-5xl lg:text-6xl font-extrabold text-primary leading-[1.05] mb-8 tracking-tight">
                {subject.title}
              </h1>
              <p className="text-on-surface-variant text-lg max-w-2xl leading-[1.7] font-medium opacity-80">
                {subject.description ??
                  "A premium exam-prep track with high-fidelity practice and structured progression."}
              </p>

              <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl">
                <div className="bg-surface-variant border border-outline/40 p-6">
                  <div className="text-xs uppercase tracking-widest text-on-surface-variant font-bold">
                    Exams
                  </div>
                  <div className="text-3xl font-extrabold text-primary mt-2">
                    {exams?.length ?? 0}
                  </div>
                </div>
                <div className="bg-surface-variant border border-outline/40 p-6">
                  <div className="text-xs uppercase tracking-widest text-on-surface-variant font-bold">
                    Format
                  </div>
                  <div className="text-3xl font-extrabold text-primary mt-2">Mock</div>
                </div>
                <div className="bg-surface-variant border border-outline/40 p-6">
                  <div className="text-xs uppercase tracking-widest text-on-surface-variant font-bold">
                    Access
                  </div>
                  <div className="text-3xl font-extrabold text-primary mt-2">Timed</div>
                </div>
              </div>
            </div>

            {shouldHideOffers ? null : (
              <div className="lg:col-span-5 px-8 lg:px-12 py-20 lg:py-24">
                <SubjectOfferActions subjectId={subject.id} offers={offers ?? []} />
              </div>
            )}
          </div>
        </section>

        <section id="exams-library" className="py-24 px-8 lg:px-12 max-w-[1440px] mx-auto">
          <div className="flex items-end justify-between gap-10 mb-12">
            <div>
              <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
                Content
              </div>
              <h2 className="font-headline text-4xl lg:text-5xl font-extrabold text-primary tracking-tighter">
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
                className="bg-white border border-outline/60 overflow-hidden flex flex-col transition-all duration-500 hover:shadow-soft-xl hover:border-blue-200 micro-interaction"
              >
                <div className="p-8 border-b border-outline/40">
                  <div className="flex items-start justify-between gap-4">
                    <div className="text-[10px] uppercase tracking-[0.2em] font-black text-on-surface-variant">
                      Exam {exam.exam_number}
                    </div>
                    <div
                      className={
                        exam.is_free
                          ? "px-3 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black tracking-[0.2em] uppercase"
                          : "px-3 py-1 bg-slate-100 text-on-surface-variant text-[10px] font-black tracking-[0.2em] uppercase"
                      }
                    >
                      {exam.is_free ? "Free" : "Paid"}
                    </div>
                  </div>
                  <div className="text-2xl font-extrabold text-primary mt-3 tracking-tight">
                    {exam.title}
                  </div>
                </div>
                <div className="p-8 flex flex-col gap-4">
                  <Link
                    href={`/subjects/${subject.slug}/exams/${exam.exam_number}`}
                    className="w-full bg-slate-100 border border-outline/70 py-4 font-bold text-primary hover:bg-primary hover:text-white transition-all flex items-center justify-center gap-2 rounded-full"
                  >
                    Open exam
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
