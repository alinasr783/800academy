"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import motivations from "@/data/motivations.json";
import BackButton from "@/components/BackButton";
import Breadcrumbs from "@/components/Breadcrumbs";

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  bio: string | null;
  avatar_url: string | null;
};

type EntitlementRow = {
  id: string;
  subject_id: string;
  access_expires_at: string;
  subjects: {
    title: string;
    slug: string;
    track: string | null;
  } | null;
};

type AttemptRow = {
  id: string;
  exam_id: string;
  score: number;
  duration_seconds: number;
  submitted_at: string;
  exams: {
    id: string;
    subject_id: string;
    exam_number: number;
    title: string;
  } | null;
};

type OrderRow = {
  id: string;
  status: string;
  currency: string;
  total_cents: number;
  created_at: string;
};

function formatMoney(cents: number, currency: string) {
  const value = cents / 100;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function daysUntil(dateStr: string) {
  const now = Date.now();
  const target = new Date(dateStr).getTime();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

export default function ProfileClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const avatarBucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "assets";

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [entitlements, setEntitlements] = useState<EntitlementRow[]>([]);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  const [quote, setQuote] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    const q = motivations[Math.floor(Math.random() * motivations.length)] ?? "";
    setQuote(q);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function run() {
      setError(null);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push("/join?mode=login");
        return;
      }

      const userId = sessionData.session.user.id;

      const { data: profileRow, error: profileErr } = await supabase
        .from("profiles")
        .select("id, email, full_name, phone, bio, avatar_url")
        .eq("id", userId)
        .single<ProfileRow>();

      const { data: entRows } = await supabase
        .from("entitlements")
        .select("id, subject_id, access_expires_at, subjects(title, slug, track)")
        .order("access_expires_at", { ascending: true })
        .returns<EntitlementRow[]>();

      const { data: attRows } = await supabase
        .from("exam_attempts")
        .select(
          "id, exam_id, score, duration_seconds, submitted_at, exams(id, subject_id, exam_number, title)",
        )
        .order("submitted_at", { ascending: false })
        .limit(500)
        .returns<AttemptRow[]>();

      const { data: orderRows } = await supabase
        .from("orders")
        .select("id, status, currency, total_cents, created_at")
        .order("created_at", { ascending: false })
        .limit(50)
        .returns<OrderRow[]>();

      if (!mounted) return;

      if (profileErr) {
        setError(profileErr.message);
      } else {
        setProfile(profileRow ?? null);
        setFullName(profileRow?.full_name ?? "");
        setPhone(profileRow?.phone ?? "");
        setBio(profileRow?.bio ?? "");
      }

      setEntitlements(entRows ?? []);
      setAttempts(attRows ?? []);
      setOrders(orderRows ?? []);
      setLoading(false);
    }

    run();
    return () => {
      mounted = false;
    };
  }, [router]);

  const activeEntitlements = useMemo(() => {
    const now = Date.now();
    return entitlements
      .filter((e) => new Date(e.access_expires_at).getTime() >= now)
      .map((e) => ({
        ...e,
        daysLeft: daysUntil(e.access_expires_at),
      }))
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [entitlements]);

  const expiringSoon = useMemo(() => {
    return activeEntitlements.filter((e) => e.daysLeft <= 7);
  }, [activeEntitlements]);

  const attemptsBySubject = useMemo(() => {
    const map = new Map<string, AttemptRow[]>();
    for (const a of attempts) {
      const subjectId = a.exams?.subject_id;
      if (!subjectId) continue;
      const list = map.get(subjectId) ?? [];
      list.push(a);
      map.set(subjectId, list);
    }
    return map;
  }, [attempts]);

  const completedExamCountBySubject = useMemo(() => {
    const map = new Map<string, number>();
    for (const [subjectId, list] of attemptsBySubject) {
      const unique = new Set<string>();
      for (const a of list) unique.add(a.exam_id);
      map.set(subjectId, unique.size);
    }
    return map;
  }, [attemptsBySubject]);

  const progressPercentBySubject = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of activeEntitlements) {
      const completed = completedExamCountBySubject.get(e.subject_id) ?? 0;
      map.set(e.subject_id, clampPercent(completed * 5));
    }
    return map;
  }, [activeEntitlements, completedExamCountBySubject]);

  async function onSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push("/join?mode=login");
        return;
      }
      const userId = sessionData.session.user.id;

      const { error: upErr } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
          bio: bio.trim() || null,
        })
        .eq("id", userId);

      if (upErr) throw upErr;
      setMessage("Profile updated.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function onUploadAvatar(file: File) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push("/join?mode=login");
        return;
      }
      const userId = sessionData.session.user.id;

      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `avatars/${userId}/${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(avatarBucket)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const publicUrl = supabase.storage.from(avatarBucket).getPublicUrl(path).data.publicUrl;

      const { error: profErr } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);
      if (profErr) throw profErr;

      setProfile((p) => (p ? { ...p, avatar_url: publicUrl } : p));
      setMessage("Avatar updated.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function onLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) {
    return (
      <section className="max-w-[1440px] mx-auto px-8 lg:px-12 py-20">
        <div className="bg-surface-variant border border-outline/40 p-10 text-on-surface-variant font-medium">
          Loading…
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-[1440px] mx-auto px-8 lg:px-12 py-20">
      <div className="flex items-center justify-between gap-6 mb-8">
        <BackButton fallbackHref="/" />
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "My Account" }]} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-4">
          <div className="bg-white border border-outline/60 shadow-soft-xl p-8">
            <div className="flex items-start justify-between gap-6">
              <div className="flex items-center gap-4">
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUploadAvatar(f);
                    e.currentTarget.value = "";
                  }}
                />

                <label
                  htmlFor="avatar-upload"
                  className="w-16 h-16 bg-surface-variant border border-outline/40 overflow-hidden rounded-full flex items-center justify-center cursor-pointer group"
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.full_name ?? "Avatar"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-primary text-[28px]">
                      person
                    </span>
                  )}
                </label>
                <div>
                  <div className="text-xl font-extrabold text-primary tracking-tight">
                    {profile?.full_name || "Your Profile"}
                  </div>
                  <div className="text-xs text-on-surface-variant font-medium mt-1">
                    {profile?.email ?? ""}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="text-xs font-bold text-on-surface-variant hover:text-primary transition-colors"
              >
                Logout
              </button>
            </div>

            <div className="mt-8">
              <div className="text-xs font-bold text-primary uppercase tracking-widest mb-3">
                Motivation
              </div>
              <div className="bg-surface-variant border border-outline/40 p-5 text-sm text-on-surface leading-relaxed font-medium">
                {quote}
              </div>
            </div>

            <div className="mt-8 space-y-5">
              <div>
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">
                  Full name
                </div>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-white border border-outline px-4 py-3 text-sm focus:ring-1 focus:ring-primary outline-none btn-sharp"
                  placeholder="Your name"
                />
              </div>

              <div>
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">
                  Phone
                </div>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-white border border-outline px-4 py-3 text-sm focus:ring-1 focus:ring-primary outline-none btn-sharp"
                  placeholder="+20…"
                />
              </div>

              <div>
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">
                  Bio
                </div>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  className="w-full bg-white border border-outline px-4 py-3 text-sm focus:ring-1 focus:ring-primary outline-none btn-sharp resize-none"
                  placeholder="A short bio"
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <label
                  htmlFor="avatar-upload"
                  className="bg-white text-primary border border-outline px-4 py-3 text-xs font-bold hover:bg-surface-variant transition-all btn-sharp cursor-pointer"
                >
                  Upload avatar
                </label>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={saving}
                  className="bg-primary text-white px-6 py-3 text-xs font-bold hover:bg-slate-800 transition-all btn-sharp disabled:opacity-60"
                >
                  Save
                </button>
              </div>

              {error ? (
                <div className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}
              {message ? (
                <div className="border border-outline/60 bg-surface-variant px-4 py-3 text-sm text-on-surface">
                  {message}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-10">
          <div className="bg-white border border-outline/60 shadow-soft-xl p-8">
            <div className="flex items-end justify-between gap-8 mb-8">
              <div>
                <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
                  Access
                </div>
                <h2 className="font-headline text-4xl font-extrabold text-primary tracking-tighter">
                  Active Subscriptions
                </h2>
              </div>
              <div className="text-xs uppercase tracking-widest text-on-surface-variant font-bold">
                {expiringSoon.length ? `${expiringSoon.length} expiring soon` : "All good"}
              </div>
            </div>

            {activeEntitlements.length ? (
              <div className="space-y-6">
                {activeEntitlements.map((e) => {
                  const percent = progressPercentBySubject.get(e.subject_id) ?? 0;
                  const soon = e.daysLeft <= 7;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => {
                        const slug = e.subjects?.slug;
                        if (!slug) return;
                        router.push(`/subjects/${slug}?focus=exams&hideOffers=1`);
                      }}
                      className={
                        soon
                          ? "border border-amber-200 bg-amber-50/40 p-6"
                          : "border border-outline/60 bg-surface-variant/30 p-6"
                      }
                    >
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.2em] font-black text-on-surface-variant">
                            {e.subjects?.track ?? "Subject"}
                          </div>
                          <div className="text-2xl font-extrabold text-primary mt-2 tracking-tight">
                            {e.subjects?.title ?? "Subscription"}
                          </div>
                          <div className="text-sm text-on-surface-variant font-medium mt-2">
                            Expires in {e.daysLeft} day{e.daysLeft === 1 ? "" : "s"}
                          </div>
                        </div>

                        <div className="min-w-[260px]">
                          <div className="flex items-center justify-between text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">
                            <span>Progress</span>
                            <span>{percent}%</span>
                          </div>
                          <div className="h-3 bg-white border border-outline/60 overflow-hidden">
                            <div
                              className="h-full bg-secondary"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <div className="text-xs text-on-surface-variant font-medium mt-2">
                            {Math.round(percent / 5)} / 20 exams submitted
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="border border-outline/60 bg-surface-variant px-6 py-10 text-on-surface-variant font-medium">
                No active subscriptions yet.
              </div>
            )}
          </div>

          <div className="bg-white border border-outline/60 shadow-soft-xl p-8">
            <div className="flex items-end justify-between gap-8 mb-8">
              <div>
                <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
                  History
                </div>
                <h2 className="font-headline text-4xl font-extrabold text-primary tracking-tighter">
                  Previous Orders
                </h2>
              </div>
            </div>

            {orders.length ? (
              <div className="space-y-4">
                {orders.map((o) => (
                  <div
                    key={o.id}
                    className="border border-outline/60 bg-surface-variant/30 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                  >
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em] font-black text-on-surface-variant">
                        {new Date(o.created_at).toLocaleDateString()}
                      </div>
                      <div className="text-sm font-extrabold text-primary mt-2 tracking-tight">
                        Order {o.id.slice(0, 8).toUpperCase()}
                      </div>
                      <div className="text-xs text-on-surface-variant font-medium mt-1">
                        Status: {o.status}
                      </div>
                    </div>
                    <div className="text-2xl font-extrabold text-primary">
                      {formatMoney(o.total_cents, o.currency)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-outline/60 bg-surface-variant px-6 py-10 text-on-surface-variant font-medium">
                No orders yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
