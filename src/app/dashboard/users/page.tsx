"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  is_admin: boolean;
  banned_until: string | null;
  created_at: string;
};

function isBanned(bannedUntil: string | null) {
  if (!bannedUntil) return false;
  return new Date(bannedUntil).getTime() > Date.now();
}

export default function DashboardUsers() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        router.push("/join?mode=login");
        setRows([]);
        setCount(0);
        return;
      }

      const url = new URL("/api/admin/users", window.location.origin);
      if (q.trim()) url.searchParams.set("q", q.trim());
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        setError(res.status === 403 ? "Not authorized." : "Request failed.");
        setRows([]);
        setCount(0);
        return;
      }

      const json = (await res.json()) as { items: ProfileRow[]; count: number };
      setRows(json.items ?? []);
      setCount(json.count ?? 0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredCount = useMemo(() => rows.length, [rows]);

  return (
    <div className="bg-white border border-outline/60 shadow-soft-xl overflow-hidden">
      <div className="p-8 border-b border-outline/40">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
          <div>
            <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
              Users
            </div>
            <h1 className="font-headline text-4xl font-extrabold text-primary tracking-tighter">
              User Management
            </h1>
            <p className="text-on-surface-variant font-medium mt-3">
              Total: {count} • Shown: {filteredCount}
            </p>
          </div>
          <div className="flex gap-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by email/name/phone"
              className="h-12 w-[320px] max-w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
            />
            <button
              type="button"
              onClick={load}
              className="h-12 px-6 bg-primary text-white font-bold text-sm hover:bg-slate-800 transition-colors"
            >
              Search
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="p-6 border-b border-outline/40 bg-rose-50 text-rose-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="p-10 text-on-surface-variant font-medium">Loading…</div>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-variant">
              <tr className="text-xs uppercase tracking-widest text-on-surface-variant font-bold">
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Phone</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Created</th>
                <th className="px-6 py-4" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const banned = isBanned(r.banned_until);
                return (
                  <tr key={r.id} className="border-t border-outline/40">
                    <td className="px-6 py-5">
                      <div className="text-sm font-extrabold text-primary">
                        {r.full_name || "—"}
                      </div>
                      <div className="text-xs text-on-surface-variant font-medium mt-1">
                        {r.email || r.id}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-sm text-on-surface-variant font-medium">
                      {r.phone || "—"}
                    </td>
                    <td className="px-6 py-5">
                      {r.is_admin ? (
                        <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-[10px] font-black tracking-[0.2em] uppercase">
                          Admin
                        </span>
                      ) : banned ? (
                        <span className="px-3 py-1 bg-rose-100 text-rose-800 text-[10px] font-black tracking-[0.2em] uppercase">
                          Banned
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black tracking-[0.2em] uppercase">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-sm text-on-surface-variant font-medium">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <Link
                        href={`/dashboard/users/${r.id}`}
                        className="text-sm font-bold text-primary hover:text-secondary transition-colors"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
