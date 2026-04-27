"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import useSWR from "swr";
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

export default function PlansSection({ showMoreLink = false }: { showMoreLink?: boolean }) {
  const [selectedOfferIdBySubjectId, setSelectedOfferIdBySubjectId] = useState<Record<string, string>>({});

  const fetcher = useCallback(async () => {
    const { data: subjectsRows, error: subjectsError } = await supabase
      .from("subjects")
      .select("id, slug, title, description, track")
      .order("title", { ascending: true })
      .returns<Subject[]>();

    if (subjectsError) throw new Error(subjectsError.message);
    const rows = subjectsRows ?? [];
    const ids = rows.map((s) => s.id);
    if (ids.length === 0) return { subjects: rows, offersBySubjectId: {}, primaryAssetBySubjectId: {} };

    const [{ data: offersRows, error: offersError }, { data: assetsRows, error: assetsError }] = await Promise.all([
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

    if (offersError || assetsError) {
      console.error("[PlansSection] Offers/Assets error:", offersError || assetsError);
    }

    const nextOffersBySubjectId: Record<string, Offer[]> = {};
    for (const offer of offersRows ?? []) {
      const key = offer.subject_id;
      if (!nextOffersBySubjectId[key]) nextOffersBySubjectId[key] = [];
      nextOffersBySubjectId[key].push(offer);
    }

    const nextPrimaryAssetBySubjectId: Record<string, Asset | null> = {};
    for (const asset of assetsRows ?? []) {
      if (nextPrimaryAssetBySubjectId[asset.subject_id]) continue;
      nextPrimaryAssetBySubjectId[asset.subject_id] = asset;
    }
    for (const id of ids) {
      if (!(id in nextPrimaryAssetBySubjectId)) nextPrimaryAssetBySubjectId[id] = null;
    }

    return { subjects: rows, offersBySubjectId: nextOffersBySubjectId, primaryAssetBySubjectId: nextPrimaryAssetBySubjectId };
  }, []);

  const { data, error, isLoading: loading } = useSWR("plans-section-data", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000, // Cache for 1 minute
  });

  const subjects = data?.subjects ?? [];
  const offersBySubjectId = data?.offersBySubjectId ?? {};
  const primaryAssetBySubjectId = data?.primaryAssetBySubjectId ?? {};

  // Auto-select first offer for each subject
  useEffect(() => {
    if (subjects.length === 0) return;
    setSelectedOfferIdBySubjectId((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const subject of subjects) {
        const offers = offersBySubjectId[subject.id] ?? [];
        if (!next[subject.id] && offers[0]?.id) {
          next[subject.id] = offers[0].id;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [subjects, offersBySubjectId]);

  const orderedSubjects = useMemo(() => subjects, [subjects]);

  return (
    <section
      id="plans"
      className="pt-12 pb-32 px-8 lg:px-12 max-w-[1440px] mx-auto overflow-hidden scroll-mt-32"
    >
      <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-8">
        <div className="max-w-2xl">
          <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
            Discovery
          </div>
          <h2 className="font-headline text-5xl lg:text-6xl font-extrabold text-primary mb-4 tracking-tighter">
            Choose Path
          </h2>
          <p className="text-on-surface-variant text-lg font-medium opacity-70">
            Your 800 starts here. Pick a track and start training today.
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
            <div className="text-on-surface-variant mt-2">{error?.message ?? "Unknown error"}</div>
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
            const assetUrl = resolvePublicAssetUrl(asset);
            const theme = cardThemes[idx % cardThemes.length];

            return (
              <div
                key={subject.id}
                className={[
                  "group h-[560px] bg-white border border-outline/30 rounded-[2.5rem] overflow-hidden flex flex-col transition-all duration-700 hover:shadow-premium-2xl hover:-translate-y-3 relative",
                  theme.hoverBorder,
                ].join(" ")}
              >
                {/* Full Background Image */}
                <div className="absolute inset-0 z-0 transition-transform duration-1000 group-hover:scale-110">
                  {assetUrl ? (
                    <Image
                      alt={asset?.alt ?? subject.title}
                      className="w-full h-full object-cover transition-all duration-700"
                      src={assetUrl}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary to-secondary" />
                  )}
                  {/* Subtle Overlays */}
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/40 to-transparent opacity-80 group-hover:opacity-60 transition-opacity duration-700" />
                  <div className={["absolute inset-0 opacity-20", theme.imageGradient].join(" ")} />
                </div>

                {/* Top Tag */}
                <div
                  className={[
                    "absolute top-8 left-8 text-white px-5 py-2 text-[10px] font-black uppercase tracking-[0.25em] rounded-full shadow-lg ring-1 ring-white/30 z-20 backdrop-blur-md",
                    theme.tagBg,
                  ].join(" ")}
                >
                  {subject.track ?? "Subject"}
                </div>

                {/* Content Container (Bottom Glass) */}
                <div className="mt-auto relative z-10 p-2 sm:p-3">
                  <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[2rem] p-6 sm:p-8 shadow-glass group-hover:bg-white/15 transition-all duration-500">
                    <h3 className="text-3xl font-black text-white mb-3 tracking-tight">
                      {subject.title}
                    </h3>
                    <p className="text-white/80 text-sm leading-relaxed mb-8 font-medium line-clamp-2 group-hover:text-white transition-colors">
                      {subject.description ??
                        "High-fidelity mock exams, timed sessions, and detailed review — built for real test pressure."}
                    </p>

                    <div className="space-y-6">
                      <div className="flex items-end justify-between gap-4">
                        <div className="space-y-1">
                          <div className="text-[9px] uppercase tracking-[0.25em] font-black text-white/50">
                            Starting from
                          </div>
                          <div className="text-3xl font-black text-white tracking-tighter">
                            {selectedOffer ? formatMoney(selectedOffer.price_cents, selectedOffer.currency) : "—"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[9px] uppercase tracking-[0.25em] font-black text-white/50">
                            Best Value
                          </div>
                          <div className="text-xs font-bold text-white/90">
                            {selectedOffer?.label ?? "—"}
                          </div>
                        </div>
                      </div>

                      <Link
                        href={`/subjects/${subject.slug}`}
                        className="w-full bg-white text-primary h-14 font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 rounded-2xl hover:bg-secondary hover:text-white shadow-soft-xl active:scale-[0.98] text-sm"
                      >
                        Explore Package
                        <span className="material-symbols-outlined text-lg">arrow_forward</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Show more link */}
      {showMoreLink && !loading && !error && orderedSubjects.length > 0 && (
        <div className="flex justify-center mt-16">
          <a
            href="/plans"
            className="group inline-flex items-center gap-3 bg-white border-2 border-outline/40 px-10 py-4 rounded-full font-bold text-primary hover:bg-primary hover:text-white hover:border-primary transition-all duration-300 active:scale-[0.98]"
          >
            View All Plans
            <span className="material-symbols-outlined text-lg transition-transform duration-300 group-hover:translate-x-1">arrow_forward</span>
          </a>
        </div>
      )}
    </section>
  );
}
