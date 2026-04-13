"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Subject = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  track: string | null;
};

type Offer = {
  id: string;
  subject_id: string;
  label: string;
  expires_at: string;
  price_cents: number;
  currency: string;
};

type Asset = {
  id: string;
  subject_id: string;
  url: string | null;
  bucket: string | null;
  storage_path: string | null;
  alt: string | null;
  sort_order: number;
};

type CardTheme = {
  imageBg: string;
  imageGradient: string;
  tagBg: string;
  hoverBorder: string;
  buttonBase: string;
};

const cardThemes: CardTheme[] = [
  {
    imageBg: "bg-blue-50",
    imageGradient: "from-blue-900/20",
    tagBg: "bg-primary",
    hoverBorder: "hover:border-blue-400 hover:ring-4 hover:ring-blue-50 focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-50",
    buttonBase: "bg-slate-50 border-outline",
  },
  {
    imageBg: "bg-amber-50",
    imageGradient: "from-amber-900/20",
    tagBg: "bg-primary",
    hoverBorder: "hover:border-amber-400 hover:ring-4 hover:ring-amber-50 focus-within:border-amber-400 focus-within:ring-4 focus-within:ring-amber-50",
    buttonBase: "bg-slate-100 border-outline/70",
  },
  {
    imageBg: "bg-indigo-50",
    imageGradient: "from-indigo-900/20",
    tagBg: "bg-indigo-600",
    hoverBorder: "hover:border-indigo-400 hover:ring-4 hover:ring-indigo-50 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-50",
    buttonBase: "bg-slate-100 border-outline/70",
  },
  {
    imageBg: "bg-emerald-50",
    imageGradient: "from-emerald-900/20",
    tagBg: "bg-emerald-600",
    hoverBorder: "hover:border-emerald-400 hover:ring-4 hover:ring-emerald-50 focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-50",
    buttonBase: "bg-slate-100 border-outline/70",
  },
  {
    imageBg: "bg-sky-50",
    imageGradient: "from-sky-900/20",
    tagBg: "bg-blue-500",
    hoverBorder: "hover:border-sky-400 hover:ring-4 hover:ring-sky-50 focus-within:border-sky-400 focus-within:ring-4 focus-within:ring-sky-50",
    buttonBase: "bg-slate-100 border-outline/70",
  },
  {
    imageBg: "bg-rose-50",
    imageGradient: "from-rose-900/20",
    tagBg: "bg-rose-600",
    hoverBorder: "hover:border-rose-400 hover:ring-4 hover:ring-rose-50 focus-within:border-rose-400 focus-within:ring-4 focus-within:ring-rose-50",
    buttonBase: "bg-slate-100 border-outline/70",
  },
];

function formatMoney(cents: number, currency: string) {
  const value = cents / 100;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatExpiryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit" }).format(
    date,
  );
}

function resolvePublicAssetUrl(asset: Asset | null) {
  if (!asset) return null;
  const explicit = asset.url?.trim();
  if (explicit) return explicit;
  if (!asset.bucket || !asset.storage_path) return null;
  return supabase.storage.from(asset.bucket).getPublicUrl(asset.storage_path).data.publicUrl;
}

const hardcodedImageUrls: Record<string, string> = {
  "math est 1": "https://lh3.googleusercontent.com/aida-public/AB6AXuCtNnbsUAALfLVrxcs1tSN25Qzew2JMnmNq-VMBNf11Og6IGwh2AvRto2NAeuSSogdu_1C8SPKHEkY9o9bWXGDRNyVADFW5GQR9LlqD4nsxaxlLSciLUOBL3bHfnonP6-awTYmn9NJmdh2qhM7DfWSmdcTrT_ZC5tYBeW9fva2SO-XWVRx29XmOLh8wiZBmPKQdf_snUtZWPKoioJmvKzVS06EOqZFPjIsGl0gmqZD-ZE2W665zBl3HeUuqQOcttIi75a6SMLWPXzXd",
  "est 1 : literacy": "https://lh3.googleusercontent.com/aida-public/AB6AXuAD42vkdJBe5Lv04TV6HRapZKUzmP62kF1U08pW_ji9UqZPxf33dWUJHkcGgSPptV_g6kuRNs5JPS5oTVknD1a9wSN99e7ezrui-BsWidF6XtvEQW1oSWuX5huqqYs775XP4OgqKtzaINTaimlSkSCpkE-rIua8UWZU_AVMwKvUtQ4xI-hmlwbHg-vYmZx-cj3eiDyS-bFrj7-52tRzjgS-HDh9IZ_UmY0jfiWrjPHVRvm7bhS_O2kMl9grtOMgliqF_Dsz0dzgqlUw",
  "est 2 : math level 1": "https://lh3.googleusercontent.com/aida-public/AB6AXuBhkHRXJXYZui9x0jYc1lW1QohndBhaomlolRC5L0I6r-mP8ASJY5EFvKF-6zGgxgxURvZnB-aX79cooMh7zJuv_23-NWX2JyZypik9EMhfDbYhb9rjGczpVQWEUHrEPMcvA6iRohYDhUxckwRejG0jCjYc2_H9cnnAtjop-veJf7Z9zTUGvvDeCbrG8PmsR16qaxzqE5sfONE6qzMP8PqXFLYu8CTvebQ6zaCVq6YeB8Sx-bmrALNYIIFNnP5sJirYTMcMZuWT1bGF",
  "biology est 2": "https://lh3.googleusercontent.com/aida-public/AB6AXuCiCPMDNg2SABiwtBz_x0WE8dI-RWI72uctsbRs-8VinPLQJhOmR-RAaiPS4bSsEjp5jgU0ZmNSf1K9TH-CkCThfC6YfzzVkaOZ55mLlFQvBvZk_CBSfKVggtExdqs5vaIj_VcsQeGa8xthCcd7hF8iF56eLFXwAJnyGIkaBeC0A0eXbJ3X2AX9CrndBWyhax6Z2oHJHQKrDVcG735gyWExuFbuCHG1hG_VXYZ5ziYclGsPeYdW14F2lFHEJvMp_-kKJ9w33lolY3KB",
  "est 2 : biology specialist": "https://lh3.googleusercontent.com/aida-public/AB6AXuCiCPMDNg2SABiwtBz_x0WE8dI-RWI72uctsbRs-8VinPLQJhOmR-RAaiPS4bSsEjp5jgU0ZmNSf1K9TH-CkCThfC6YfzzVkaOZ55mLlFQvBvZk_CBSfKVggtExdqs5vaIj_VcsQeGa8xthCcd7hF8iF56eLFXwAJnyGIkaBeC0A0eXbJ3X2AX9CrndBWyhax6Z2oHJHQKrDVcG735gyWExuFbuCHG1hG_VXYZ5ziYclGsPeYdW14F2lFHEJvMp_-kKJ9w33lolY3KB",
};

