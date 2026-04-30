import { supabase } from "@/lib/supabaseClient";
import ExamClient from "./ExamClient";

type PageProps = {
  params: Promise<{ slug: string; n: string }>;
};

type ExamRow = {
  id: string;
  title: string;
  duration_seconds: number;
  pass_percent: number;
  min_score: number;
  total_points: number;
  is_free: boolean;
  max_attempts: number | null;
};

type ExamNavRow = {
  id: string;
  exam_number: number;
  title: string;
  is_free: boolean;
  pass_percent: number;
  min_score: number;
};

type OfferRow = {
  id: string;
  label: string;
  expires_at: string;
  price_cents: number;
  currency: string;
};

export default async function ExamPage({ params }: PageProps) {
  const { slug, n } = await params;
  const examNumber = Number(n);
  if (!Number.isFinite(examNumber) || examNumber < 1) {
    return (
      <main>
          <section className="max-w-[1440px] mx-auto px-8 lg:px-12 py-20">
            <h1 className="font-headline text-4xl font-extrabold text-primary">
              Invalid exam
            </h1>
          </section>
        </main>
    );
  }

  const { data: subject } = await supabase
    .from("subjects")
    .select("id, slug, title, track")
    .eq("slug", slug)
    .single<{ id: string; slug: string; title: string; track: string | null }>();

  if (!subject) {
    return (
      <main>
          <section className="max-w-[1440px] mx-auto px-8 lg:px-12 py-20">
            <h1 className="font-headline text-4xl font-extrabold text-primary">
              Subject not found
            </h1>
          </section>
        </main>
    );
  }

  const { data: exam } = await supabase
    .from("exams")
    .select(
      "id, title, duration_seconds, pass_percent, min_score, total_points, is_free, max_attempts",
    )
    .eq("subject_id", subject.id)
    .eq("exam_number", examNumber)
    .single<ExamRow>();

  if (!exam) {
    return (
      <main>
          <section className="max-w-[1440px] mx-auto px-8 lg:px-12 py-20">
            <h1 className="font-headline text-4xl font-extrabold text-primary">
              Exam not found
            </h1>
          </section>
        </main>
    );
  }

  const { data: allExams } = await supabase
    .from("exams")
    .select("id, exam_number, title, is_free, pass_percent, min_score")
    .eq("subject_id", subject.id)
    .order("exam_number", { ascending: true })
    .returns<ExamNavRow[]>();

  const { data: offers } = await supabase
    .from("subject_offers")
    .select("id, label, expires_at, price_cents, currency")
    .eq("subject_id", subject.id)
    .order("expires_at", { ascending: true })
    .returns<OfferRow[]>();

  return (
    <>
      <main>
        <section className="max-w-[1440px] mx-auto px-3 sm:px-6 md:px-8 lg:px-12 py-6 sm:py-10 md:py-16">
          <ExamClient
            subjectId={subject.id}
            subjectSlug={subject.slug}
            subjectTitle={subject.title}
            subjectTrack={subject.track}
            examNumber={examNumber}
            exam={exam}
            allExams={allExams ?? []}
            offers={offers ?? []}
          />
        </section>
      </main>
    </>
  );
}
