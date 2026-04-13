"use client";

import { useEffect, useMemo, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import { supabase } from "@/lib/supabaseClient";

type CartRow = {
  id: string;
  quantity: number;
  subject_offers: {
    id: string;
    label: string;
    expires_at: string;
    price_cents: number;
    currency: string;
    subjects: {
      title: string;
      slug: string;
      track: string | null;
    };
  };
};

function formatMoney(cents: number, currency: string) {
  const value = cents / 100;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function CheckoutPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CartRow[]>([]);

  useEffect(() => {
    let mounted = true;
    async function run() {
      const offerId = new URLSearchParams(window.location.search).get("offer");
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        window.location.href = "/join?mode=login";
        return;
      }

      let q = supabase
        .from("cart_items")
        .select(
          "id, quantity, subject_offers(id, label, expires_at, price_cents, currency, subjects(title, slug, track))",
        )
        .order("created_at", { ascending: false });

      if (offerId) q = q.eq("subject_offer_id", offerId);

      const { data, error } = await q.returns<CartRow[]>();

      if (!mounted) return;
      if (error) {
        setRows([]);
      } else {
        setRows(data ?? []);
      }
      setLoading(false);
    }
    run();
    return () => {
      mounted = false;
    };
  }, []);

  const total = useMemo(() => {
    return rows.reduce((sum, r) => sum + r.subject_offers.price_cents * r.quantity, 0);
  }, [rows]);

  const currency = rows[0]?.subject_offers.currency ?? "EGP";

  return (
    <>
      <SiteHeader />
      <main className="pt-24">
        <section className="max-w-[1440px] mx-auto px-8 lg:px-12 py-20">
          <div className="flex items-end justify-between gap-10 mb-12">
            <div>
              <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
                Checkout
              </div>
              <h1 className="font-headline text-5xl font-extrabold text-primary tracking-tighter">
                Review your order
              </h1>
            </div>
            <div className="text-xs uppercase tracking-widest text-on-surface-variant font-bold">
              EasyKash coming next
            </div>
          </div>

          {loading ? (
            <div className="bg-surface-variant border border-outline/40 p-10 text-on-surface-variant font-medium">
              Loading…
            </div>
          ) : rows.length ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              <div className="lg:col-span-8 space-y-6">
                {rows.map((r) => (
                  <div
                    key={r.id}
                    className="bg-white border border-outline/60 shadow-soft-xl p-8 flex flex-col md:flex-row justify-between gap-6"
                  >
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em] font-black text-on-surface-variant">
                        {r.subject_offers.subjects.track ?? "Subject"}
                      </div>
                      <div className="text-2xl font-extrabold text-primary mt-3 tracking-tight">
                        {r.subject_offers.subjects.title}
                      </div>
                      <div className="text-sm text-on-surface-variant font-medium mt-2">
                        {r.subject_offers.label} • Expires{" "}
                        {new Date(r.subject_offers.expires_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-on-surface-variant font-medium">
                        Qty {r.quantity}
                      </div>
                      <div className="text-2xl font-extrabold text-primary mt-2">
                        {formatMoney(r.subject_offers.price_cents * r.quantity, currency)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="lg:col-span-4">
                <div className="bg-white border border-outline/60 shadow-soft-xl p-8">
                  <div className="text-xs font-bold text-primary uppercase tracking-widest mb-6">
                    Summary
                  </div>
                  <div className="flex justify-between text-sm text-on-surface-variant font-medium">
                    <span>Total</span>
                    <span>{formatMoney(total, currency)}</span>
                  </div>
                  <button
                    type="button"
                    className="w-full mt-8 bg-secondary text-white py-4 font-bold text-base hover:bg-primary transition-all rounded-full"
                    onClick={() => alert("Payment (EasyKash) will be added next.")}
                  >
                    Proceed to payment
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-surface-variant border border-outline/40 p-10 text-on-surface-variant font-medium">
              Your cart is empty.
            </div>
          )}
        </section>
      </main>
    </>
  );
}
