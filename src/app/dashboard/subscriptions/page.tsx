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
  const [userSearch, setUserSearch] = useState("");
  const [userChoices, setUserChoices] = useState<UserLite[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [subjectChoices, setSubjectChoices] = useState<SubjectRow[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
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
    if (!expiresAt.trim()) {
      setError("Select an expiry date.");
      return;
    }
    const d = new Date(`${expiresAt}T23:59:59.999Z`);
    if (Number.isNaN(d.getTime())) {
      setError("Invalid expiry date.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/subscriptions`, {
        method: "POST",
        body: JSON.stringify({
          action: "manual_add",
          user_id: selectedUserId,
          subject_id: selectedSubjectId,
          access_expires_at: d.toISOString(),
        }),
      });
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
              Subscription Management
            </h1>
            <p className="text-on-surface-variant font-medium mt-3">
              Active: {count} • Shown: {shown}
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
              className="h-12 px-6 bg-secondary text-white font-bold text-sm hover:bg-primary transition-colors"
            >
              Add Subscription
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="p-6 border-b border-outline/40 bg-rose-50 text-rose-700">{error}</div>
      ) : null}

      <div className="p-8 border-b border-outline/40">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7">
            <div className="text-xs font-bold text-primary uppercase tracking-widest mb-4">
              Revenue stats
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-surface-variant border border-outline/40 p-6">
                <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                  Last 7 days
                </div>
                <div className="font-headline text-2xl font-extrabold text-primary mt-3">
                  {fmtMoney(stats?.revenue.last7DaysCents ?? 0)}
                </div>
              </div>
              <div className="bg-surface-variant border border-outline/40 p-6">
                <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                  Last 30 days
                </div>
                <div className="font-headline text-2xl font-extrabold text-primary mt-3">
                  {fmtMoney(stats?.revenue.last30DaysCents ?? 0)}
                </div>
              </div>
              <div className="bg-surface-variant border border-outline/40 p-6">
                <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                  Last 90 days
                </div>
                <div className="font-headline text-2xl font-extrabold text-primary mt-3">
                  {fmtMoney(stats?.revenue.last90DaysCents ?? 0)}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5" />
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-on-surface-variant font-medium">Loading…</div>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-variant">
              <tr className="text-xs uppercase tracking-widest text-on-surface-variant font-bold">
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Package</th>
                <th className="px-6 py-4">Expires</th>
                <th className="px-6 py-4">Source</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t border-outline/40">
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
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative w-full max-w-2xl bg-white border border-outline/60 shadow-soft-xl overflow-hidden">
            <div className="p-6 border-b border-outline/40 flex items-center justify-between gap-4">
              <div className="text-sm font-extrabold text-primary">Add manual subscription</div>
              <button
                type="button"
                onClick={() => setManualOpen(false)}
                className="text-sm font-bold text-on-surface-variant hover:text-primary transition-colors"
              >
                Close
              </button>
            </div>
            {error ? (
              <div className="p-5 border-b border-outline/40 bg-rose-50 text-rose-700">{error}</div>
            ) : null}
            <div className="p-6 space-y-4">
              <div>
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">
                  User (email/name)
                </div>
                <input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="student@email.com"
                  className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
                />
                {userChoices.length ? (
                  <div className="mt-2 border border-outline/40 bg-white max-h-44 overflow-auto">
                    {userChoices.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setSelectedUserId(u.id);
                          setUserSearch(u.email ?? u.full_name ?? u.id);
                          setUserChoices([]);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-surface-variant transition-colors"
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
                  className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
                >
                  {subjectChoices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">
                  Access expires at
                </div>
                <input
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  type="date"
                  className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
                />
                <div className="text-xs text-on-surface-variant font-medium mt-2">
                  Stored as end-of-day UTC to avoid expiring immediately.
                </div>
              </div>

              <button
                type="button"
                onClick={createManual}
                disabled={creating || !selectedUserId || !selectedSubjectId || !expiresAt.trim()}
                className="h-12 w-full bg-primary text-white font-bold text-sm hover:bg-slate-800 transition-colors disabled:opacity-60"
              >
                Add subscription
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
