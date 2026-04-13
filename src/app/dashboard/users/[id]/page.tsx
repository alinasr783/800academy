"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  bio: string | null;
  avatar_url: string | null;
  banned_until: string | null;
  ban_reason: string | null;
  created_at: string;
};

type EntitlementRow = {
  id: string;
  subject_id: string;
  access_expires_at: string;
  order_item_id: string | null;
  created_at: string;
  subjects: { id: string; slug: string; title: string; track: string | null } | null;
};

type ProgressRow = { subject_id: string; total_exams: number; passed_exams: number; percent: number };

function isoToDateInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function dateInputToIso(value: string) {
  const s = value.trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function DashboardUserDetails() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const userId = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [entitlements, setEntitlements] = useState<EntitlementRow[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [banReason, setBanReason] = useState("");
  const [banUntil, setBanUntil] = useState("");

  const banned = useMemo(() => {
    if (!profile?.banned_until) return false;
    return new Date(profile.banned_until).getTime() > Date.now();
  }, [profile?.banned_until]);

  const progressBySubject = useMemo(() => {
    const map = new Map<string, ProgressRow>();
    for (const p of progress) map.set(p.subject_id, p);
    return map;
  }, [progress]);

  const entitlementsSorted = useMemo(() => {
    return entitlements
      .slice()
      .sort((a, b) => b.access_expires_at.localeCompare(a.access_expires_at));
  }, [entitlements]);

  async function adminFetch(path: string, init?: RequestInit) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("Not authenticated.");
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
    setMessage(null);
    try {
      const json = (await adminFetch(`/api/admin/users/${userId}`)) as {
        profile: ProfileRow;
        entitlements: EntitlementRow[];
        progress: ProgressRow[];
      };
      setProfile(json.profile);
      setFullName(json.profile.full_name ?? "");
      setPhone(json.profile.phone ?? "");
      setBio(json.profile.bio ?? "");
      setBanReason(json.profile.ban_reason ?? "");
      setBanUntil(isoToDateInput(json.profile.banned_until));
      setEntitlements(json.entitlements ?? []);
      setProgress(json.progress ?? []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [userId]);

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const json = (await adminFetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({
          full_name: fullName || null,
          phone: phone || null,
          bio: bio || null,
          ban_reason: banReason || null,
        }),
      })) as { profile: ProfileRow };
      setProfile(json.profile);
      setMessage("Saved.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function ban() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await adminFetch(`/api/admin/users/${userId}`, {
        method: "POST",
        body: JSON.stringify({
          action: "ban",
          ban_reason: banReason || null,
          ban_until: dateInputToIso(banUntil),
        }),
      });
      await load();
      setMessage("User banned.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function unban() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await adminFetch(`/api/admin/users/${userId}`, {
        method: "POST",
        body: JSON.stringify({ action: "unban" }),
      });
      await load();
      setMessage("User unbanned.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser() {
    const ok = window.confirm("Delete this user permanently?");
    if (!ok) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await adminFetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      router.push("/dashboard/users");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-outline/60 shadow-soft-xl overflow-hidden">
      <div className="p-8 border-b border-outline/40">
        <div className="flex items-start justify-between gap-8">
          <div>
            <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
              User
            </div>
            <h1 className="font-headline text-4xl font-extrabold text-primary tracking-tighter">
              User Details
            </h1>
            <p className="text-on-surface-variant font-medium mt-3">
              {profile?.email ?? userId}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={deleteUser}
              disabled={saving}
              className="bg-white text-rose-700 border border-rose-200 px-6 py-3 font-bold text-sm hover:bg-rose-50 transition-all disabled:opacity-60"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="p-6 border-b border-outline/40 bg-rose-50 text-rose-700">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="p-6 border-b border-outline/40 bg-surface-variant text-on-surface">
          {message}
        </div>
      ) : null}

      {loading ? (
        <div className="p-10 text-on-surface-variant font-medium">Loading…</div>
      ) : (
        <div className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center gap-5 bg-surface-variant border border-outline/40 p-6">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name || profile.email || "User avatar"}
                  className="h-16 w-16 rounded-full object-cover border border-outline/60"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-white border border-outline/60 flex items-center justify-center text-primary font-extrabold">
                  {(profile?.full_name?.trim()?.[0] || profile?.email?.trim()?.[0] || "U").toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-primary">
                  {profile?.full_name || "—"}
                </div>
                <div className="text-xs text-on-surface-variant font-medium mt-1 truncate">
                  {profile?.email || userId}
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">
                Full name
              </div>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
              />
            </div>
            <div>
              <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">
                Phone
              </div>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-12 w-full px-4 bg-background border border-border/60 focus:border-primary outline-none transition-colors"
              />
            </div>
            <div>
              <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">
                Bio
              </div>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={5}
                className="w-full px-4 py-3 bg-background border border-border/60 focus:border-primary outline-none transition-colors resize-none"
              />
            </div>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="bg-secondary text-white px-8 py-4 font-bold text-sm hover:bg-primary transition-all rounded-full disabled:opacity-60"
            >
              Save changes
            </button>

            <div className="bg-white border border-outline/60 shadow-soft-xl overflow-hidden">
              <div className="p-6 border-b border-outline/40">
                <div className="text-xs font-bold text-primary uppercase tracking-widest">
                  Subscriptions
                </div>
              </div>
              {entitlementsSorted.length === 0 ? (
                <div className="p-8 text-on-surface-variant font-medium">No subscriptions.</div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-left">
                    <thead className="bg-surface-variant">
                      <tr className="text-xs uppercase tracking-widest text-on-surface-variant font-bold">
                        <th className="px-6 py-4">Package</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Expires</th>
                        <th className="px-6 py-4">Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entitlementsSorted.map((e) => {
                        const active = new Date(e.access_expires_at).getTime() >= Date.now();
                        const p = progressBySubject.get(e.subject_id);
                        return (
                          <tr key={e.id} className="border-t border-outline/40">
                            <td className="px-6 py-5">
                              <div className="text-sm font-extrabold text-primary">
                                {e.subjects?.title || "—"}
                              </div>
                              <div className="text-xs text-on-surface-variant font-medium mt-1">
                                {e.subjects?.track || e.subjects?.slug || e.subject_id}
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              {active ? (
                                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black tracking-[0.2em] uppercase">
                                  Active
                                </span>
                              ) : (
                                <span className="px-3 py-1 bg-slate-100 text-slate-800 text-[10px] font-black tracking-[0.2em] uppercase">
                                  Expired
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-5 text-sm text-on-surface-variant font-medium">
                              {new Date(e.access_expires_at).toLocaleString()}
                            </td>
                            <td className="px-6 py-5">
                              {p ? (
                                <div>
                                  <div className="text-sm font-extrabold text-primary">
                                    {p.percent}%
                                  </div>
                                  <div className="text-xs text-on-surface-variant font-medium mt-1">
                                    Passed: {p.passed_exams}/{p.total_exams}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-sm text-on-surface-variant font-medium">—</div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="bg-surface-variant border border-outline/40 p-6">
              <div className="text-xs font-bold text-primary uppercase tracking-widest mb-4">
                Ban settings
              </div>
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">
                    Ban until
                  </div>
                  <input
                    value={banUntil}
                    onChange={(e) => setBanUntil(e.target.value)}
                    type="date"
                    className="h-12 w-full px-4 bg-white border border-outline/60 focus:border-primary outline-none transition-colors"
                  />
                </div>
                <div>
                  <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">
                    Ban reason
                  </div>
                  <textarea
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 bg-white border border-outline/60 focus:border-primary outline-none transition-colors resize-none"
                  />
                </div>
                <div className="text-xs text-on-surface-variant font-medium">
                  Status: {banned ? "Banned" : "Active"}
                </div>
                {banned ? (
                  <button
                    type="button"
                    onClick={unban}
                    disabled={saving}
                    className="h-12 w-full bg-white text-primary border border-outline font-bold text-sm hover:bg-surface-variant transition-all disabled:opacity-60"
                  >
                    Unban
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={ban}
                    disabled={saving}
                    className="h-12 w-full bg-primary text-white font-bold text-sm hover:bg-slate-800 transition-all disabled:opacity-60"
                  >
                    Ban
                  </button>
                )}
              </div>
            </div>

            <div className="bg-surface-variant border border-outline/40 p-6">
              <div className="text-xs font-bold text-primary uppercase tracking-widest mb-4">
                Meta
              </div>
              <div className="text-sm text-on-surface-variant font-medium">
                Created: {profile ? new Date(profile.created_at).toLocaleString() : "—"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
