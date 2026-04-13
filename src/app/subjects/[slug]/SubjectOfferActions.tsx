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
  currency: string;
};

type Props = {
  subjectId: string;
  offers: Offer[];
};

function formatMoney(cents: number, currency: string) {
  const value = cents / 100;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function SubjectOfferActions({ subjectId, offers }: Props) {
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
    <div className="bg-white border border-outline/60 shadow-soft-xl p-8">
      <div className="text-xs font-bold text-primary uppercase tracking-widest mb-4">
        Choose Access Period
      </div>

      {offers.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {offers.map((offer) => {
            const active = offer.id === selectedOfferId;
            return (
              <button
                key={offer.id}
                type="button"
                onClick={() => setSelectedOfferId(offer.id)}
                className={
                  active
                    ? "text-left bg-surface-variant border border-primary px-4 py-4 transition-all"
                    : "text-left bg-white border border-outline/60 px-4 py-4 hover:bg-surface-variant transition-all"
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
                <div className="text-sm mt-4 font-extrabold text-primary">
                  {formatMoney(offer.price_cents, offer.currency)}
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
