"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ActiveItem = {
  id: string;
  user_id: string;
  subject_id: string;
  access_expires_at: string;
  order_item_id: string | null;
  created_at: string;
  user: { id: string; email: string | null; full_name: string | null } | null;
  subject: { id: string; slug: string; title: string; track: string | null } | null;
};

type RevenueStats = {
  revenue: { last7DaysCents: number; last30DaysCents: number; last90DaysCents: number };
  activeSubscriptions: number;
};

type UserLite = { id: string; email: string | null; full_name: string | null; phone: string | null; is_admin: boolean; banned_until: string | null; created_at: string };

type SubjectRow = { id: string; slug: string; title: string; track: string | null; description: string | null; created_at: string };

type OfferRow = { id: string; label: string; price_cents: number; currency: string; expires_at: string };

function fmtMoney(cents: number, currency = "EGP") {
  const n = Number.isFinite(cents) ? cents : 0;
  return `${(n / 100).toFixed(2)} ${currency}`;
}

export default function DashboardSubscriptions() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<RevenueStats | null>(null);
  const [items, setItems] = useState<ActiveItem[]>([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [addMode, setAddMode] = useState<"subscription" | "entitlement">("subscription");
  const [userSearch, setUserSearch] = useState("");
  const [userChoices, setUserChoices] = useState<UserLite[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [subjectChoices, setSubjectChoices] = useState<SubjectRow[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");

  // For Subscription mode
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string>("");

  // For Entitlement mode
  const [expiresAt, setExpiresAt] = useState("");

  let cachedToken: string | null = null;

  async function getToken() {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("Not authenticated.");
    cachedToken = token;
    return token;
  }

  async function adminFetch(path: string, init?: RequestInit) {
    const token = cachedToken || await getToken();
    const res = await fetch(path, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "Request failed");
    return json;
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();

      const url = new URL("/api/admin/subscriptions", window.location.origin);
      url.searchParams.set("kind", "active");
      if (q.trim()) url.searchParams.set("q", q.trim());
      const [statsRes, activeRes, subjectsRes] = await Promise.all([
        fetch(`/api/admin/subscriptions?kind=stats`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/admin/packages?limit=200`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const statsJson = (await statsRes.json().catch(() => ({}))) as RevenueStats & { error?: string };
      const activeJson = (await activeRes.json().catch(() => ({}))) as { items?: ActiveItem[]; count?: number; error?: string };
      const subjectsJson = (await subjectsRes.json().catch(() => ({}))) as { items?: SubjectRow[]; error?: string };

      if (!statsRes.ok) throw new Error(statsJson.error ?? "Failed to load stats.");
      if (!activeRes.ok) throw new Error(activeJson.error ?? "Failed to load subscriptions.");
      if (!subjectsRes.ok) throw new Error(subjectsJson.error ?? "Failed to load packages.");

      setStats(statsJson);
      setItems(activeJson.items ?? []);
      setCount(activeJson.count ?? 0);
      const list = (subjectsJson.items ?? []).slice().sort((a, b) => a.title.localeCompare(b.title));
      setSubjectChoices(list);
      if (!selectedSubjectId && list.length) setSelectedSubjectId(list[0].id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // Load offers when subject changes
  useEffect(() => {
    async function loadOffers() {
      if (!selectedSubjectId) {
        setOffers([]);
        setSelectedOfferId("");
        return;
      }
      try {
        const json = await adminFetch(`/api/admin/subscriptions?kind=offers&subject_id=${selectedSubjectId}`);
        const data = json.items ?? [];
        setOffers(data);
        if (data.length > 0) setSelectedOfferId(data[0].id);
        else setSelectedOfferId("");
      } catch (e) {
        console.error("Failed to fetch offers", e);
        setOffers([]);
        setSelectedOfferId("");
      }
    }
    loadOffers();
  }, [selectedSubjectId]);

  async function searchUsers() {
    setError(null);
    try {
      if (!userSearch.trim()) {
        setUserChoices([]);
        return;
      }
      const json = (await adminFetch(`/api/admin/users?q=${encodeURIComponent(userSearch.trim())}&limit=10`)) as {
        items: UserLite[];
        count: number;
      };
      setUserChoices(json.items ?? []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    }
  }

  async function createManual() {
    if (!selectedUserId) {
      setError("Select a user.");
      return;
    }
    if (!selectedSubjectId) {
      setError("Select a package.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      if (addMode === "subscription") {
        if (!selectedOfferId) throw new Error("Select an offer.");
        await adminFetch(`/api/admin/subscriptions`, {
          method: "POST",
          body: JSON.stringify({
            action: "manual_subscribe",
            user_id: selectedUserId,
            subject_id: selectedSubjectId,
            offer_id: selectedOfferId,
          }),
        });
      } else {
        if (!expiresAt.trim()) throw new Error("Select an expiry date.");
        const d = new Date(`${expiresAt}T23:59:59.999Z`);
        if (Number.isNaN(d.getTime())) throw new Error("Invalid expiry date.");
        await adminFetch(`/api/admin/subscriptions`, {
          method: "POST",
          body: JSON.stringify({
            action: "manual_add",
            user_id: selectedUserId,
            subject_id: selectedSubjectId,
            access_expires_at: d.toISOString(),
          }),
        });
      }

      setExpiresAt("");
      setSelectedUserId(null);
      setUserSearch("");
      setUserChoices([]);
      await load();
      setManualOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setCreating(false);
    }
  }

  async function cancelEntitlement(id: string) {
    if (!confirm("Are you sure you want to cancel this user's access?")) return;
    try {
      await adminFetch(`/api/admin/subscriptions`, {
        method: "POST",
        body: JSON.stringify({
          action: "cancel_entitlement",
          id: id,
        }),
      });
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      alert(msg);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      searchUsers();
    }, 300);
    return () => clearTimeout(t);
  }, [userSearch]);

  const shown = useMemo(() => items.length, [items]);

  return (
    <div className="bg-white border border-outline/60 shadow-soft-xl overflow-hidden">
      <div className="p-8 border-b border-outline/40">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
          <div>
            <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
              Subscriptions
            </div>
            <h1 className="font-headline text-4xl font-extrabold text-primary tracking-tighter">
              Subscriptions
            </h1>
            <p className="text-on-surface-variant font-medium mt-3">
              Active Access: {count} • Shown: {shown}
            </p>
          </div>
          <div className="flex gap-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by user or package"
              className="h-12 w-[320px] max-w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
            />
            <button
              type="button"
              onClick={load}
              className="h-12 px-6 bg-primary text-white font-bold text-sm hover:bg-slate-800 transition-colors"
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setUserSearch("");
                setUserChoices([]);
                setSelectedUserId(null);
                setExpiresAt("");
                setManualOpen(true);
              }}
              className="h-12 px-6 bg-secondary text-white font-bold text-sm hover:bg-primary transition-colors whitespace-nowrap"
            >
              Add Sub/Access
            </button>
          </div>
        </div>
      </div>

      {error && !manualOpen ? (
        <div className="p-6 border-b border-outline/40 bg-rose-50 text-rose-700">{error}</div>
      ) : null}

      <div className="p-8 border-b border-outline/40">
        <div className="grid grid-cols-1 gap-6">
          <div className="w-full">
            <div className="text-xs font-bold text-primary uppercase tracking-widest mb-4">
              Revenue stats
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-surface-variant border border-outline/40 p-6 rounded-xl">
                <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                  Last 7 days
                </div>
                <div className="font-headline text-2xl font-extrabold text-primary mt-3">
                  {fmtMoney(stats?.revenue.last7DaysCents ?? 0)}
                </div>
              </div>
              <div className="bg-surface-variant border border-outline/40 p-6 rounded-xl">
                <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                  Last 30 days
                </div>
                <div className="font-headline text-2xl font-extrabold text-primary mt-3">
                  {fmtMoney(stats?.revenue.last30DaysCents ?? 0)}
                </div>
              </div>
              <div className="bg-surface-variant border border-outline/40 p-6 rounded-xl">
                <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                  Last 90 days
                </div>
                <div className="font-headline text-2xl font-extrabold text-primary mt-3">
                  {fmtMoney(stats?.revenue.last90DaysCents ?? 0)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-on-surface-variant font-medium">Loading…</div>
      ) : (
        <div className="overflow-auto min-h-[400px]">
          <table className="w-full text-left">
            <thead className="bg-surface-variant">
              <tr className="text-xs uppercase tracking-widest text-on-surface-variant font-bold">
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Package</th>
                <th className="px-6 py-4">Expires</th>
                <th className="px-6 py-4">Source</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t border-outline/40 hover:bg-surface-variant/30 transition-colors">
                  <td className="px-6 py-5">
                    <div className="text-sm font-extrabold text-primary">
                      {it.user?.full_name || "—"}
                    </div>
                    <div className="text-xs text-on-surface-variant font-medium mt-1">
                      {it.user?.email || it.user_id}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-sm font-extrabold text-primary">
                      {it.subject?.title || "—"}
                    </div>
                    <div className="text-xs text-on-surface-variant font-medium mt-1">
                      {it.subject?.track || it.subject?.slug || it.subject_id}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-sm text-on-surface-variant font-medium">
                    {new Date(it.access_expires_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-5">
                    {it.order_item_id ? (
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black tracking-[0.2em] uppercase">
                        Purchase
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-[10px] font-black tracking-[0.2em] uppercase">
                        Manual
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button
                      onClick={() => cancelEntitlement(it.id)}
                      className="px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold text-xs uppercase tracking-widest rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {manualOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <button
            type="button"
            onClick={() => setManualOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-2xl bg-white border border-outline/60 shadow-2xl overflow-hidden rounded-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-outline/40 flex items-center justify-between gap-4 bg-surface-variant/30">
              <div className="text-lg font-extrabold text-primary font-headline">Add Subscription / Access</div>
              <button
                type="button"
                onClick={() => setManualOpen(false)}
                className="text-sm font-bold text-on-surface-variant hover:text-primary transition-colors"
              >
                Close
              </button>
            </div>
            {error ? (
              <div className="p-5 border-b border-rose-200 bg-rose-50 text-rose-700 font-medium">{error}</div>
            ) : null}

            <div className="p-6">
              {/* Type Switcher */}
              <div className="flex bg-surface-variant p-1 rounded-xl mb-6">
                <button
                  onClick={() => setAddMode("subscription")}
                  className={`flex-1 py-3 text-sm font-bold rounded-lg transition-colors ${addMode === "subscription" ? "bg-white text-primary shadow-sm" : "text-on-surface-variant hover:text-primary"}`}
                >
                  Paid Subscription
                </button>
                <button
                  onClick={() => setAddMode("entitlement")}
                  className={`flex-1 py-3 text-sm font-bold rounded-lg transition-colors ${addMode === "entitlement" ? "bg-white text-primary shadow-sm" : "text-on-surface-variant hover:text-primary"}`}
                >
                  Raw Entitlement
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">
                    User (email/name)
                  </div>
                  <input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="student@email.com"
                    className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors rounded-xl"
                  />
                  {userChoices.length ? (
                    <div className="mt-2 border border-outline/40 bg-white max-h-44 overflow-auto rounded-xl shadow-md absolute z-10 w-[calc(100%-3rem)]">
                      {userChoices.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setSelectedUserId(u.id);
                            setUserSearch(u.email ?? u.full_name ?? u.id);
                            setUserChoices([]);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-surface-variant transition-colors border-b border-outline/30 last:border-0"
                        >
                          <div className="text-sm font-extrabold text-primary">{u.full_name || "—"}</div>
                          <div className="text-xs text-on-surface-variant font-medium mt-1">
                            {u.email || u.id}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div>
                  <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Package</div>
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors rounded-xl"
                  >
                    {subjectChoices.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>

                {addMode === "subscription" ? (
                  <div>
                    <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Offer / Price</div>
                    <select
                      value={selectedOfferId}
                      onChange={(e) => setSelectedOfferId(e.target.value)}
                      className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors rounded-xl"
                    >
                      {offers.length === 0 && <option value="">No offers available for this package</option>}
                      {offers.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label} - {fmtMoney(o.price_cents, o.currency)} (Expires: {new Date(o.expires_at).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                    <div className="text-xs text-on-surface-variant font-medium mt-2">
                      This will create a transaction record, calculate revenue, and grant access automatically.
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">
                      Access expires at
                    </div>
                    <input
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      type="date"
                      className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors rounded-xl"
                    />
                    <div className="text-xs text-on-surface-variant font-medium mt-2">
                      Stored as end-of-day UTC. This grants raw access without generating a financial transaction.
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={createManual}
                  disabled={creating || !selectedUserId || !selectedSubjectId || (addMode === 'subscription' ? !selectedOfferId : !expiresAt.trim())}
                  className="h-14 mt-4 w-full bg-primary text-white font-bold text-sm hover:bg-slate-800 transition-colors disabled:opacity-60 rounded-xl"
                >
                  {addMode === "subscription" ? "Confirm Paid Subscription" : "Grant Access (Entitlement)"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
