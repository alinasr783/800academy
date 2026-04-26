"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const prev = useCallback(() => {
    setCurrent((c) => (c === 0 ? count - 1 : c - 1));
  }, [count]);

  const next = useCallback(() => {
    setCurrent((c) => (c === count - 1 ? 0 : c + 1));
  }, [count]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightboxOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxOpen(false);
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, prev, next]);

  // Swipe / scroll handling
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function onTouchMove(e: React.TouchEvent) {
    touchEndX.current = e.touches[0].clientX;
  }

  function onTouchEnd() {
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50;
    if (Math.abs(diff) > threshold) {
      if (diff > 0) next();  // swipe left → next
      else prev();           // swipe right → prev
    }
    touchStartX.current = 0;
    touchEndX.current = 0;
  }

  // Mouse drag handling (for desktop scroll)
  const mouseStartX = useRef(0);
  const isDragging = useRef(false);

  function onMouseDown(e: React.MouseEvent) {
    isDragging.current = true;
    mouseStartX.current = e.clientX;
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!isDragging.current) return;
    // Prevent text selection during drag
    e.preventDefault();
  }

  function onMouseUp(e: React.MouseEvent) {
    if (!isDragging.current) return;
    isDragging.current = false;
    const diff = mouseStartX.current - e.clientX;
    const threshold = 50;
    if (Math.abs(diff) > threshold) {
      if (diff > 0) next();
      else prev();
    }
  }

  function onMouseLeave() {
    isDragging.current = false;
  }

  if (count === 0) return null;

  return (
    <>
      <div
        ref={scrollRef}
        className="relative w-full aspect-square md:aspect-[4/3] lg:aspect-square rounded-[2rem] overflow-hidden shadow-soft-2xl border border-outline/30 group cursor-grab active:cursor-grabbing select-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      >
        {/* Slides */}
        {assets.map((asset, idx) => (
          <div
            key={asset.id}
            className="absolute inset-0 transition-opacity duration-500 ease-in-out cursor-zoom-in"
            style={{ opacity: idx === current ? 1 : 0, zIndex: idx === current ? 1 : 0 }}
            onClick={() => setLightboxOpen(true)}
          >
            <Image
              src={asset.url ?? ""}
              alt={asset.alt ?? `${title} - ${idx + 1}`}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              draggable={false}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/20 to-transparent mix-blend-multiply opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            {/* View Icon Overlay */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500">
              <div className="bg-white/20 backdrop-blur-md p-4 rounded-full border border-white/30 transform scale-90 group-hover:scale-100 transition-transform duration-500">
                <span className="material-symbols-outlined text-white text-3xl">zoom_in</span>
              </div>
            </div>
          </div>
        ))}

        {/* Navigation Dots */}
        {count > 1 && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {assets.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => { e.stopPropagation(); setCurrent(idx); }}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  idx === current ? "bg-white w-6" : "bg-white/40 hover:bg-white/60"
                }`}
                aria-label={`Go to image ${idx + 1}`}
              />
            ))}
          </div>
        )}

        {/* Arrow Navigation (Desktop) */}
        {count > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-6 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-white/20"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="absolute right-6 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-white/20"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm animate-in fade-in duration-300 overflow-hidden">
          {/* Top Bar */}
          <div className="absolute top-0 inset-x-0 h-20 flex items-center justify-between px-8 z-[120] bg-gradient-to-b from-black/50 to-transparent">
            <div className="text-white/80 font-bold text-sm tracking-widest uppercase">
              {assets[current].alt || `${title} — Gallery`}
            </div>
            <button
              onClick={() => setLightboxOpen(false)}
              className="w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
            >
              <span className="material-symbols-outlined text-3xl">close</span>
            </button>
          </div>

          {/* Lightbox Controls */}
          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 z-[120] w-14 h-14 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/15 transition-all text-white group"
          >
            <span className="material-symbols-outlined text-5xl group-hover:-translate-x-1 transition-transform">chevron_left</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 z-[120] w-14 h-14 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/15 transition-all text-white group"
          >
            <span className="material-symbols-outlined text-5xl group-hover:translate-x-1 transition-transform">chevron_right</span>
          </button>

          {/* Scrollable Container */}
          <div 
            className="flex w-full h-full overflow-x-auto snap-x snap-mandatory hide-scrollbar cursor-default"
            onScroll={(e) => {
              const el = e.currentTarget;
              const idx = Math.round(el.scrollLeft / el.clientWidth);
              if (idx !== current && idx >= 0 && idx < count) {
                setCurrent(idx);
              }
            }}
            ref={(el) => {
              if (el) {
                // Keep scroll in sync with current
                const targetX = current * el.clientWidth;
                if (Math.abs(el.scrollLeft - targetX) > 10) {
                  el.scrollLeft = targetX;
                }
              }
            }}
          >
            {assets.map((asset, idx) => (
              <div 
                key={asset.id} 
                className="flex-shrink-0 w-full h-full flex items-center justify-center p-4 sm:p-20 snap-center"
                onClick={() => setLightboxOpen(false)}
              >
                <div className="relative w-full h-full max-w-6xl max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                  <Image
                    src={asset.url ?? ""}
                    alt={asset.alt ?? title}
                    className="object-contain w-full h-full select-none"
                    fill
                    priority={idx === current}
                    draggable={false}
                  />
                </div>
              </div>
            ))}
          </div>
          
          {/* Counter Overlay */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[120]">
            <div className="bg-white/10 backdrop-blur-xl px-6 py-3 rounded-full border border-white/10 text-white/90 font-black text-sm tracking-[0.2em] shadow-2xl">
              {current + 1} / {count}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