export default function PlansSection() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [offersBySubjectId, setOffersBySubjectId] = useState<Record<string, Offer[]>>({});
  const [primaryAssetBySubjectId, setPrimaryAssetBySubjectId] = useState<Record<string, Asset | null>>({});
  const [selectedOfferIdBySubjectId, setSelectedOfferIdBySubjectId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function run() {
      setLoading(true);
      setError(null);

      const { data: subjectsRows, error: subjectsError } = await supabase
        .from("subjects")
        .select("id, slug, title, description, track")
        .order("title", { ascending: true })
        .returns<Subject[]>();

      if (!mounted) return;

      if (subjectsError) {
        setError(subjectsError.message);
        setSubjects([]);
        setOffersBySubjectId({});
        setPrimaryAssetBySubjectId({});
        setSelectedOfferIdBySubjectId({});
        setLoading(false);
        return;
      }

      const rows = subjectsRows ?? [];
      setSubjects(rows);

      const ids = rows.map((s) => s.id);
      if (ids.length === 0) {
        setOffersBySubjectId({});
        setPrimaryAssetBySubjectId({});
        setSelectedOfferIdBySubjectId({});
        setLoading(false);
        return;
      }

      const [{ data: offersRows }, { data: assetsRows }] = await Promise.all([
        supabase
          .from("subject_offers")
          .select("id, subject_id, label, expires_at, price_cents, currency")
          .in("subject_id", ids)
          .order("expires_at", { ascending: true })
          .returns<Offer[]>(),
        supabase
          .from("subject_assets")
          .select("id, subject_id, url, bucket, storage_path, alt, sort_order")
          .in("subject_id", ids)
          .order("sort_order", { ascending: true })
          .returns<Asset[]>(),
      ]);

      if (!mounted) return;

      const nextOffersBySubjectId: Record<string, Offer[]> = {};
      for (const offer of offersRows ?? []) {
        const key = offer.subject_id;
        if (!nextOffersBySubjectId[key]) nextOffersBySubjectId[key] = [];
        nextOffersBySubjectId[key].push(offer);
      }
      setOffersBySubjectId(nextOffersBySubjectId);

      const nextPrimaryAssetBySubjectId: Record<string, Asset | null> = {};
      for (const asset of assetsRows ?? []) {
        if (nextPrimaryAssetBySubjectId[asset.subject_id]) continue;
        nextPrimaryAssetBySubjectId[asset.subject_id] = asset;
      }
      for (const id of ids) {
        if (!(id in nextPrimaryAssetBySubjectId)) nextPrimaryAssetBySubjectId[id] = null;
      }
      setPrimaryAssetBySubjectId(nextPrimaryAssetBySubjectId);

      setSelectedOfferIdBySubjectId((prev) => {
        const next = { ...prev };
        for (const subject of rows) {
          const offers = nextOffersBySubjectId[subject.id] ?? [];
          if (!next[subject.id] && offers[0]?.id) next[subject.id] = offers[0].id;
        }
        return next;
      });

      setLoading(false);
    }

    run();

    return () => {
      mounted = false;
    };
  }, []);

  const orderedSubjects = useMemo(() => {
    return subjects;
  }, [subjects]);

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
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {loading ? (
          <>
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-white border border-outline/60 overflow-hidden flex flex-col shadow-premium"
              >
                <div className="h-52 bg-surface-variant animate-pulse" />
                <div className="p-8 space-y-4">
                  <div className="h-6 bg-surface-variant animate-pulse w-2/3" />
                  <div className="h-4 bg-surface-variant animate-pulse w-full" />
                  <div className="h-4 bg-surface-variant animate-pulse w-5/6" />
                  <div className="h-12 bg-surface-variant animate-pulse w-full mt-8" />
                </div>
              </div>
            ))}
          </>
        ) : error ? (
          <div className="col-span-full bg-white border border-outline/60 p-10 shadow-premium">
            <div className="text-xl font-extrabold text-primary">Could not load packages</div>
            <div className="text-on-surface-variant mt-2">{error}</div>
          </div>
        ) : orderedSubjects.length === 0 ? (
          <div className="col-span-full bg-white border border-outline/60 p-10 shadow-premium">
            <div className="text-xl font-extrabold text-primary">No packages available</div>
            <div className="text-on-surface-variant mt-2">Please check back soon.</div>
          </div>
        ) : (
          orderedSubjects.map((subject, idx) => {
            const offers = offersBySubjectId[subject.id] ?? [];
            const selectedOfferId = selectedOfferIdBySubjectId[subject.id] ?? offers[0]?.id ?? "";
            const selectedOffer = offers.find((o) => o.id === selectedOfferId) ?? offers[0] ?? null;
            const asset = primaryAssetBySubjectId[subject.id];
            const dbAssetUrl = resolvePublicAssetUrl(asset);
            const assetUrl = hardcodedImageUrls[subject.title.trim().toLowerCase()] || dbAssetUrl;
            const theme = cardThemes[idx % cardThemes.length];

            return (
              <div
                key={subject.id}
                className={[
                  "group bg-white border-2 border-outline/40 rounded-2xl overflow-hidden flex flex-col transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 relative",
                  theme.hoverBorder,
                ].join(" ")}
              >
                <div className={["h-56 overflow-hidden relative", theme.imageBg].join(" ")}>
                  {assetUrl ? (
                    <img
                      alt={asset?.alt ?? subject.title}
                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-110"
                      src={assetUrl}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary to-secondary" />
                  )}
                  <div
                    className={[
                      "absolute inset-0 bg-gradient-to-t to-transparent",
                      theme.imageGradient,
                    ].join(" ")}
                  />
                  <div
                    className={[
                      "absolute top-6 left-6 text-white px-4 py-2 text-xs font-black uppercase tracking-[0.2em] shadow-xl ring-2 ring-white/20 z-20",
                      theme.tagBg,
                    ].join(" ")}
                  >
                    {subject.track ?? "Subject"}
                  </div>
                </div>

                <div className="p-10 flex flex-col flex-grow">
                  <h4 className="text-3xl font-extrabold text-primary mb-4 tracking-tight">
                    {subject.title}
                  </h4>
                  <p className="text-on-surface-variant leading-relaxed mb-8 font-medium">
                    {subject.description ??
                      "High-fidelity mock exams, timed sessions, and detailed review — built for real test pressure."}
                  </p>

                  <div className="mt-auto space-y-5">
                    <div className="space-y-2">
                      <div className="text-[10px] uppercase tracking-[0.2em] font-black text-on-surface-variant">
                        Choose access
                      </div>
                      <select
                        className="w-full bg-slate-50 border-2 border-outline/50 rounded-lg px-4 py-3 font-bold text-primary focus:border-secondary focus:ring-4 focus:ring-secondary/10 outline-none transition-all cursor-pointer"
                        value={selectedOfferId}
                        onChange={(e) =>
                          setSelectedOfferIdBySubjectId((prev) => ({
                            ...prev,
                            [subject.id]: e.target.value,
                          }))
                        }
                        disabled={offers.length === 0}
                      >
                        {offers.length === 0 ? (
                          <option value="">No offers available</option>
                        ) : (
                          offers.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.label}
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    <div className="flex items-end justify-between gap-6">
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-[0.2em] font-black text-on-surface-variant">
                          Price
                        </div>
                        <div className="text-3xl font-extrabold text-primary tracking-tight">
                          {selectedOffer ? formatMoney(selectedOffer.price_cents, selectedOffer.currency) : "—"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-[0.2em] font-black text-on-surface-variant">
                          Expires
                        </div>
                        <div className="text-sm font-bold text-primary">
                          {selectedOffer ? formatExpiryDate(selectedOffer.expires_at) : "—"}
                        </div>
                      </div>
                    </div>

                    <Link
                      href={`/subjects/${subject.slug}`}
                      className={[
                        "w-full border-2 py-4 font-bold text-primary transition-all flex items-center justify-center gap-2 rounded-xl hover:bg-primary hover:text-white hover:border-primary active:scale-[0.98]",
                        theme.buttonBase,
                      ].join(" ")}
                    >
                      View Details
                      <span className="material-symbols-outlined text-lg">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
