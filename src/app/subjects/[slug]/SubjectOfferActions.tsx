"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useCart } from "@/components/cart/CartProvider";

type Offer = {
  id: string;
  label: string;
  expires_at: string;
  price_cents: number;
  original_price_cents?: number | null;
  currency: string;
};

type Props = {
  subjectId: string;
  offers: Offer[];
  examsCount?: number;
};

function formatMoney(cents: number, currency: string) {
  const value = cents / 100;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function SubjectOfferActions({ subjectId, offers, examsCount }: Props) {
  const router = useRouter();
  const cart = useCart();
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(
    offers[0]?.id ?? null,
  );
  const [loading, setLoading] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [showFloating, setShowFloating] = useState(false);

  const selectedOffer = useMemo(() => {
    return offers.find((o) => o.id === selectedOfferId) ?? null;
  }, [offers, selectedOfferId]);

  // Intersection observer for floating CTA
  useEffect(() => {
    if (!sectionRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowFloating(!entry.isIntersecting);
      },
      { threshold: 0, rootMargin: "0px" }
    );
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  async function addToCart() {
    if (!selectedOffer) return;
    setLoading(true);
    try {
      await cart.addOfferToCart(selectedOffer.id);
    } finally {
      setLoading(false);
    }
  }

  async function goToCheckout() {
    if (!selectedOffer) return;

    setLoading(true);
    try {
      await cart.addOfferToCart(selectedOffer.id);
      router.push("/checkout");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div 
        ref={sectionRef} 
        className="max-w-xl mx-auto lg:mx-0"
      >
        {/* Simple Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
            </div>
            <h3 className="text-xl font-black text-primary tracking-tight">Select Plan</h3>
          </div>
          <p className="text-on-surface-variant/70 text-[13px] font-medium leading-relaxed">
            Choose the duration that fits your study schedule. Full access guaranteed.
          </p>
        </div>

        {/* Offers Grid */}
        <div className="space-y-3 mb-8">
          {offers.length ? (
            offers.map((offer) => {
              const active = offer.id === selectedOfferId;
              return (
                <button
                  key={offer.id}
                  type="button"
                  onClick={() => setSelectedOfferId(offer.id)}
                  className={`w-full text-left p-5 rounded-2xl transition-all border-2 flex items-center justify-between gap-4 group ${
                    active
                      ? "border-primary bg-primary/[0.03] shadow-soft-xl"
                      : "border-outline/30 bg-white hover:border-outline/80 hover:bg-slate-50"
                  }`}
                  aria-pressed={active}
                >
                  <div className="flex items-center gap-4">
                    {/* Checkbox circle */}
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      active ? "border-primary bg-primary" : "border-outline/50 bg-white group-hover:border-outline"
                    }`}>
                      {active && <span className="material-symbols-outlined text-white text-[16px] font-black">check</span>}
                    </div>
                    
                    <div>
                      <div className={`text-base font-black transition-colors ${active ? "text-primary" : "text-slate-700"}`}>
                        {offer.label}
                      </div>
                      <div className="text-[11px] text-on-surface-variant/60 font-bold uppercase tracking-wider mt-0.5">
                        {examsCount ?? 0} Full Mock Exams
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-black text-primary">
                      {formatMoney(offer.price_cents, offer.currency)}
                    </div>
                    {offer.original_price_cents && offer.original_price_cents > offer.price_cents && (
                      <div className="flex items-center justify-end gap-2 mt-0.5">
                        <span className="text-[10px] font-bold text-on-surface-variant/40 line-through">
                          {formatMoney(offer.original_price_cents, offer.currency)}
                        </span>
                        <span className="text-[10px] font-black text-secondary uppercase tracking-tight">
                          -{Math.round(((offer.original_price_cents - offer.price_cents) / offer.original_price_cents) * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="p-8 text-center text-slate-300 font-bold text-xs uppercase tracking-[0.2em] italic border-2 border-dashed border-outline/30 rounded-2xl">
              No active plans
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {offers.length > 0 && (
          <div className="space-y-3">
            <button
              type="button"
              disabled={!selectedOffer || loading}
              onClick={goToCheckout}
              className="w-full h-14 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
            >
              <span>Unlock Access Now</span>
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </button>
            
            <button
              type="button"
              disabled={!selectedOffer || loading}
              onClick={addToCart}
              className="w-full h-14 bg-white text-primary border-2 border-outline/40 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-50 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
            >
              <span className="material-symbols-outlined text-lg">shopping_cart</span>
              <span>Add to Cart</span>
            </button>
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-6 opacity-40">
          <div className="flex items-center gap-1.5 grayscale">
            <span className="material-symbols-outlined text-sm">verified_user</span>
            <span className="text-[9px] font-black uppercase tracking-widest">Secure</span>
          </div>
          <div className="flex items-center gap-1.5 grayscale">
            <span className="material-symbols-outlined text-sm">support_agent</span>
            <span className="text-[9px] font-black uppercase tracking-widest">Support</span>
          </div>
          <div className="flex items-center gap-1.5 grayscale">
            <span className="material-symbols-outlined text-sm">workspace_premium</span>
            <span className="text-[9px] font-black uppercase tracking-widest">Premium</span>
          </div>
        </div>
      </div>

      {/* Floating CTA */}
      {showFloating && offers.length > 0 && (
        <div className="fixed bottom-6 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-[9999] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <button
            type="button"
            disabled={!selectedOffer || loading}
            onClick={goToCheckout}
            className="w-full sm:w-auto bg-primary text-white px-8 py-4 font-black text-xs sm:text-sm uppercase tracking-[0.2em] hover:bg-slate-800 transition-all rounded-2xl shadow-2xl shadow-primary/30 disabled:opacity-60 flex items-center justify-center gap-3 border-2 border-white/20 active:scale-[0.98]"
          >
            <span>Subscribe {selectedOffer ? `• ${formatMoney(selectedOffer.price_cents, selectedOffer.currency)}` : ""}</span>
          </button>
        </div>
      )}
    </>
  );
}
