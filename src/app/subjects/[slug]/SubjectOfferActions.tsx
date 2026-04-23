"use client";

import { useMemo, useState } from "react";
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

  const selectedOffer = useMemo(() => {
    return offers.find((o) => o.id === selectedOfferId) ?? null;
  }, [offers, selectedOfferId]);

  async function requireAuth() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.push("/join?mode=login");
      return null;
    }
    return data.session.user;
  }

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
      const user = await requireAuth();
      if (!user) return;
      const { error } = await supabase.from("cart_items").upsert(
        { user_id: user.id, subject_offer_id: selectedOffer.id, quantity: 1 },
        { onConflict: "user_id,subject_offer_id" },
      );
      if (error) throw error;
      await cart.refresh();
      router.push("/checkout");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white/95 backdrop-blur-md border border-outline/30 shadow-soft-2xl p-6 sm:p-8 rounded-[2rem]">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="text-xs font-bold text-primary uppercase tracking-widest">
          Choose Access Period
        </div>
        {typeof examsCount === "number" ? (
          <div className="flex items-center gap-2 bg-surface-variant px-4 py-2 rounded-full">
            <span className="material-symbols-outlined text-base text-primary">quiz</span>
            <span className="text-sm font-extrabold text-primary">{examsCount}</span>
            <span className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Exams</span>
          </div>
        ) : null}
      </div>

      {offers.length ? (
        <div className="flex flex-col gap-3 mb-8">
          {offers.map((offer) => {
            const active = offer.id === selectedOfferId;
            return (
              <button
                key={offer.id}
                type="button"
                onClick={() => setSelectedOfferId(offer.id)}
                className={
                  active
                    ? "text-left bg-surface-variant border-2 border-primary px-5 py-5 rounded-2xl transition-all transform shadow-soft-md"
                    : "text-left bg-white border-2 border-outline/30 px-5 py-5 rounded-2xl hover:border-outline/80 transition-all hover:-translate-y-0.5"
                }
                aria-pressed={active}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-extrabold text-primary">{offer.label}</div>
                    <div className="text-xs text-on-surface-variant font-medium mt-1">
                      Expires: {new Date(offer.expires_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {active ? (
                      <span className="text-[10px] uppercase tracking-[0.2em] font-black text-secondary">
                        Selected
                      </span>
                    ) : null}
                    <span
                      className={
                        active
                          ? "w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center"
                          : "w-5 h-5 rounded-full border border-outline flex items-center justify-center"
                      }
                      aria-hidden="true"
                    >
                      {active ? (
                        <span className="material-symbols-outlined text-[16px]">check</span>
                      ) : null}
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <div className="text-xl sm:text-2xl font-extrabold text-primary">
                    {formatMoney(offer.price_cents, offer.currency)}
                  </div>
                  {offer.original_price_cents && offer.original_price_cents > offer.price_cents ? (
                    <div className="text-sm sm:text-base font-semibold text-on-surface-variant line-through opacity-70">
                      {formatMoney(offer.original_price_cents, offer.currency)}
                    </div>
                  ) : null}
                  {offer.original_price_cents && offer.original_price_cents > offer.price_cents ? (
                    <div className="ml-auto text-[10px] sm:text-xs font-bold uppercase tracking-wider text-white bg-green-500 px-3 py-1 rounded-full">
                      Save {Math.round(((offer.original_price_cents - offer.price_cents) / offer.original_price_cents) * 100)}%
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="border border-outline/60 bg-surface-variant px-4 py-4 text-sm text-on-surface-variant mb-6">
          No durations configured yet for this subject.
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4">
        <button
          type="button"
          disabled={!selectedOffer || loading}
          onClick={goToCheckout}
          className="flex-1 bg-secondary text-white px-10 py-4 font-bold text-base hover:bg-primary transition-all rounded-full disabled:opacity-60"
        >
          Subscribe
        </button>
        <button
          type="button"
          disabled={!selectedOffer || loading}
          onClick={addToCart}
          className="flex-1 bg-white text-primary border border-outline px-10 py-4 font-bold text-base hover:bg-surface-variant transition-all rounded-full disabled:opacity-60"
        >
          Add to cart
        </button>
      </div>
    </div>
  );
}
