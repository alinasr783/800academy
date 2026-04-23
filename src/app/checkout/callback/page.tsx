"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

type TransactionInfo = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  metadata: {
    offers?: {
      subject_title: string;
      label: string;
    }[];
  };
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-EG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function CallbackContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const customerReference = searchParams.get("customerReference");
  const providerRefNum = searchParams.get("providerRefNum");

  const [transaction, setTransaction] = useState<TransactionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [fulfilling, setFulfilling] = useState(false);

  const isSuccess = status === "success" || status === "PAID";
  const isFailed = status === "FAILED" || status === "failed";
  const isPending = !isSuccess && !isFailed;

  useEffect(() => {
    let mounted = true;

    async function process() {
      if (!customerReference) {
        setLoading(false);
        return;
      }

      // First, try to trigger fulfillment via the callback API
      if (isSuccess) {
        setFulfilling(true);
        try {
          await fetch(
            `/api/easykash/callback?status=PAID&customerReference=${encodeURIComponent(customerReference)}${providerRefNum ? `&providerRefNum=${encodeURIComponent(providerRefNum)}` : ""}`,
            { method: "GET" }
          );
        } catch {
          // Fulfillment will also happen via webhook, so this is a best-effort
        }
        if (mounted) setFulfilling(false);
      }

      // Fetch transaction details
      const refNum = Number(customerReference);
      if (Number.isFinite(refNum)) {
        const { data } = await supabase
          .from("transactions")
          .select("id, amount, currency, status, metadata")
          .eq("reference_number", refNum)
          .maybeSingle();

        if (mounted && data) {
          setTransaction(data as TransactionInfo);
        }
      }

      if (mounted) setLoading(false);
    }

    process();
    return () => {
      mounted = false;
    };
  }, [customerReference, isSuccess, providerRefNum]);

  return (
    <main className="pt-24 min-h-screen bg-gradient-to-b from-surface-variant/50 to-white">
      <section className="max-w-2xl mx-auto px-6 sm:px-8 py-16 sm:py-24">
        {loading || fulfilling ? (
          <div className="bg-white rounded-[2rem] border border-outline/30 shadow-soft-2xl p-10 sm:p-14 text-center">
            <span className="material-symbols-outlined text-5xl text-primary animate-spin">progress_activity</span>
            <h2 className="text-xl font-extrabold text-primary mt-6">جاري معالجة الدفع...</h2>
            <p className="text-on-surface-variant font-medium mt-3">يرجى الانتظار بينما نؤكد عملية الدفع</p>
          </div>
        ) : isSuccess ? (
          <div className="bg-white rounded-[2rem] border border-outline/30 shadow-soft-2xl p-8 sm:p-12 text-center">
            {/* Success Icon */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-4xl sm:text-5xl text-green-600" style={{ fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
            </div>

            <h1 className="font-headline text-2xl sm:text-3xl font-extrabold text-primary mt-6 tracking-tight">
              تم الدفع بنجاح! 🎉
            </h1>
            <p className="text-on-surface-variant font-medium mt-3 text-sm sm:text-base max-w-md mx-auto">
              تم تفعيل اشتراكك بنجاح. يمكنك الآن الوصول لجميع المحتوى المشمول في الباقة.
            </p>

            {/* Transaction Details */}
            {transaction && (
              <div className="mt-8 bg-surface-variant/50 rounded-2xl p-5 sm:p-6 text-right">
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-4">تفاصيل المعاملة</div>
                {transaction.metadata?.offers?.map((offer, i) => (
                  <div key={i} className="flex justify-between text-sm mb-2">
                    <span className="text-on-surface-variant font-medium">{offer.subject_title}</span>
                    <span className="font-bold text-primary">{offer.label}</span>
                  </div>
                ))}
                <div className="border-t border-outline/30 mt-3 pt-3 flex justify-between">
                  <span className="text-sm font-bold text-primary">الإجمالي المدفوع</span>
                  <span className="text-lg font-extrabold text-primary">
                    {formatMoney(transaction.amount, transaction.currency)}
                  </span>
                </div>
                {customerReference && (
                  <div className="text-xs text-on-surface-variant/60 mt-2">
                    رقم المرجع: {customerReference}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <Link
                href="/dashboard"
                className="flex-1 bg-primary text-white py-4 font-bold text-sm sm:text-base rounded-full hover:bg-secondary transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">dashboard</span>
                الذهاب للوحة التحكم
              </Link>
              <Link
                href="/"
                className="flex-1 bg-white text-primary border-2 border-outline/40 py-4 font-bold text-sm sm:text-base rounded-full hover:bg-surface-variant transition-all flex items-center justify-center gap-2"
              >
                الصفحة الرئيسية
              </Link>
            </div>
          </div>
        ) : isFailed ? (
          <div className="bg-white rounded-[2rem] border border-outline/30 shadow-soft-2xl p-8 sm:p-12 text-center">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-red-100 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-4xl sm:text-5xl text-red-500" style={{ fontVariationSettings: "'FILL' 1" }}>
                cancel
              </span>
            </div>

            <h1 className="font-headline text-2xl sm:text-3xl font-extrabold text-primary mt-6 tracking-tight">
              فشلت عملية الدفع
            </h1>
            <p className="text-on-surface-variant font-medium mt-3 text-sm sm:text-base max-w-md mx-auto">
              لم تتم عملية الدفع. يمكنك المحاولة مرة أخرى أو التواصل مع خدمة العملاء.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <Link
                href="/checkout"
                className="flex-1 bg-primary text-white py-4 font-bold text-sm sm:text-base rounded-full hover:bg-secondary transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">refresh</span>
                حاول مرة أخرى
              </Link>
              <a
                href={`https://wa.me/201158954215?text=${encodeURIComponent("مرحباً، واجهت مشكلة في الدفع الأونلاين. رقم المرجع: " + (customerReference || "غير متاح"))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-green-500 text-white py-4 font-bold text-sm sm:text-base rounded-full hover:bg-green-600 transition-all flex items-center justify-center gap-2"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                تواصل مع خدمة العملاء
              </a>
            </div>
          </div>
        ) : (
          /* Pending / Unknown */
          <div className="bg-white rounded-[2rem] border border-outline/30 shadow-soft-2xl p-8 sm:p-12 text-center">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-4xl sm:text-5xl text-amber-600" style={{ fontVariationSettings: "'FILL' 1" }}>
                schedule
              </span>
            </div>

            <h1 className="font-headline text-2xl sm:text-3xl font-extrabold text-primary mt-6 tracking-tight">
              الدفع قيد المعالجة
            </h1>
            <p className="text-on-surface-variant font-medium mt-3 text-sm sm:text-base max-w-md mx-auto">
              تم استلام طلبك وجاري معالجة الدفع. سيتم تفعيل اشتراكك فور تأكيد الدفع.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <Link
                href="/dashboard"
                className="flex-1 bg-primary text-white py-4 font-bold text-sm sm:text-base rounded-full hover:bg-secondary transition-all flex items-center justify-center gap-2"
              >
                الذهاب للوحة التحكم
              </Link>
              <Link
                href="/"
                className="flex-1 bg-white text-primary border-2 border-outline/40 py-4 font-bold text-sm sm:text-base rounded-full hover:bg-surface-variant transition-all flex items-center justify-center gap-2"
              >
                الصفحة الرئيسية
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

export default function CallbackPage() {
  return (
    <>
      <SiteHeader />
      <Suspense
        fallback={
          <main className="pt-24 min-h-screen bg-gradient-to-b from-surface-variant/50 to-white flex items-center justify-center">
            <span className="material-symbols-outlined text-5xl text-primary animate-spin">progress_activity</span>
          </main>
        }
      >
        <CallbackContent />
      </Suspense>
    </>
  );
}
