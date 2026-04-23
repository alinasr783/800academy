"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type CartItem = {
  id: string;
  quantity: number;
  created_at: string;
  subject_offers: {
    id: string;
    label: string;
    expires_at: string;
    price_cents: number;
    currency: string;
    subjects: { title: string; slug: string; track: string | null };
  };
};

type CartContextValue = {
  count: number;
  items: CartItem[];
  open: boolean;
  openCart: () => void;
  closeCart: () => void;
  refresh: () => Promise<void>;
  addOfferToCart: (subjectOfferId: string) => Promise<void>;
  removeItem: (cartItemId: string) => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

function formatMoney(cents: number, currency: string) {
  const value = cents / 100;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function CartFloating() {
  const router = useRouter();
  const pathname = usePathname();
  const cart = useCart();

  const total = useMemo(() => {
    return cart.items.reduce(
      (sum, r) => sum + r.subject_offers.price_cents * r.quantity,
      0,
    );
  }, [cart.items]);

  const currency = cart.items[0]?.subject_offers.currency ?? "EGP";

  const visible = cart.count > 0 && pathname !== "/checkout";
  if (!visible) return null;

  return (
    <>
      <button
        type="button"
        onClick={cart.openCart}
        className="fixed bottom-6 right-6 z-[60] bg-primary text-white shadow-soft-xl border border-white/10 w-14 h-14 flex items-center justify-center rounded-full"
        aria-label="Open cart"
      >
        <span className="material-symbols-outlined text-[24px]">shopping_bag</span>
        <span className="absolute -top-2 -right-2 bg-secondary text-white text-xs font-extrabold w-6 h-6 rounded-full flex items-center justify-center">
          {cart.count}
        </span>
      </button>

      {cart.open ? (
        <>
          <button
            type="button"
            onClick={cart.closeCart}
            className="fixed inset-0 z-[59] bg-black/30"
            aria-label="Close cart"
          />
          <aside className="fixed bottom-6 right-6 z-[61] w-[360px] max-w-[calc(100vw-48px)] bg-white border border-outline/60 shadow-soft-xl overflow-hidden">
            <div className="p-6 border-b border-outline/40 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-primary uppercase tracking-widest">
                  Cart
                </div>
                <div className="text-sm text-on-surface-variant font-medium mt-1">
                  {cart.count} item{cart.count === 1 ? "" : "s"}
                </div>
              </div>
              <button
                type="button"
                onClick={cart.closeCart}
                className="w-10 h-10 rounded-full border border-outline/60 flex items-center justify-center hover:bg-surface-variant transition-all"
                aria-label="Close"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="max-h-[360px] overflow-auto p-6 space-y-4">
              {cart.items.map((it) => (
                <div
                  key={it.id}
                  className="border border-outline/60 p-4 bg-surface-variant/40"
                >
                  <div className="text-[10px] uppercase tracking-[0.2em] font-black text-on-surface-variant">
                    {it.subject_offers.subjects.track ?? "Subject"}
                  </div>
                  <div className="text-sm font-extrabold text-primary mt-2 tracking-tight">
                    <Link href={`/subjects/${it.subject_offers.subjects.slug}`}>
                      {it.subject_offers.subjects.title}
                    </Link>
                  </div>
                  <div className="text-xs text-on-surface-variant font-medium mt-1">
                    {it.subject_offers.label}
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="text-sm font-extrabold text-primary">
                      {formatMoney(it.subject_offers.price_cents * it.quantity, currency)}
                    </div>
                    <button
                      type="button"
                      onClick={() => cart.removeItem(it.id)}
                      className="text-xs font-bold text-on-surface-variant hover:text-primary transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 border-t border-outline/40">
              <div className="flex items-center justify-between text-sm font-medium text-on-surface-variant">
                <span>Total</span>
                <span className="text-primary font-extrabold">
                  {formatMoney(total, currency)}
                </span>
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  className="flex-1 bg-secondary text-white py-3 font-bold text-sm hover:bg-primary transition-all rounded-full"
                  onClick={() => {
                    cart.closeCart();
                    if (pathname !== "/checkout") router.push("/checkout");
                  }}
                >
                  Checkout
                </button>
                <button
                  type="button"
                  className="flex-1 bg-white text-primary border border-outline py-3 font-bold text-sm hover:bg-surface-variant transition-all rounded-full"
                  onClick={cart.closeCart}
                >
                  Continue
                </button>
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);

  const refresh = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setItems([]);
      setOpen(false);
      return;
    }

    const { data, error } = await supabase
      .from("cart_items")
      .select(
        "id, quantity, created_at, subject_offers(id, label, expires_at, price_cents, currency, subjects(title, slug, track))",
      )
      .order("created_at", { ascending: false })
      .returns<CartItem[]>();

    if (error) {
      setItems([]);
      return;
    }
    setItems(data ?? []);
  }, []);

  useEffect(() => {
    refresh();
    const { data } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, [refresh]);

  const addOfferToCart = useCallback(
    async (subjectOfferId: string) => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push("/join?mode=login");
        return;
      }

      const user = sessionData.session.user;
      const { error } = await supabase.from("cart_items").upsert(
        {
          user_id: user.id,
          subject_offer_id: subjectOfferId,
          quantity: 1,
        },
        { onConflict: "user_id,subject_offer_id" },
      );
      if (error) throw error;
      await refresh();
      setOpen(true);
    },
    [refresh, router],
  );

  const removeItem = useCallback(
    async (cartItemId: string) => {
      const { error } = await supabase.from("cart_items").delete().eq("id", cartItemId);
      if (error) return;
      await refresh();
    },
    [refresh],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      count: items.reduce((sum, i) => sum + i.quantity, 0),
      items,
      open,
      openCart: () => setOpen(true),
      closeCart: () => setOpen(false),
      refresh,
      addOfferToCart,
      removeItem,
    }),
    [addOfferToCart, items, open, refresh, removeItem],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      <CartFloating />
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

