"use client";

import { useState, useCallback } from "react";

type Asset = {
  id: string;
  url: string | null;
  bucket: string | null;
  storage_path: string | null;
  alt: string | null;
  sort_order: number;
};

export default function SubjectCarousel({
  assets,
  title,
}: {
  assets: Asset[];
  title: string;
}) {
  const [current, setCurrent] = useState(0);
  const count = assets.length;

  const prev = useCallback(() => {
    setCurrent((c) => (c === 0 ? count - 1 : c - 1));
  }, [count]);

  const next = useCallback(() => {
    setCurrent((c) => (c === count - 1 ? 0 : c + 1));
  }, [count]);

  if (count === 0) return null;

  return (
    <div className="relative w-full aspect-square md:aspect-[4/3] lg:aspect-square rounded-[2rem] overflow-hidden shadow-soft-2xl border border-outline/30 group">
      {/* Slides */}
      {assets.map((asset, idx) => (
        <div
          key={asset.id}
          className="absolute inset-0 transition-opacity duration-500 ease-in-out"
          style={{ opacity: idx === current ? 1 : 0, zIndex: idx === current ? 1 : 0 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={asset.url ?? ""}
            alt={asset.alt ?? `${title} - ${idx + 1}`}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/20 to-transparent mix-blend-multiply" />
        </div>
      ))}

      {/* Navigation arrows — only show if more than 1 */}
      {count > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-white"
            aria-label="Previous image"
          >
            <span className="material-symbols-outlined text-primary text-xl">chevron_left</span>
          </button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-white"
            aria-label="Next image"
          >
            <span className="material-symbols-outlined text-primary text-xl">chevron_right</span>
          </button>

          {/* Dots */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
            {assets.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrent(idx)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  idx === current
                    ? "bg-white w-6"
                    : "bg-white/50 hover:bg-white/80"
                }`}
                aria-label={`Go to image ${idx + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
