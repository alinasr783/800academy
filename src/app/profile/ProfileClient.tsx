"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import motivations from "@/data/motivations.json";
import BackButton from "@/components/BackButton";
import Breadcrumbs from "@/components/Breadcrumbs";
import LoadingAnimation from "@/components/LoadingAnimation";
import Image from "next/image";

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
    subjects: { title: string; slug: string; track: string | null } | null;
  } | null;
};

type MistakeRow = {
  id: string;
  question_id: string;
  error_count: number;
  difficulty_score: number;
  added_at: string;
  exam_questions: {
    prompt_text: string | null;
    question_number: number;
    exams: {
      title: string;
      subjects: {
        title: string;
      } | null;
    } | null;
  } | null;
};

type PracticeSessionRow = {
  id: string;
  topic_ids: string[];
  total_questions: number;
  correct_questions: number;
  duration_seconds: number;
  target_accuracy: number;
  percent_correct: number;
  created_at: string;
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

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function getScoreStyles(score: number) {
  const percent = (score / 800) * 100;
  if (percent <= 50) {
    return {
      wrapper: "bg-rose-50 border-rose-200 text-rose-700",
      icon: "text-rose-500",
    };
  } else if (percent < 70) {
    return {
      wrapper: "bg-amber-50 border-amber-200 text-amber-700",
      icon: "text-amber-500",
    };
  } else if (percent < 85) {
    return {
      wrapper: "bg-blue-50 border-blue-200 text-blue-700",
      icon: "text-blue-500",
    };
  } else {
    return {
      wrapper: "bg-emerald-50 border-emerald-200 text-emerald-700",
      icon: "text-emerald-500",
    };
  }
}

export default function ProfileClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const avatarBucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "assets";

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [entitlements, setEntitlements] = useState<EntitlementRow[]>([]);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [mistakes, setMistakes] = useState<MistakeRow[]>([]);
  const [practiceSessions, setPracticeSessions] = useState<PracticeSessionRow[]>([]);
  const [allTopics, setAllTopics] = useState<{ id: string; title: string; subject_id: string }[]>([]);
  const [allSubtopics, setAllSubtopics] = useState<{ id: string; title: string; topic_id: string; subject_id: string }[]>([]);

  const [currentTab, setCurrentTab] = useState<"overview" | "mistakes" | "braingym">("overview");
  const [visibleMistakes, setVisibleMistakes] = useState(10);

  const [quote, setQuote] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");

  // Question Bank Wizard State
  const [gymTopics, setGymTopics] = useState<string[]>([]);
  const [gymSubtopics, setGymSubtopics] = useState<string[]>([]);
  const [gymLimit, setGymLimit] = useState(20);
  const [gymTime, setGymTime] = useState(15);
  const [gymTarget, setGymTarget] = useState(80);
  const [gymStep, setGymStep] = useState<1 | 2>(1);

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
          "id, exam_id, score, duration_seconds, submitted_at, exams(id, subject_id, exam_number, title, subjects(title, slug, track))",
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

      const { data: mistakeRows } = await supabase
        .from("mistake_bank")
        .select(`
          id,
          question_id,
          error_count,
          difficulty_score,
          added_at,
          exam_questions (
            prompt_text,
            question_number,
            exams (
              title,
              subjects (
                title
              )
            )
          )
        `)
        .eq("user_id", userId)
        .order("difficulty_score", { ascending: true })
        .limit(1000)
        .returns<MistakeRow[]>();

      const { data: gymRes } = await supabase.from("practice_sessions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

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

      // Shuffle mistakeRows with identical difficulty to maintain secondary arbitrary sort
      const finalMistakes = (mistakeRows ?? []).sort((a, b) => {
        if (a.difficulty_score === b.difficulty_score) {
          return Math.random() - 0.5;
        }
        return a.difficulty_score - b.difficulty_score;
      });
      setMistakes(finalMistakes);
      setPracticeSessions((gymRes as any) ?? []);

      setLoading(false);
    }

    run();
    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (currentTab !== 'braingym' || allTopics.length > 0) return;

    async function loadTopics() {
      const { data: topics } = await supabase.from('topics').select('id, title, subject_id');
      setAllTopics(topics ?? []);
      const { data: subtopics } = await supabase.from('subtopics').select('id, title, topic_id, subject_id');
      setAllSubtopics(subtopics ?? []);
    }
    loadTopics();
  }, [currentTab, allTopics.length]);

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

  /* Build a subject-title lookup from entitlements for the scores section */
  const subjectTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entitlements) {
      if (e.subjects?.title) {
        map.set(e.subject_id, e.subjects!.title);
      }
    }
    return map;
  }, [entitlements]);

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

  function startGymSession() {
    if (gymSubtopics.length === 0 && gymTopics.length === 0) {
      setError("Please select at least one topic or subtopic.");
      return;
    }
    const params = new URLSearchParams({
      topic_ids: gymTopics.join(","),
      subtopic_ids: gymSubtopics.join(","),
      limit: gymLimit.toString(),
      time: gymTime.toString(),
      target: gymTarget.toString()
    });
    router.push(`/profile/brain-gym/session?${params.toString()}`);
  }

  async function onLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) {
    return <LoadingAnimation fullScreen variant="official" />;
  }

  return (
    <section className="max-w-[1440px] mx-auto px-8 lg:px-12 py-8 md:py-10">
      <div className="flex items-center justify-between gap-6 mb-6">
        <BackButton fallbackHref="/" />
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "My Account" }]} />
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-8 bg-surface-variant/30 p-2 rounded-2xl w-full sm:w-fit">
        <button
          onClick={() => {
            setCurrentTab("overview");
            if (window.innerWidth < 1024) {
              document.getElementById('profile-content-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }}
          className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-sm font-extrabold transition-all outline-none ${currentTab === "overview"
            ? "bg-primary text-white shadow-md"
            : "text-on-surface-variant hover:bg-surface-variant hover:text-primary"
            }`}
        >
          Overview
        </button>
        <button
          onClick={() => {
            setCurrentTab("mistakes");
            if (window.innerWidth < 1024) {
              document.getElementById('profile-content-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }}
          className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-sm font-extrabold transition-all outline-none flex items-center justify-center gap-2 ${currentTab === "mistakes"
            ? "bg-rose-500 text-white shadow-md"
            : "text-on-surface-variant hover:bg-surface-variant hover:text-rose-500"
            }`}
        >
          Mistake Bank
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${currentTab === 'mistakes' ? 'bg-white/20' : 'bg-surface-variant text-on-surface-variant border border-outline/40'}`}>
            {mistakes.length}
          </span>
        </button>

        <button
          onClick={() => {
            setCurrentTab("braingym");
            if (window.innerWidth < 1024) {
              document.getElementById('profile-content-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }}
          className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-sm font-extrabold outline-none flex items-center justify-center gap-2 ${currentTab === "braingym"
            ? "bg-primary text-white shadow-md"
            : "text-on-surface-variant hover:bg-surface-variant hover:text-primary transition-all"
            }`}
        >
          <span className="material-symbols-outlined text-[20px]">fitness_center</span>
          Question Bank
        </button>
      </div>

      {/* ── No Active Plan Banner ── */}
      {activeEntitlements.length === 0 && (
        <div className="mb-8 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-amber-600 text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              info
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base sm:text-lg font-extrabold text-primary tracking-tight">
              You don&apos;t have an active plan yet
            </div>
            <div className="text-sm text-on-surface-variant font-medium mt-1">
              Subscribe to a package to unlock full exam access, progress tracking, and more.
            </div>
          </div>
          <a
            href="/plans"
            className="flex-shrink-0 bg-primary text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all flex items-center gap-2 w-full sm:w-auto justify-center"
          >
            Browse Plans
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </a>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* ── Sidebar ── */}
        <div className="lg:col-span-4">
          <div className="bg-white border border-outline/60 shadow-soft-xl p-8 rounded-2xl">
            <div className="flex items-start justify-between gap-6">
              <div className="flex items-center gap-4 min-w-0">
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
                  className="w-16 h-16 min-w-[4rem] min-h-[4rem] bg-surface-variant border border-outline/40 overflow-hidden rounded-full flex items-center justify-center cursor-pointer group flex-shrink-0 relative"
                >
                  {profile?.avatar_url ? (
                    <Image
                      src={profile.avatar_url}
                      alt={profile.full_name ?? "Avatar"}
                      className="w-full h-full object-cover rounded-full"
                      fill
                      sizes="64px"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-primary text-[28px]">
                      person
                    </span>
                  )}
                </label>
                <div className="min-w-0">
                  <div className="text-xl font-extrabold text-primary tracking-tight truncate">
                    {profile?.full_name || "Your Profile"}
                  </div>
                  <div className="text-xs text-on-surface-variant font-medium mt-1 truncate">
                    {profile?.bio || "No bio yet"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="text-xs font-bold text-on-surface-variant hover:text-primary transition-colors flex-shrink-0"
              >
                Logout
              </button>
            </div>

            <div className="mt-8">
              <div className="text-xs font-bold text-primary uppercase tracking-widest mb-3">
                Motivation
              </div>
              <div className="bg-surface-variant border border-outline/40 p-5 text-sm text-on-surface leading-relaxed font-medium rounded-xl">
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
                  Email
                </div>
                <input
                  value={profile?.email ?? ""}
                  disabled
                  className="w-full bg-surface-variant border border-outline px-4 py-3 text-sm outline-none btn-sharp text-on-surface-variant cursor-not-allowed"
                  placeholder="Email"
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

              <div className="flex w-full gap-3">
                <label
                  htmlFor="avatar-upload"
                  className="flex-1 bg-white text-primary border border-outline px-4 py-3 text-xs font-bold hover:bg-surface-variant transition-all btn-sharp cursor-pointer text-center"
                >
                  Upload avatar
                </label>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={saving}
                  className="flex-1 bg-primary text-white px-6 py-3 text-xs font-bold hover:bg-slate-800 transition-all btn-sharp disabled:opacity-60"
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

        {/* ── Main content ── */}
        <div id="profile-content-main" className="lg:col-span-8 space-y-10 scroll-mt-20">
          {currentTab === "overview" && (
            <>
              {/* Active Subscriptions */}
              <div className="bg-white border border-outline/60 shadow-soft-xl p-6 md:p-8 rounded-2xl">
                <div className="flex items-end justify-between gap-4 md:gap-8 mb-8">
                  <div>
                    <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
                      Access
                    </div>
                    <h2 className="font-headline text-2xl md:text-4xl font-extrabold text-primary tracking-tighter">
                      Active Subscriptions
                    </h2>
                  </div>
                  <div className="text-[10px] md:text-xs uppercase tracking-widest text-on-surface-variant font-bold whitespace-nowrap">
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
                          className={[
                            "w-full text-left rounded-xl transition-all hover:shadow-md",
                            soon
                              ? "border border-amber-200 bg-amber-50/40 p-6"
                              : "border border-outline/60 bg-surface-variant/30 p-6",
                          ].join(" ")}
                        >
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                            <div>
                              <div className="text-[10px] uppercase tracking-[0.2em] font-black text-on-surface-variant">
                                {e.subjects?.track ?? "Subject"}
                              </div>
                              <div className="text-xl md:text-2xl font-extrabold text-primary mt-2 tracking-tight">
                                {e.subjects?.title ?? "Subscription"}
                              </div>
                              <div className="text-sm text-on-surface-variant font-medium mt-2">
                                Expires in {e.daysLeft} day{e.daysLeft === 1 ? "" : "s"}
                              </div>
                            </div>

                            <div className="min-w-0 md:min-w-[260px] w-full md:w-auto">
                              <div className="flex items-center justify-between text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">
                                <span>Progress</span>
                                <span>{percent}%</span>
                              </div>
                              <div className="h-3 bg-white border border-outline/60 overflow-hidden rounded-full">
                                <div
                                  className="h-full bg-secondary rounded-full transition-all duration-500"
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
                  <div className="border border-outline/60 bg-surface-variant px-6 py-10 text-on-surface-variant font-medium rounded-xl">
                    No active subscriptions yet.
                  </div>
                )}
              </div>

              {/* ── My Scores ── */}
              <div className="bg-white border border-outline/60 shadow-soft-xl p-6 md:p-8 rounded-2xl">
                <div className="flex items-end justify-between gap-4 md:gap-8 mb-8">
                  <div>
                    <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
                      Performance
                    </div>
                    <h2 className="font-headline text-2xl md:text-4xl font-extrabold text-primary tracking-tighter">
                      My Scores
                    </h2>
                  </div>
                  <div className="text-[10px] md:text-xs uppercase tracking-widest text-on-surface-variant font-bold whitespace-nowrap">
                    {attempts.length} submission{attempts.length === 1 ? "" : "s"}
                  </div>
                </div>

                {attempts.length ? (
                  <>
                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b-2 border-outline/40">
                            <th className="text-[10px] uppercase tracking-[0.2em] font-black text-on-surface-variant py-3 pr-4">
                              #
                            </th>
                            <th className="text-[10px] uppercase tracking-[0.2em] font-black text-on-surface-variant py-3 pr-4">
                              Exam
                            </th>
                            <th className="text-[10px] uppercase tracking-[0.2em] font-black text-on-surface-variant py-3 pr-4">
                              Subject
                            </th>
                            <th className="text-[10px] uppercase tracking-[0.2em] font-black text-on-surface-variant py-3 pr-4">
                              Score
                            </th>
                            <th className="text-[10px] uppercase tracking-[0.2em] font-black text-on-surface-variant py-3 pr-4">
                              Duration
                            </th>
                            <th className="text-[10px] uppercase tracking-[0.2em] font-black text-on-surface-variant py-3">
                              Date
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {attempts.map((a, idx) => {
                            const subjectTitle =
                              (a.exams?.subject_id
                                ? subjectTitleMap.get(a.exams?.subject_id)
                                : undefined) ?? "—";
                            const scoreStyles = getScoreStyles(a.score);
                            return (
                              <tr
                                key={a.id}
                                onClick={() => {
                                  const slug = a.exams?.subjects?.slug;
                                  if (!slug) return;
                                  router.push(`/subjects/${slug}/exams/${a.exams?.exam_number}?attempt_id=${a.id}`);
                                }}
                                className="border-b border-outline/20 hover:bg-primary/5 transition-all cursor-pointer group"
                              >
                                <td className="py-4 pr-4 text-xs text-on-surface-variant font-medium">
                                  {idx + 1}
                                </td>
                                <td className="py-4 pr-4 text-sm font-bold text-primary">
                                  {a.exams?.title ?? `Exam #${a.exams?.exam_number ?? "—"}`}
                                </td>
                                <td className="py-4 pr-4 text-sm text-on-surface-variant font-medium">
                                  {subjectTitle}
                                </td>
                                <td className="py-4 pr-4">
                                  <span className={`inline-flex items-center gap-1.5 border font-extrabold text-sm px-3 py-1 rounded-lg ${scoreStyles.wrapper}`}>
                                    <span
                                      className={`material-symbols-outlined text-sm ${scoreStyles.icon}`}
                                      style={{ fontVariationSettings: "'FILL' 1" }}
                                    >
                                      star
                                    </span>
                                    {a.score} / 800
                                  </span>
                                </td>
                                <td className="py-4 pr-4 text-sm text-on-surface-variant font-medium">
                                  {formatDuration(a.duration_seconds)}
                                </td>
                                <td className="py-4 text-sm text-on-surface-variant font-medium">
                                  {new Date(a.submitted_at).toLocaleDateString(undefined, {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden space-y-4">
                      {attempts.map((a, idx) => {
                        const subjectTitle =
                          (a.exams?.subject_id
                            ? subjectTitleMap.get(a.exams?.subject_id)
                            : undefined) ?? "—";
                        const scoreStyles = getScoreStyles(a.score);
                        return (
                          <div
                            key={a.id}
                            onClick={() => {
                              const slug = a.exams?.subjects?.slug;
                              if (!slug) return;
                              router.push(`/subjects/${slug}/exams/${a.exams?.exam_number}?attempt_id=${a.id}`);
                            }}
                            className="border border-outline/40 bg-surface-variant/20 rounded-xl p-4 space-y-3 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all active:scale-95"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-[10px] uppercase tracking-[0.15em] font-black text-on-surface-variant mb-1">
                                  #{idx + 1} · {subjectTitle}
                                </div>
                                <div className="text-sm font-bold text-primary truncate">
                                  {a.exams?.title ?? `Exam #${a.exams?.exam_number ?? "—"}`}
                                </div>
                              </div>
                              <span className={`inline-flex items-center gap-1 border font-extrabold text-xs px-2.5 py-1 rounded-lg flex-shrink-0 ${scoreStyles.wrapper}`}>
                                <span
                                  className={`material-symbols-outlined text-xs ${scoreStyles.icon}`}
                                  style={{ fontVariationSettings: "'FILL' 1" }}
                                >
                                  star
                                </span>
                                {a.score}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-on-surface-variant font-medium">
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">timer</span>
                                {formatDuration(a.duration_seconds)}
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">calendar_today</span>
                                {new Date(a.submitted_at).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="border border-outline/60 bg-surface-variant px-6 py-10 text-on-surface-variant font-medium rounded-xl text-center">
                    <span className="material-symbols-outlined text-4xl text-on-surface-variant/40 mb-3 block">
                      assignment
                    </span>
                    No submissions yet. Start an exam to see your scores here!
                  </div>
                )}
              </div>

              {/* Previous Orders */}
              <div className="bg-white border border-outline/60 shadow-soft-xl p-6 md:p-8 rounded-2xl">
                <div className="flex items-end justify-between gap-4 md:gap-8 mb-8">
                  <div>
                    <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
                      History
                    </div>
                    <h2 className="font-headline text-2xl md:text-4xl font-extrabold text-primary tracking-tighter">
                      Previous Orders
                    </h2>
                  </div>
                </div>

                {orders.length ? (
                  <div className="space-y-4">
                    {orders.map((o) => (
                      <div
                        key={o.id}
                        className="border border-outline/60 bg-surface-variant/30 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-xl"
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
                  <div className="border border-outline/60 bg-surface-variant px-6 py-10 text-on-surface-variant font-medium rounded-xl">
                    No orders yet.
                  </div>
                )}
              </div>
            </>
          )}

          {currentTab === "mistakes" && (
            <div className="bg-white border border-outline/60 shadow-soft-xl p-6 md:p-8 rounded-2xl">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                <div>
                  <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
                    Review & Practice
                  </div>
                  <h2 className="font-headline text-2xl md:text-4xl font-extrabold text-primary tracking-tighter">
                    Mistake Bank
                  </h2>
                </div>
                {mistakes.length > 0 && (
                  <button
                    onClick={() => router.push("/profile/mistake-bank")}
                    className="bg-primary text-white px-8 py-3.5 text-sm font-extrabold hover:bg-slate-800 transition-all btn-sharp flex items-center gap-2 whitespace-nowrap"
                  >
                    <span className="material-symbols-outlined text-lg">play_arrow</span>
                    Start Practice Test
                  </button>
                )}
              </div>

              {mistakes.length > 0 ? (
                <div className="space-y-4">
                  {mistakes.slice(0, visibleMistakes).map((m, idx) => {
                    const subjTitle = m.exam_questions?.exams?.subjects?.title ?? "Subject";
                    const examTitle = m.exam_questions?.exams?.title ?? "Exam";
                    return (
                      <div
                        key={m.id}
                        className="border border-outline/60 bg-surface-variant/30 p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 rounded-xl hover:shadow-md transition-shadow"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="inline-flex items-center gap-1 bg-white border border-outline/40 px-2 py-0.5 rounded-md text-[10px] font-black text-on-surface-variant uppercase tracking-widest">
                              <span className="material-symbols-outlined text-[14px]">book</span>
                              {subjTitle}
                            </span>
                            <span className="text-[10px] uppercase font-bold text-on-surface-variant/70 tracking-widest truncate">
                              {examTitle}
                            </span>
                          </div>

                          <div className="text-sm font-bold text-primary truncate">
                            {m.exam_questions?.prompt_text ? (
                              <div className="line-clamp-2" dangerouslySetInnerHTML={{ __html: m.exam_questions?.prompt_text }} />
                            ) : (
                              `Question #${m.exam_questions?.question_number ?? "?"}`
                            )}
                          </div>
                          <div className="text-xs font-medium text-on-surface-variant mt-3 flex items-center gap-4">
                            <span className="flex items-center gap-1.5 text-rose-600 font-bold bg-rose-50 px-2 py-1 rounded-md">
                              <span className="material-symbols-outlined text-[14px]">error</span>
                              {m.error_count} mistake{m.error_count !== 1 ? 's' : ''}
                            </span>
                            <span className="flex items-center gap-1.5 bg-white border border-outline/40 px-2 py-1 rounded-md">
                              <span className="material-symbols-outlined text-[14px] text-amber-500">signal_cellular_alt</span>
                              Difficulty: {m.difficulty_score}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {mistakes.length > visibleMistakes && (
                    <div className="pt-6 flex justify-center">
                      <button
                        onClick={() => setVisibleMistakes(prev => prev + 10)}
                        className="px-10 py-3 rounded-xl border-2 border-outline/40 font-extrabold text-sm text-on-surface-variant hover:bg-slate-50 transition-all active:scale-95"
                      >
                        Show More Mistake Questions
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border border-outline/60 bg-surface-variant px-6 py-12 text-on-surface-variant font-medium rounded-xl text-center">
                  <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-4 block">
                    task_alt
                  </span>
                  <div className="text-lg font-bold text-primary mb-2">You're all caught up!</div>
                  All practice questions answered incorrectly will automatically appear here.
                </div>
              )}
            </div>
          )}

          {currentTab === "braingym" && (
            <div className="space-y-8 animate-fade-in">
              {/* Eligibility Check */}
              {activeEntitlements.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-outline/60 p-12 text-center rounded-3xl">
                  <div className="w-20 h-20 bg-slate-50 text-secondary rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="material-symbols-outlined text-4xl">lock</span>
                  </div>
                  <h3 className="text-2xl font-black text-primary mb-3 tracking-tight">Premium Practice Tool</h3>
                  <p className="max-w-md mx-auto text-on-surface-variant font-medium leading-relaxed">
                    Question Bank is a premium feature for subscribed students. Unlock a subject to start building custom practice sets.
                  </p>
                  <button
                    onClick={() => router.push('/')}
                    className="mt-8 bg-primary text-white px-8 py-3.5 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                  >
                    Explore Packages
                  </button>
                </div>
              ) : (
                <>
                  {/* Setup Wizard */}
                  <div className="bg-white border-2 border-outline/30 shadow-none overflow-hidden rounded-3xl">
                    <div className="p-8 border-b border-outline/20 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-50/50">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-4">
                          <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">bolt</span>
                            Step {gymStep} of 2
                          </div>
                          {gymStep === 2 && (
                            <button 
                              onClick={() => setGymStep(1)}
                              className="w-8 h-8 rounded-full border border-outline/40 flex items-center justify-center text-primary hover:bg-slate-100 hover:border-primary transition-all active:scale-95"
                              title="رجوع"
                            >
                              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                            </button>
                          )}
                        </div>
                        <h2 className="font-headline text-2xl md:text-3xl font-extrabold text-primary tracking-tighter">
                          {gymStep === 1 ? 'Select Your Topics' : 'Configure Session'}
                        </h2>
                      </div>
                    </div>

                    <div className="p-8">
                      {gymStep === 1 ? (
                        <div className="animate-fade-in">
                          <div className="grid grid-cols-1 gap-8">
                            {activeEntitlements.map(ent => {
                              const subjTopics = allTopics.filter(t => t.subject_id === ent.subject_id);
                              if (subjTopics.length === 0) return null;
                              return (
                                <div key={ent.id} className="bg-white p-6 rounded-3xl border-2 border-outline/30 space-y-8">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center">
                                      <span className="material-symbols-outlined text-primary">bookmark</span>
                                    </div>
                                    <div className="text-sm font-black text-primary uppercase tracking-widest">
                                      {ent.subjects?.title}
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-10">
                                    {subjTopics.map(t => {
                                      const mySubtopics = allSubtopics.filter(st => st.topic_id === t.id);
                                      const allSelected = mySubtopics.length > 0 && mySubtopics.every(st => gymSubtopics.includes(st.id));
                                      const someSelected = mySubtopics.some(st => gymSubtopics.includes(st.id)) && !allSelected;

                                      return (
                                        <div key={t.id} className="space-y-4">
                                          <div 
                                            className="flex items-center justify-between cursor-pointer group/topic"
                                            onClick={() => {
                                              const ids = mySubtopics.map(st => st.id);
                                              if (allSelected) {
                                                setGymSubtopics(prev => prev.filter(id => !ids.includes(id)));
                                                setGymTopics(prev => prev.filter(id => id !== t.id));
                                              } else {
                                                setGymSubtopics(prev => Array.from(new Set([...prev, ...ids])));
                                                setGymTopics(prev => Array.from(new Set([...prev, t.id])));
                                              }
                                            }}
                                          >
                                            <div className="flex items-center gap-3">
                                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${allSelected ? 'bg-primary border-primary' : someSelected ? 'bg-primary/20 border-primary' : 'border-outline group-hover/topic:border-primary'}`}>
                                                {allSelected && <span className="material-symbols-outlined text-white text-[16px]">check</span>}
                                                {someSelected && <div className="w-2.5 h-0.5 bg-primary rounded-full"></div>}
                                              </div>
                                              <span className={`text-sm font-extrabold tracking-tight transition-colors ${allSelected || someSelected ? 'text-primary' : 'text-slate-600 group-hover/topic:text-primary'}`}>{t.title}</span>
                                            </div>
                                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest group-hover/topic:text-primary/40 transition-colors">Select All</span>
                                          </div>
                                          
                                          <div className="flex flex-wrap gap-2.5 pl-8">
                                            {mySubtopics.map(st => {
                                              const isSelected = gymSubtopics.includes(st.id);
                                              return (
                                                <button
                                                  key={st.id}
                                                  onClick={() => {
                                                    setGymSubtopics(prev =>
                                                      isSelected ? prev.filter(x => x !== st.id) : [...prev, st.id]
                                                    );
                                                  }}
                                                  className={`px-4 py-2 rounded-xl text-[11px] font-bold transition-all border-2 ${isSelected
                                                    ? "bg-secondary border-secondary text-white shadow-sm scale-105"
                                                    : "bg-slate-50 border-transparent text-on-surface-variant hover:border-secondary/30 hover:bg-white"
                                                    }`}
                                                >
                                                  {st.title}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="animate-fade-in">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-5xl">
                            {/* Step 2: Question Count */}
                            <div>
                              <div className="text-xs font-black text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="w-6 h-6 bg-slate-100 text-secondary rounded-lg flex items-center justify-center text-[12px]">1</span>
                                Questions
                              </div>
                              <div className="flex items-center justify-between mb-4">
                                <span className="text-lg font-black text-primary">{gymLimit}</span>
                                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">items</span>
                              </div>
                              <input
                                type="range" min="1" max="50" step="1"
                                value={gymLimit}
                                onChange={(e) => setGymLimit(Number(e.target.value))}
                                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-secondary"
                              />
                            </div>

                            {/* Step 3: Duration */}
                            <div>
                              <div className="text-xs font-black text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="w-6 h-6 bg-slate-100 text-secondary rounded-lg flex items-center justify-center text-[12px]">2</span>
                                Duration (Min)
                              </div>
                              <div className="flex items-center justify-between mb-4">
                                <span className="text-lg font-black text-primary">{gymTime}</span>
                                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">minutes</span>
                              </div>
                              <input
                                type="range" min="1" max="60" step="1"
                                value={gymTime}
                                onChange={(e) => setGymTime(Number(e.target.value))}
                                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-secondary"
                              />
                            </div>

                            {/* Step 4: Target accuracy */}
                            <div>
                              <div className="text-xs font-black text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="w-6 h-6 bg-slate-100 text-secondary rounded-lg flex items-center justify-center text-[12px]">3</span>
                                Pass Target
                              </div>
                              <div className="flex items-center justify-between mb-4">
                                <span className="text-lg font-black text-primary">{gymTarget}%</span>
                                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">accuracy</span>
                              </div>
                              <input
                                type="range" min="1" max="100" step="1"
                                value={gymTarget}
                                onChange={(e) => setGymTarget(Number(e.target.value))}
                                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-secondary"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Bottom Action Footer */}
                      <div className="mt-12 pt-8 border-t border-outline/20">
                        <div className="w-full">
                          {gymStep === 1 ? (
                            <button
                              disabled={gymTopics.length === 0}
                              onClick={() => setGymStep(2)}
                              className="w-full bg-primary text-white py-4 rounded-xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                              Next Step
                              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                            </button>
                          ) : (
                            <button
                              onClick={startGymSession}
                              className="w-full bg-primary text-white py-4 rounded-xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                            >
                              <span className="material-symbols-outlined text-[20px]">bolt</span>
                              Start Workout
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Gym History */}
                  <div className="bg-white border-2 border-outline/30 shadow-soft-xl p-6 md:p-8 rounded-2xl mt-12">
                    <div className="flex items-end justify-between gap-4 mb-8">
                      <div>
                        <div className="text-secondary font-extrabold text-[11px] uppercase tracking-[0.3em] mb-4">
                          Consistency
                        </div>
                        <h2 className="font-headline text-2xl md:text-3xl font-extrabold text-primary tracking-tighter">
                          Gym History
                        </h2>
                      </div>
                      <div className="text-[10px] md:text-xs uppercase tracking-widest text-on-surface-variant font-bold">
                        {practiceSessions.length} sessions
                      </div>
                    </div>

                    {practiceSessions.length > 0 ? (
                      <div className="space-y-4">
                        {practiceSessions.map((s) => {
                          const passed = s.percent_correct >= s.target_accuracy;
                          return (
                            <div 
                              key={s.id} 
                              onClick={() => router.push(`/profile/brain-gym/session?session_id=${s.id}`)}
                              className="group border border-outline/40 bg-white p-5 rounded-2xl hover:border-secondary/40 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 cursor-pointer active:scale-[0.99]"
                            >
                              <div className="flex items-center gap-5">
                                <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center border-2 ${passed ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-rose-50 border-rose-100 text-rose-600'}`}>
                                  <div className="text-sm font-black leading-none">{s.percent_correct}%</div>
                                  <div className="text-[8px] font-black uppercase mt-1">Score</div>
                                </div>
                                <div>
                                  <div className="text-sm font-extrabold text-primary mb-1">
                                    {s.total_questions} Questions Workout
                                  </div>
                                  <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                                    {new Date(s.created_at).toLocaleDateString()} · Target: {s.target_accuracy}%
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right hidden sm:block">
                                  <div className="text-xs font-black text-primary">Time Spent</div>
                                  <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mt-0.5">
                                    {formatDuration(s.duration_seconds)}
                                  </div>
                                </div>
                                <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${passed ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-rose-500 text-white border-rose-600'}`}>
                                  {passed ? 'Passed' : 'Failed'}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="border border-outline/40 bg-slate-50/50 p-12 text-center rounded-2xl">
                        <span className="material-symbols-outlined text-4xl text-slate-300 mb-3 block">history</span>
                        <p className="text-sm font-bold text-slate-400">No sessions recorded yet. Start your first workout!</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
