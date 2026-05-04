"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useCart } from "@/components/cart/CartProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";

type CartRow = {
  id: string;
  quantity: number;
  subject_offers: {
    id: string;
    label: string;
    expires_at: string;
    price_cents: number;
    original_price_cents?: number | null;
    currency: string;
    subject_id: string;
    subjects: {
      title: string;
      slug: string;
      track: string | null;
    };
  };
};

function formatMoney(cents: number, currency: string) {
  const value = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

const WHATSAPP_NUMBER = "201158954215";

export default function CheckoutPage() {
  const router = useRouter();
  const cart = useCart();
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ id: string; discountCents: number; code: string } | null>(null);
  const [validating, setValidating] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [couponModalMessage, setCouponModalMessage] = useState("");

  useEffect(() => {
     let mounted = true;
     async function run() {
       const { data: sessionData } = await supabase.auth.getSession();
       if (!mounted) return;
       
       if (sessionData.session) {
         setUserEmail(sessionData.session.user.email || "");
         setIsAuthenticated(true);
       } else {
         setIsAuthenticated(false);
       }
       
       setLoading(false);
     }
     run();
     return () => {
       mounted = false;
     };
   }, []);

  const rows = cart.items;

  const total = useMemo(() => {
    return rows.reduce((sum, r) => sum + r.subject_offers.price_cents * r.quantity, 0);
  }, [rows]);

  const originalTotal = useMemo(() => {
    return rows.reduce((sum, r) => {
      const orig = r.subject_offers.original_price_cents;
      const price = orig && orig > r.subject_offers.price_cents ? orig : r.subject_offers.price_cents;
      return sum + price * r.quantity;
    }, 0);
  }, [rows]);

  const currency = rows[0]?.subject_offers.currency ?? "EGP";
  const hasDiscount = originalTotal > total;

  function buildWhatsAppMessage() {
    const lines: string[] = [];
    lines.push("Hello, I want to subscribe to the following packages:");
    lines.push("");
    rows.forEach((r, i) => {
      lines.push(`${i + 1}. ${r.subject_offers.subjects.title} — ${r.subject_offers.label}`);
      lines.push(`   Price: ${formatMoney(r.subject_offers.price_cents, currency)}`);
      lines.push(`   Expires: ${new Date(r.subject_offers.expires_at).toLocaleDateString("en-US")}`);
    });
    lines.push("");
    lines.push(`Total: ${formatMoney(total, currency)}`);
    lines.push(`Email: ${userEmail}`);
    return encodeURIComponent(lines.join("\n"));
  }

  async function handleWhatsApp() {
     const msg = buildWhatsAppMessage();
     window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
   }

  async function handleApplyCoupon() {
    if (!couponCode.trim()) return;
    setValidating(true);
    setCouponError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ 
          code: couponCode, 
          cartItems: rows.map(r => ({ subject_id: r.subject_offers.subject_id })),
          totalCents: total
        }),
      });
      const data = await res.json();
      if (data.valid) {
        setAppliedCoupon({
          id: data.couponId,
          discountCents: data.discountAmountCents,
          code: data.code
        });
        setCouponCode("");
      } else {
        const errorMsg = data.error || "Invalid coupon";
        setCouponError(errorMsg);
        setCouponModalMessage(errorMsg);
        setIsCouponModalOpen(true);
      }
    } catch {
      setCouponError("Network error. Try again.");
    } finally {
      setValidating(false);
    }
  }

  async function handlePayment() {
     if (!isAuthenticated) {
       setShowAuthModal(true);
       return;
     }

    setPaying(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const offerIds = rows.map((r) => r.subject_offers.id);
      const res = await fetch("/api/easykash/pay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          offer_ids: offerIds,
          coupon_id: appliedCoupon?.id || null,
          redirect_url: `${window.location.origin}/checkout/callback`,
        }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "An error occurred with the payment gateway. Please try again.");
        setPaying(false);
      }
    } catch {
      alert("Connection error. Please try again.");
      setPaying(false);
    }
  }

  async function handleRemove(cartItemId: string) {
     await cart.removeItem(cartItemId);
   }

   return (
     <>
       <main className="pt-24 pb-40 min-h-screen bg-gradient-to-b from-surface-variant/50 to-white">
         <section className="max-w-[1440px] mx-auto px-6 sm:px-8 lg:px-12 py-12 sm:py-20">
           {/* Header */}
           <div className="mb-10 sm:mb-14">
             <div className="text-secondary font-extrabold text-[10px] sm:text-[11px] uppercase tracking-[0.3em] mb-3">
               Checkout
             </div>
             <h1 className="font-headline text-3xl sm:text-4xl lg:text-5xl font-extrabold text-primary tracking-tight">
               Complete your payment
             </h1>
             <p className="text-on-surface-variant text-sm sm:text-base font-medium mt-3 max-w-xl">
               Choose your preferred payment method to complete your subscription.
             </p>
           </div>

           {loading || isAuthenticated === null ? (
            <div className="bg-white rounded-3xl border border-outline/30 shadow-soft-xl p-10 sm:p-14 text-center">
              <span className="material-symbols-outlined text-4xl text-primary animate-spin">progress_activity</span>
              <p className="text-on-surface-variant font-medium mt-4">Loading...</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="bg-white rounded-3xl border border-outline/30 shadow-soft-xl p-10 sm:p-14 text-center">
              <span className="material-symbols-outlined text-5xl text-on-surface-variant/50">shopping_cart</span>
              <h2 className="text-xl font-extrabold text-primary mt-4">Cart is empty</h2>
              <p className="text-on-surface-variant font-medium mt-2">You haven't added any packages yet.</p>
              <a
                href="/"
                className="inline-block mt-6 bg-primary text-white px-8 py-3 rounded-full font-bold hover:bg-secondary transition-all"
              >
                Browse Packages
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left: Order Items */}
              <div className="lg:col-span-7 space-y-5">
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">
                  Order Items ({rows.length})
                </div>
                {rows.map((r) => {
                  const hasItemDiscount =
                    r.subject_offers.original_price_cents &&
                    r.subject_offers.original_price_cents > r.subject_offers.price_cents;

                  return (
                    <div
                      key={r.id}
                      className="bg-white rounded-2xl border border-outline/30 shadow-soft-xl p-5 sm:p-7 flex flex-col sm:flex-row justify-between gap-5 transition-all hover:shadow-soft-2xl"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] uppercase tracking-[0.2em] font-black text-on-surface-variant bg-surface-variant px-3 py-1 rounded-full inline-block">
                          {r.subject_offers.subjects.track ?? "Subject"}
                        </div>
                        <div className="text-lg sm:text-xl font-extrabold text-primary mt-3 tracking-tight">
                          {r.subject_offers.subjects.title}
                        </div>
                        <div className="text-sm text-on-surface-variant font-medium mt-1.5 flex flex-wrap items-center gap-2">
                          <span>{r.subject_offers.label}</span>
                          <span className="text-outline">•</span>
                          <span>Until {new Date(r.subject_offers.expires_at).toLocaleDateString("en-US")}</span>
                        </div>
                      </div>
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-3">
                        <div className="text-right">
                          {hasItemDiscount ? (
                            <>
                              <div className="text-sm font-semibold text-on-surface-variant line-through opacity-60">
                                {formatMoney(r.subject_offers.original_price_cents!, currency)}
                              </div>
                              <div className="text-xl font-extrabold text-primary">
                                {formatMoney(r.subject_offers.price_cents, currency)}
                              </div>
                            </>
                          ) : (
                            <div className="text-xl font-extrabold text-primary">
                              {formatMoney(r.subject_offers.price_cents * r.quantity, currency)}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemove(r.id)}
                          className="text-xs font-bold text-on-surface-variant/60 hover:text-red-500 transition-colors flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right: Summary */}
              <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-28">
                {/* Coupon Section */}
                <div className="bg-white rounded-3xl border border-outline/30 shadow-soft-xl p-6 sm:p-8">
                  <div className="text-xs font-bold text-primary uppercase tracking-widest mb-4">
                    Have a coupon?
                  </div>
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 p-4 rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-green-600">verified</span>
                        <div>
                          <div className="text-xs font-black text-green-800 uppercase tracking-widest">{appliedCoupon.code}</div>
                          <div className="text-[10px] text-green-700 font-bold">Coupon Applied Successfully!</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => setAppliedCoupon(null)}
                        className="text-green-800/40 hover:text-green-800 transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">close</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value)}
                          placeholder="Enter code here..."
                          className="flex-1 bg-surface-variant border border-outline/40 rounded-xl px-4 py-3 text-sm font-bold text-primary outline-none focus:border-primary transition-colors uppercase"
                        />
                        <button
                          onClick={handleApplyCoupon}
                          disabled={validating || !couponCode.trim()}
                          className="bg-primary text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-secondary transition-all disabled:opacity-50"
                        >
                          {validating ? "..." : "Apply"}
                        </button>
                      </div>
                      {couponError && (
                        <div className="text-[10px] text-red-500 font-bold flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">error</span>
                          {couponError}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-[2rem] border border-outline/30 shadow-soft-2xl p-6 sm:p-8">
                  <div className="text-xs font-bold text-primary uppercase tracking-widest mb-6">
                    Order Summary
                  </div>

                  <div className="space-y-3 mb-6">
                    {rows.map((r) => (
                      <div key={r.id} className="flex justify-between text-sm">
                        <span className="text-on-surface-variant font-medium truncate max-w-[60%]">
                          {r.subject_offers.subjects.title}
                        </span>
                        <span className="font-bold text-primary">
                          {formatMoney(r.subject_offers.price_cents, currency)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-outline/30 pt-4">
                    {hasDiscount && (
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-on-surface-variant font-medium">Original Price</span>
                        <span className="font-semibold text-on-surface-variant line-through">
                          {formatMoney(originalTotal, currency)}
                        </span>
                      </div>
                    )}
                    {hasDiscount && (
                      <div className="flex justify-between text-sm mb-3">
                        <span className="text-green-600 font-bold">Package Savings</span>
                        <span className="text-green-600 font-bold">
                          - {formatMoney(originalTotal - total, currency)}
                        </span>
                      </div>
                    )}
                    {appliedCoupon && (
                      <div className="flex justify-between text-sm mb-3">
                        <span className="text-green-600 font-bold">Coupon ({appliedCoupon.code})</span>
                        <span className="text-green-600 font-bold">
                          - {formatMoney(appliedCoupon.discountCents, currency)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-base font-bold text-primary">Total</span>
                      <span className="text-2xl sm:text-3xl font-extrabold text-primary">
                        {formatMoney(Math.max(0, total - (appliedCoupon?.discountCents ?? 0)), currency)}
                      </span>
                    </div>
                  </div>

                  {/* Security Badge */}
                  <div className="mt-8 flex items-center justify-center gap-2 text-xs text-on-surface-variant/60">
                    <span className="material-symbols-outlined text-sm">verified_user</span>
                    <span>All transactions are encrypted and secure</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Floating Sticky Payment Footer */}
      {!loading && isAuthenticated !== null && rows.length > 0 && (
        <div className="fixed bottom-6 left-6 right-6 z-50 flex flex-col md:flex-row items-center justify-center gap-4">
          {/* Main Action: WhatsApp Payment (Prominent) */}
          <button
            onClick={handleWhatsApp}
            className="group bg-[#25D366] hover:bg-[#20bd5c] text-white shadow-soft-2xl px-10 py-5 rounded-full flex items-center gap-4 animate-in fade-in slide-in-from-bottom-6 duration-500 hover:scale-105 active:scale-95 transition-all"
          >
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 group-hover:rotate-12 transition-transform">
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </div>
            <div className="flex flex-col items-start">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Manual Payment</span>
              <span className="text-lg font-bold">Pay via WhatsApp</span>
            </div>
            <div className="ml-4 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-white">chevron_right</span>
            </div>
          </button>

          {/* Secondary Action: Pay Online (Less Prominent) */}
          <div className="bg-white/80 backdrop-blur-xl border border-outline/30 shadow-soft-xl px-6 py-3 rounded-full flex items-center gap-6 animate-in fade-in slide-in-from-bottom-6 duration-500 delay-200">
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/60">Total</span>
              <span className="text-base font-extrabold text-primary">{formatMoney(total, currency)}</span>
            </div>
            <div className="w-px h-6 bg-outline/20" />
            <button
              onClick={handlePayment}
              disabled={paying}
              className="text-sm font-bold text-primary hover:text-secondary transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {paying ? "Redirecting..." : "Pay Now Online"}
              {!paying && <span className="material-symbols-outlined text-base">credit_card</span>}
            </button>
          </div>
        </div>
      )}
      {/* Coupon Error Modal */}
      {isCouponModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div 
            className="absolute inset-0 bg-primary/20 backdrop-blur-md"
            onClick={() => setIsCouponModalOpen(false)}
          />
          <div className="relative bg-white rounded-[2.5rem] shadow-premium max-w-md w-full p-8 sm:p-10 text-center animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-4xl text-rose-500">error</span>
            </div>
            <h3 className="text-2xl font-black text-primary tracking-tight mb-3">Coupon Not Applied</h3>
            <p className="text-on-surface-variant font-medium leading-relaxed">
              {couponModalMessage}
            </p>
            <button
              onClick={() => setIsCouponModalOpen(false)}
              className="mt-8 w-full h-14 bg-primary text-white font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition-all shadow-premium"
            >
              Got it
            </button>
          </div>
        </div>
       )}

       {/* Auth Required Modal - for guest Pay Online */}
       {showAuthModal && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
           <div 
             className="absolute inset-0 bg-primary/20 backdrop-blur-md"
             onClick={() => setShowAuthModal(false)}
           />
           <div className="relative bg-white rounded-[2.5rem] shadow-premium max-w-md w-full p-8 sm:p-10 text-center animate-in fade-in zoom-in duration-300">
             <button
               onClick={() => setShowAuthModal(false)}
               className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-all"
             >
               <span className="material-symbols-outlined text-sm">close</span>
             </button>
             <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
               <span className="material-symbols-outlined text-4xl text-primary">account_circle</span>
             </div>
             <h3 className="text-2xl font-black text-primary tracking-tight mb-3">Account Required</h3>
             <p className="text-on-surface-variant font-medium leading-relaxed mb-8">
               To pay online with a card or mobile wallet, you need an account. Create one or log in to continue.
             </p>
             <div className="space-y-3">
               <Link
                 href={`/join?mode=signup&next=${encodeURIComponent(window.location.pathname)}`}
                 className="w-full h-14 bg-primary text-white font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition-all shadow-premium flex items-center justify-center"
               >
                 Create Free Account
               </Link>
               <Link
                 href={`/join?mode=login&next=${encodeURIComponent(window.location.pathname)}`}
                 className="w-full h-12 text-primary font-bold hover:text-secondary transition-all flex items-center justify-center"
               >
                 Log In
               </Link>
             </div>
           </div>
         </div>
       )}
     </>
   );
 }
